import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const bundledCodex = [
  "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
  "/Applications/Codex.app/Contents/Resources/codex",
].find(file => process.platform === "darwin" && existsSync(file));

// Use the user's installed official client. No bundled proprietary code,
// inherited desktop executor identity, or fabricated authorization metadata.
export class OfficialComputerClient {
  constructor({
    executable = process.env.SKYRAIL_OFFICIAL_COMPUTER_CLIENT ||
      path.join(homedir(), ".codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"),
    launcher = process.env.SKYRAIL_OFFICIAL_COMPUTER_LAUNCHER || bundledCodex || null,
    launcherProfile = process.env.SKYRAIL_OFFICIAL_LAUNCH_PROFILE || ":danger-full-access",
    launch = spawn,
    timeout = 120000,
  } = {}) {
    Object.assign(this, { executable, launcher, launcherProfile, launch, timeout });
    this.pending = new Map();
    this.nextId = 0;
    this.authentication = "unverified";
  }
  status() {
    return { applicationApproval: "scoped-elicitation-v1", transport: this.serverInfo ? "connected" : this.child ? "connecting" : "disconnected", authentication: this.authentication, server: this.serverInfo, lastError: this.lastError };
  }
  async connect() {
    if (this.connecting) return this.connecting;
    // The dedicated signed GUI helper had unrestricted OS process access when
    // spawned directly too. Preserve that scope explicitly; CLI sandbox's
    // workspace default blocks AppKit. Model commands retain their own profile.
    const child = this.launch(this.launcher || this.executable, this.launcher ? ["sandbox", ...(this.launcherProfile ? ["--include-managed-config", "--permission-profile", this.launcherProfile] : []), "--", this.executable, "mcp"] : ["mcp"], { stdio: ["pipe", "pipe", "pipe"], detached: !!this.launcher && process.platform !== "win32" });
    this.child = child;
    child.stderr.on("data", data => {
      if (process.env.SKYRAIL_OFFICIAL_DEBUG === "1") process.stderr.write(data);
    });
    const fail = error => {
      if (this.child !== child) return;
      this.close(error);
    };
    child.stdin.on("error", fail);
    child.on("error", fail);
    child.on("exit", (code, signal) => fail(Error("官方 Computer Use 客户端已退出（" + (signal || (code ?? "unknown")) + "）；操作结果需重新观察")));
    createInterface({ input: child.stdout }).on("line", line => {
      if (this.child !== child) return;
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message.method && message.id !== undefined) {
        if (process.env.SKYRAIL_OFFICIAL_DEBUG === "1") process.stderr.write(JSON.stringify({ officialServerRequest: message }) + "\n");
        void this.respondToServerRequest(child, message);
        return;
      }
      const request = this.pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      this.pending.delete(message.id);
      if (message.error) request.reject(Object.assign(Error(message.error.message), { code: message.error.code }));
      else request.resolve(message.result);
    });
    this.connecting = this.rpc("initialize", {
      protocolVersion: "2025-06-18", capabilities: { elicitation: {} },
      clientInfo: { name: "skyrail", version: "0.2.0" },
    }).then(async result => {
      if (this.child !== child) throw Error("官方 Computer Use 连接已更换");
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
      const list = await this.rpc("tools/list", {});
      this.tools = list.tools;
      this.serverInfo = result.serverInfo;
      return result;
    }).catch(error => { fail(error); throw error; });
    return this.connecting;
  }
  async respondToServerRequest(child, message) {
    const reply = result => {
      if (this.child === child && child.stdin.writable)
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, ...result }) + "\n");
    };
    if (message.method !== "elicitation/create") {
      reply({error:{code:-32601,message:"Unsupported official MCP server request"}}); return;
    }
    const schema = message.params?.requestedSchema;
    const emptyAppForm = (message.params?.mode === undefined || message.params.mode === "form") && schema?.type === "object" &&
      schema.properties && Object.keys(schema.properties).length === 0 &&
      (!schema.required || (Array.isArray(schema.required) && schema.required.length === 0));
    const candidates = [...this.pending.values()].filter(p => p.approveApplication && p.application);
    if (!emptyAppForm || candidates.length !== 1) {
      reply({result:{action:"decline"}}); return;
    }
    const pending = candidates[0];
    let allowed = false;
    try { allowed = await pending.approveApplication() === true; } catch {}
    if (this.pending.get(pending.id) !== pending) return;
    // Only the app operation already approved by Skyrail is accepted. Do not
    // echo the server's persist:[always] metadata or grant future app access.
    reply({result:allowed ? {action:"accept",content:{}} : {action:"decline"}});
  }
  rpc(method, params, { approveApplication } = {}) {
    const child = this.child;
    if (!child?.stdin.writable) return Promise.reject(Error("官方 Computer Use 未连接"));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.close(Error("官方 Computer Use 请求超时；结果未知，请先重新观察"));
      }, this.timeout);
      this.pending.set(id, { id, resolve, reject, timer, ...(method === "tools/call" && params.name === "get_app_state" ? {application:params.arguments.app,approveApplication} : {}) });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }
  async call(name, args, options) {
    try { return await this.callTool(name, args, options); }
    catch (error) {
      if (/Sender process is not authenticated/i.test(error.message)) {
        this.authentication = "rejected";
        this.lastError = { code: "OFFICIAL_HOST_AUTH_REQUIRED", message: error.message };
        throw Object.assign(Error(error.message + "；官方服务未认证当前宿主。macOS 自动化授权与宿主认证不同，请勿重复申请系统权限。"), { code: "OFFICIAL_HOST_AUTH_REQUIRED", cause: error });
      }
      this.lastError = { code: "OFFICIAL_TOOL_FAILED", message: error.message };
      throw error;
    }
  }
  async callTool(name, args, options) {
    await this.connect();
    if (!this.tools?.some(tool => tool.name === name))
      throw Error("已安装的官方 Computer Use 不支持 " + name);
    const result = await this.rpc("tools/call", { name, arguments: args }, options);
    const text = (result.content || []).filter(item => item.type === "text").map(item => item.text).join("\n");
    if (result.isError) {
      const hint = text.includes("bootstrapTimedOut")
        ? "；请在 Skyrail 权限设置点击“连接官方 Computer Use”以请求系统自动化授权。若系统列表没有 Skyrail Mac，请先更新并重启常驻应用。这独立于辅助功能和屏幕录制，超时本身不证明权限被拒绝。"
        : "";
      throw Error((text || "官方 Computer Use 拒绝了操作") + hint);
    }
    this.authentication = "accepted";
    this.lastError = undefined;
    const image = result.content?.find(item => item.type === "image");
    return {
      text,
      ...(image ? { image: `data:${image.mimeType};base64,${image.data}` } : {}),
    };
  }
  close(error = Error("官方 Computer Use 连接已关闭")) {
    const child = this.child;
    this.child = null;
    this.connecting = null;
    this.tools = null;
    this.serverInfo = null;
    if (this.authentication === "accepted") this.authentication = "unverified";
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
    child?.stdin.end();
    if (child?.pid && this.launcher && process.platform !== "win32") {
      try { process.kill(-child.pid, "SIGTERM"); return; } catch {}
    }
    child?.kill();
  }
}
