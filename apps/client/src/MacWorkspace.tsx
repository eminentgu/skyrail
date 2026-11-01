import React, { useEffect, useState } from "react";
import { InteractiveImage } from "./InteractiveImage";
import { RemoteDesktop } from "./RemoteDesktop";
import { Icon } from "./Icon";
export type Lease = {
  approvalMode?: string;
  sessionId?: string | null;
  humanClientId?: string | null;
  owner: string;
  epoch: number;
  app?: string | null;
  threadId?: string | null;
  transitioning?: boolean;
  health?: {
    accessibility: boolean;
    screenRecording: boolean;
    locked?: boolean;
    activeDisplays?: number;
  };
  frame?: {
    windowTitle?: string;
    capturedAt: string;
    width: number;
    height: number;
  } | null;
};
export type StreamState = {
  status: string;
  fps: number;
  frames: number;
  error?: string | null;
  lastFrameAt?: number;
};
type Approval = {
  id: string;
  threadId: string;
  app: string;
  args: { action: string; index?: number; value?: string; key?: string };
};
type Props = {
  lease: Lease;
  stream?: StreamState;
  approvals?: Approval[];
  selected: string;
  running: boolean;
  full: boolean;
  setFull: (value: boolean) => void;
  collapse: () => void;
  post: (path: string, data?: object) => Promise<any>;
  onSnapshot: (value: any) => void;
  ensureThread: () => Promise<string>;
  switchThread: (id: string) => void;
  visible?: boolean;
  applicationTools?: number;
  onStopReady?: (stop: () => Promise<void>) => void;
};
const actionLabel = (args: Approval["args"]) =>
  args.action === "press"
    ? `按下元素 ${args.index}`
    : args.action === "setValue"
      ? `填写「${args.value || ""}」`
      : `按 ${args.key || ""} 键`;
