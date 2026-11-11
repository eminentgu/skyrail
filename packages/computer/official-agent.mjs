// Every official call stays behind the same thread/epoch ownership gate used by
// Skyrail's human viewer. Input and takeover share MacBridge's serial queue.
export class OfficialComputerAgent {
  constructor(mac, client) {
    this.mac = mac;
    this.client = client;
    this.observed = null;
    this.generation = 0;
  }
  revoke(threadId) {
    if (threadId && threadId !== this.activeThread) return;
    this.generation++;
    this.observed = null;
  }
  invalidateObservation() { this.observed = null; }
  assertControl(threadId, epoch) {
    const state = this.mac.state;
    this.mac.assertUnlocked();
    if (state.transitioning || state.threadId !== threadId ||
        state.epoch !== epoch || state.owner !== "agent")
      throw Error("电脑控制权已撤销；请等待用户交还，再重新观察");
  }
  async open(app, threadId) {
    if (this.opening) throw Error("正在连接其他应用，请等待连接完成");
    this.opening = true;
    try {
      const mac = this.mac;
      mac.assertUnlocked();
      this.activeThread = threadId;
      const generation = this.generation;
      await mac.control(mac.state.epoch, "none");
      const epoch = mac.state.epoch;
      const check = () => {
        mac.assertUnlocked();
        if (mac.state.epoch !== epoch || mac.state.transitioning || this.generation !== generation)
          throw Error("电脑控制权已变化");
      };
      const result = await this.enqueue(async () => {
        check();
        const result = await this.client.call("get_app_state", { app }, {approveApplication:()=>{check();return true;}});
        check();
        return result;
      });
      const { apps } = await mac.rpc("apps");
      const target = apps.find(candidate =>
        candidate.id === app || candidate.name.toLowerCase() === app.toLowerCase());
      if (!target) throw Error("官方工具已返回观察，但尚未识别可共享的应用窗口");
      check();
      await mac.bindOfficial(target.id, threadId, result, () => {
        mac.assertUnlocked();
        if (this.generation !== generation) throw Error("电脑控制权已变化");
      });
      await mac.control(mac.state.epoch, "agent", { observe: false });
      if (this.generation !== generation) {
        if (mac.state.threadId === threadId && mac.state.owner === "agent")
          await mac.control(mac.state.epoch, "none", { observe: false });
        throw Error("电脑控制权已变化");
      }
      mac.state.humanClientId = null;
      this.observed = { threadId, epoch: mac.state.epoch };
      return { ...result, app: target.name };
    } finally { this.opening = false; }
  }
  enqueue(action) {
    const job = this.mac.queue.then(action);
    this.mac.queue = job.catch(() => {});
    return job;
  }
  execute(threadId, epoch, args) {
    this.assertControl(threadId, epoch);
    this.activeThread = threadId;
    const generation = this.generation;
    const check = () => {
      this.assertControl(threadId, epoch);
      if (generation !== this.generation) throw Error("电脑控制权已撤销");
    };
    return this.enqueue(async () => {
      check();
      const app = this.mac.state.app;
      if (args.action !== "observe" &&
          (this.observed?.threadId !== threadId || this.observed?.epoch !== epoch))
        throw Error("请先 observe 获取官方 Computer Use 当前窗口与元素编号");
      if (args.action !== "observe") {
        const request = this.request(app, args);
        this.observed = null;
        await this.client.call(request.name, request.args);
        check();
      }
      this.observed = null;
      const result = await this.client.call("get_app_state", { app }, {approveApplication:()=>{check();return true;}});
      check();
      this.mac.updateOfficialFrame?.(result);
      this.observed = { threadId, epoch };
      return result;
    });
  }
  request(app, args) {
    if (["press", "setValue", "scroll"].includes(args.action) &&
        (args.index === undefined || String(args.index).length > 200))
      throw Error("请提供当前官方观察结果中的元素编号");
    if (["setValue", "type_text"].includes(args.action) &&
        (typeof args.value !== "string" || args.value.length > 4000))
      throw Error("请输入最多 4000 字的文字");
    if (args.action === "key" && (typeof args.key !== "string" || args.key.length > 100))
      throw Error("请提供有效按键或组合键");
    if (["click", "drag"].includes(args.action) &&
        ![args.x, args.y, ...(args.action === "drag" ? [args.toX, args.toY] : [])]
          .every(value => Number.isFinite(value) && value >= 0))
      throw Error("请提供截图内的像素坐标");
    if (args.action === "scroll" && (!["up", "down", "left", "right"].includes(args.direction) ||
        !Number.isFinite(args.pages ?? 1) || (args.pages ?? 1) <= 0 || (args.pages ?? 1) > 20))
      throw Error("请提供滚动方向和最多 20 页的距离");
    switch (args.action) {
      case "press":
        return { name: "click", args: { app, element_index: String(args.index) } };
      case "setValue":
        return { name: "set_value", args: { app, element_index: String(args.index), value: args.value } };
      case "key":
        return { name: "press_key", args: { app, key: args.key } };
      case "type_text":
        return { name: "type_text", args: { app, text: args.value } };
      case "click":
        return { name: "click", args: { app, x: args.x, y: args.y, click_count: args.clickCount || 1 } };
      case "scroll":
        return { name: "scroll", args: { app, element_index: String(args.index), direction: args.direction, pages: args.pages ?? 1 } };
      case "drag":
        return { name: "drag", args: { app, from_x: args.x, from_y: args.y, to_x: args.toX, to_y: args.toY } };
      default:
        throw Error("官方 Computer Use 不支持此 Skyrail 操作");
    }
  }
  close() { this.revoke(); this.client.close(); }
}