export function MacWorkspace({
  lease,
  stream,
  approvals,
  selected,
  running,
  full,
  setFull,
  collapse,
  post,
  onSnapshot,
  ensureThread,
  switchThread,
  visible: workspaceVisible = true,
  applicationTools = 0,
  onStopReady,
}: Props) {
  const [view, setView] = useState("desktop");
  useEffect(() => {
    if (applicationTools) setView("app");
  }, [applicationTools]);
  const [apps, setApps] = useState<{ id: string; name: string }[]>([]),
    [choice, setChoice] = useState(lease.app || ""),
    [health, setHealth] = useState<{
      accessibility: boolean;
      screenRecording: boolean;
      activeDisplays?: number;
      locked?: boolean;
    } | null>(null),
    [pending, setPending] = useState(""),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [settings, showSettings] = useState(!lease.app),
    [windows, setWindows] = useState<{ id: number; title: string }[]>([]),
    [windowId, setWindowId] = useState<number | undefined>(),
    [windowRefresh, refreshWindows] = useState(0);
  const [clientId] = useState(() => {
    let id = sessionStorage.getItem("skyrail.client");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("skyrail.client", id);
    }
    return id;
  });
  const belongs = !!lease.app && lease.threadId === selected;
  const live = belongs && stream?.status === "live";
  const appName =
    apps.find((a) => a.id === lease.app)?.name || lease.app || "Mac 应用";
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    if (lease.health) setHealth(lease.health);
  }, [lease.health]);
  useEffect(() => {
    const changed = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([post("mac/health"), post("mac/apps")])
      .then(([h, a]) => {
        if (active) {
          setHealth(h);
          setApps(a.apps);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!choice || health?.locked) {
      setWindows([]);
      setWindowId(undefined);
      return;
    }
    let active = true;
    setWindows([]);
    setWindowId(undefined);
    post("mac/windows", { app: choice })
      .then((r) => {
        if (active) {
          setWindows(r.windows);
          const preferred =
            r.windows.find(
              (w: { title: string }) => !w.title.includes("Skyrail"),
            ) || r.windows[0];
          setWindowId(preferred?.id);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [choice, health?.locked, windowRefresh]);
  useEffect(() => {
    if (lease.app) setChoice(lease.app);
  }, [lease.app]);
  async function action(name: string, fn: () => Promise<void>) {
    setPending(name);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending("");
    }
  }
  async function control(owner: string) {
    await action("control", async () =>
      onSnapshot(
        await post("control", {
          threadId: selected,
          expectedEpoch: lease.epoch,
          owner,
          clientId,
        }),
      ),
    );
  }
  const source =
    belongs && visible
      ? `/v1/mac/stream?threadId=${encodeURIComponent(selected)}&app=${encodeURIComponent(lease.app!)}&retry=${retry}`
      : undefined;
  const label = !belongs
    ? "未连接"
    : lease.transitioning
      ? "正在交接…"
      : lease.owner === "agent"
        ? running
          ? "Codex 正在执行任务"
          : "已交给 Codex"
        : lease.owner === "human"
          ? lease.humanClientId === clientId
            ? "由你操作 Mac"
            : "另一页面已接管"
          : "操作已暂停";
  if (view === "desktop")
    return (
      <section className="computer desktop-primary" aria-label="电脑工作区">
        <RemoteDesktop
          embedded
          visible={workspaceVisible}
          post={post}
          clientId={clientId}
          locked={health?.locked}
          onClose={collapse}
          onStopReady={onStopReady}
        />
      </section>
    );
  return (
    <section className="computer" aria-label="Codex 应用连接设置">
      <div className="app-tools-back">
        <button onClick={() => setView("desktop")}>
          <Icon name="back" size={17} />
          返回整台 Mac
        </button>
        <span>Codex 应用工具</span>
      </div>
      <div className="workspace-top">
        <div className="workspace-title">
          <span className={"stream-dot " + (live ? "live" : "")} />
          <strong>{belongs ? appName : "你的 Mac"}</strong>
          <span className="stream-badge">
            {!belongs
              ? "选择应用"
              : live
                ? "实时串流"
                : stream?.status === "connecting"
                  ? "正在连接"
                  : "画面已断开"}
          </span>
        </div>
        <div>
          <button
            className="icon-button"
            onClick={() => showSettings(!settings)}
            aria-expanded={settings}
            aria-label="应用与权限"
            title="应用与权限"
          >
            <Icon name="settings" size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => setFull(!full)}
            aria-label={full ? "返回分栏" : "放大电脑"}
            title={full ? "返回分栏" : "放大电脑"}
          >
            <Icon name="expand" size={18} />
          </button>
          <button
            className="icon-button"
            onClick={collapse}
            aria-label="返回对话"
            title="返回对话"
          >
            <Icon name="close" size={18} />
          </button>
          {lease.app && (
            <button
              disabled={pending === "disconnect"}
              onClick={() =>
                action("disconnect", async () => {
                  onSnapshot(
                    await post("mac/disconnect", {
                      threadId: lease.threadId,
                      expectedEpoch: lease.epoch,
                    }),
                  );
                  showSettings(true);
                })
              }
            >
              {pending === "disconnect" ? "正在断开…" : "断开窗口"}
            </button>
          )}
        </div>
      </div>
      <RemoteDesktop
        post={post}
        clientId={clientId}
        locked={health?.locked}
        onClose={() => {
          showSettings(true);
          void action("detect", async () => {
            const [h, a] = await Promise.all([
              post("mac/health"),
              post("mac/apps"),
            ]);
            setHealth(h);
            setApps(a.apps);
            refreshWindows((n) => n + 1);
          });
        }}
      />
      {settings && (
        <div className="mac-setup">
          <div className="setup-heading">
            <strong>连接本机应用</strong>
            <button
              disabled={!!pending}
              onClick={() =>
                action("detect", async () => {
                  const [h, a] = await Promise.all([
                    post("mac/health"),
                    post("mac/apps"),
                  ]);
                  setHealth(h);
                  setApps(a.apps);
                  refreshWindows((n) => n + 1);
                })
              }
            >
              刷新列表
            </button>
          </div>
          <div className="app-picker">
            <select
              aria-label="选择 Mac 应用"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">选择一个已打开的应用</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              className="primary"
              disabled={!!pending || !choice || !windowId || health?.locked}
              onClick={() =>
                action("bind", async () => {
                  const id = await ensureThread();
                  onSnapshot(
                    await post("mac/bind", {
                      app: choice,
                      threadId: id,
                      windowId,
                      clientId,
                    }),
                  );
                  setRetry((n) => n + 1);
                  showSettings(false);
                })
              }
            >
              {pending === "bind"
                ? "正在连接…"
                : belongs && choice === lease.app
                  ? "重新连接"
                  : "连接应用"}
            </button>
          </div>
          {windows.length > 0 && (
            <select
              className="window-picker"
              aria-label="选择应用窗口"
              value={windowId || ""}
              onChange={(e) => setWindowId(Number(e.target.value))}
            >
              {windows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title || "未命名窗口"}
                  {w.title.includes("Skyrail")
                    ? "（当前工作台，会出现镜像）"
                    : ""}
                </option>
              ))}
            </select>
          )}
          {health && (
            <div className="permission-status">
              <span>屏幕录制 {health.screenRecording ? "✓" : "未授权"}</span>
              <span>辅助功能 {health.accessibility ? "✓" : "未授权"}</span>
              {health.locked && <span>Mac 已锁屏</span>}
              {health.activeDisplays === 0 && (
                <span>显示器已休眠 / 不可用</span>
              )}
              {(!health.accessibility || !health.screenRecording) && (
                <button
                  onClick={() =>
                    action("permissions", async () =>
                      setHealth(await post("mac/permissions")),
                    )
                  }
                >
                  前往授权
                </button>
              )}
            </div>
          )}
          <p className="setup-help">
            {health?.locked
              ? "可通过上方“人工解锁”连接系统桌面。解锁后再选择应用，继续原对话。"
              : "只共享所选应用的窗口。接管后，可直接在画面里点击、拖动、滚动和输入。"}
          </p>
        </div>
      )}
      {error && (
        <div className="workspace-error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="关闭错误提示">
            ×
          </button>
        </div>
      )}
      {belongs && lease.frame?.windowTitle?.includes("Skyrail") && (
        <div className="mirror-notice">
          正在共享工作台自身，会出现镜像。可在“应用与权限”中改选其他窗口。
        </div>
      )}
      <div className="live-viewport">
        {belongs ? (
          <>
            <InteractiveImage
              src={source}
              name={appName}
              enabled={false}
              epoch={lease.epoch}
              threadId={selected}
              clientId={clientId}
              post={post}
              onError={setError}
              takeControl={() => setView("desktop")}
            />
            {(!live || !visible) && (
              <div className="stream-overlay">
                <span className="stream-symbol">
                  <Icon name="monitor" size={34} />
                </span>
                <h2>
                  {!visible
                    ? "已暂停观看"
                    : stream?.status === "disconnected"
                      ? "画面连接已断开"
                      : "正在连接窗口…"}
                </h2>
                <p>{stream?.error || "首次画面到达后会自动显示。"}</p>
                <button
                  className="primary"
                  onClick={() => {
                    setError("");
                    setRetry((n) => n + 1);
                  }}
                >
                  重新连接画面
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="workspace-empty">
            <span className="stream-symbol">
              <Icon name="monitor" size={34} />
            </span>
            <h2>
              {health?.locked
                ? "Mac 当前已锁屏"
                : lease.app
                  ? "这台电脑属于另一段对话"
                  : "把 Mac 窗口带进对话"}
            </h2>
            <p>
              {health?.locked
                ? "通过上方“人工解锁”进入系统桌面；解锁后重新连接应用。"
                : lease.app
                  ? "切回原对话继续观看，或为当前对话连接应用。"
                  : "选择应用后，画面会持续更新。收起面板只停止观看。"}
            </p>
            {lease.threadId && (
              <button onClick={() => switchThread(lease.threadId!)}>
                切回对应对话
              </button>
            )}
            <button className="primary" onClick={() => showSettings(true)}>
              选择应用
            </button>
          </div>
        )}
      </div>
      <div className="stream-caption">
        <span>
          {live ? "● 画面连接正常" : "○ 等待画面"}
          {live && stream && stream.fps > 0 ? ` · ${stream.fps} 帧/秒` : ""}
        </span>
        <span>
          {lease.owner === "human" && lease.humanClientId === clientId
            ? "可直接点击与输入"
            : "接管后可直接操作画面"}
        </span>
      </div>
      {approvals
        ?.filter((a) => a.threadId === selected)
        .map((a) => (
          <div className="approval" key={a.id}>
            <div>
              <strong>Codex 请求操作</strong>
              <p>{actionLabel(a.args)}</p>
            </div>
            <div>
              <button
                disabled={!!pending}
                onClick={() =>
                  action("approval", async () => {
                    await post("approval", { id: a.id, allow: false });
                  })
                }
              >
                拒绝
              </button>
              <button
                className="primary"
                disabled={!!pending}
                onClick={() =>
                  action("approval", async () => {
                    await post("approval", { id: a.id, allow: true });
                  })
                }
              >
                允许本次
              </button>
            </div>
          </div>
        ))}
      {belongs && (
        <div className="confirmation-mode">
          <label htmlFor="operation-mode">操作确认</label>
          <select
            id="operation-mode"
            value={lease.approvalMode || "ask"}
            disabled={!!pending || lease.transitioning}
            onChange={(e) => {
              const mode = e.target.value;
              action("policy", async () =>
                onSnapshot(
                  await post("mac/policy", {
                    threadId: selected,
                    expectedEpoch: lease.epoch,
                    sessionId: lease.sessionId,
                    mode,
                  }),
                ),
              );
            }}
          >
            <option value="ask">每次操作确认</option>
            <option value="allow_session">本次连接允许全部操作</option>
          </select>
          <small>
            {lease.approvalMode === "allow_session"
              ? "全部操作已允许 · 换应用或断开后失效"
              : "可在授权卡中一次允许后续操作"}
          </small>
        </div>
      )}
      <div className="control">
        <div>
          <strong>{label}</strong>
          <small>
            {belongs
              ? lease.owner === "human" && lease.humanClientId === clientId
                ? "可在画面里点击、滚动和输入"
                : "接管后才能在画面中输入"
              : "电脑与当前对话绑定后才能操作"}
          </small>
        </div>
        <div>
          <button
            disabled={!belongs || lease.transitioning || pending === "control"}
            onClick={() => control("none")}
          >
            暂停操作
          </button>
          <button
            className="primary"
            disabled={!belongs || lease.transitioning || pending === "control"}
            onClick={() => {
              if (lease.owner !== "human" || lease.humanClientId !== clientId)
                setView("desktop");
              else void control("agent");
            }}
          >
            {lease.transitioning
              ? "正在交接…"
              : lease.owner !== "human" || lease.humanClientId !== clientId
                ? "人工接管"
                : "交给 Codex"}
          </button>
        </div>
      </div>
    </section>
  );
}
