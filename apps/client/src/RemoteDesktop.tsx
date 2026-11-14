import { t as ui } from "./i18n";
import React, { useEffect, useRef, useState } from "react";
import type RFB from "./desktop-rfb.mjs";
import { retryDelay } from "./connection.mjs";
import { useDesktopCapture } from "./useDesktopCapture";
import { RemoteSurface } from "./RemoteSurface";
import { flushSync } from "react-dom";
import { StreamStatus } from "./StreamStatus";
import { Icon } from "./Icon";
type Props = {
  post: (path: string, data?: object, signal?: AbortSignal) => Promise<any>;
  clientId: string;
  locked?: boolean;
  onClose: () => void;
  embedded?: boolean;
  visible?: boolean;
  onStopReady?: (stop: () => Promise<void>) => void;
  controlsVisible?: boolean;
};
type Session = { ticket: string; expiresAt: number };
export function RemoteDesktop({
  post,
  clientId,
  locked,
  onClose,
  embedded = false,
  visible = true,
  onStopReady,
  controlsVisible = true,
}: Props) {
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState(false);
  const [credentialStorage, setCredentialStorage] = useState(false);
  const savedRef = useRef(false);
  savedRef.current = savedCredentials;
  const skipSaved = useRef(false);
  const credentialVersion = useRef(0);
  const pendingSave = useRef<Record<string,string> | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [streamMode, setStreamMode] = useState<"auto" | "high" | "smooth">(() => {
    const saved = localStorage.getItem("skyrail.stream-mode");
    return saved === "high" || saved === "smooth" ? saved : "auto";
  });
  const streamModeRef = useRef(streamMode);
  streamModeRef.current = streamMode;
  useEffect(() => {
    localStorage.setItem("skyrail.stream-mode", streamMode);
    rfb.current?.setStreamMode(streamMode);
  }, [streamMode]);
  const slowFrameAt = useRef(0);
  const renewable = useRef(false);
  const zoomAction = useRef<() => void>(() => {});
  const [inputMode, setInputMode] = useState<"trackpad" | "direct">(() =>
    localStorage.getItem("skyrail.input") === "direct" ? "direct" : "trackpad",
  );
  const [open, setOpen] = useState(embedded),
    [stage, setStage] = useState("setup"),
    [error, setError] = useState(""),
    [available, setAvailable] = useState<boolean | null>(null),
    [active, setActive] = useState(false),
    [credentialTypes, setCredentialTypes] = useState<string[]>([]),
    [keyboard, setKeyboard] = useState(false),
    [account, setAccount] = useState(""),
    [controller, setController] = useState<"human" | "view">("human"),
    [switching, setSwitching] = useState(false),
    [quality, setQuality] = useState(1),
    [unstable, setUnstable] = useState(false);
  const screen = useRef<HTMLDivElement>(null),
    surface = useRef<HTMLDialogElement>(null),
    user = useRef<HTMLInputElement>(null),
    password = useRef<HTMLInputElement>(null),
    typing = useRef<HTMLTextAreaElement>(null),
    rfb = useRef<RFB | null>(null),
    session = useRef<Session | null>(null),
    generation = useRef(0),
    credentials = useRef<Record<string, string>[]>([]),
    composing = useRef(false),
    postRef = useRef(post),
    onCloseRef = useRef(onClose);
  postRef.current = post;
  onCloseRef.current = onClose;
  const termination = useRef<Promise<unknown>>(Promise.resolve());
  const inlineSurface = useRef<HTMLElement>(null);
  const closeRef = useRef<() => Promise<void>>(async () => {});
  const capture = useDesktopCapture({
    enabled: visible && stage === "live" && controller === "human" && !switching,
    focus: () => keyboard ? typing.current?.focus({ preventScroll: true }) : rfb.current?.focus(),
    ownsFocus: target => target === screen.current?.querySelector("canvas") || target === typing.current,
    releaseInput: () => rfb.current?.releaseInput(),
    exit: () => {
      if (rfb.current) rfb.current.viewOnly = true;
      void setControl("view").catch(() => {});
    },
  });
  const canInput = visible && stage === "live" && controller === "human" &&
    !switching && (!capture.desktop || capture.captured);
  useEffect(() => {
    if (!controlsVisible) {
      setKeyboard(false);
      typing.current?.blur();
      rfb.current?.releaseInput();
    }
  }, [controlsVisible]);
  const erase = () => {
    for (const value of credentials.current)
      for (const key of Object.keys(value)) delete value[key];
    credentials.current = [];
    if (pendingSave.current) {for (const key of Object.keys(pendingSave.current)) delete pendingSave.current[key];pendingSave.current=null;}
    if (password.current) password.current.value = "";
    if (user.current) user.current.value = "";
    if (typing.current) typing.current.value = "";
  };
  const disconnect = () => {
    generation.current++;
    const previous = session.current;
    session.current = null;
    renewable.current = false;
    rfb.current?.releaseInput();
    rfb.current?.blur();
    rfb.current?.disconnect();
    rfb.current = null;
    screen.current?.replaceChildren();
    erase();
    if (previous)
      termination.current = postRef
        .current("desktop/stop", { clientId, ticket: previous.ticket })
        .catch(() => {});
    return previous;
  };
  useEffect(() => {
    const leave = () => disconnect();
    window.addEventListener("pagehide", leave);
    const visibility = () => rfb.current?.setStreamVisible(visibleRef.current && !document.hidden);
    document.addEventListener("visibilitychange", visibility);
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let tracked: Session | null = null;

    let failures = 0;
    let lastSuccess = Date.now();
    const heartbeat = async () => {
      const current = session.current;
      const client = rfb.current;
      let delay = 5000;
      if (current && client && renewable.current) {
        if (tracked !== current) {
          tracked = current;
          failures = 0;
          lastSuccess = Date.now();
        }
        const began = performance.now();
        try {
          await postRef.current(
            "desktop/renew",
            { clientId, ticket: current.ticket },
            AbortSignal.timeout(6000),
          );
          if (session.current !== current || disposed) {
            if (!disposed) timer = setTimeout(heartbeat, 5000);
            return;
          }
          const elapsed = performance.now() - began;
          lastSuccess = Date.now();
          failures = 0;
          const slow =
            elapsed > 350 || performance.now() - slowFrameAt.current < 6000;
          client.reportNetworkSample(elapsed);
          setUnstable(slow);
        } catch (error) {
          if (session.current !== current || disposed) {
            if (!disposed) timer = setTimeout(heartbeat, 5000);
            return;
          }
          const status = (error as { status?: number }).status;
          if (
            status === 401 ||
            status === 403 ||
            status === 409 ||
            Date.now() >= current.expiresAt ||
            Date.now() - lastSuccess > 90000
          ) {
            disconnect();
            setError(ui("连接已过期，请重新连接；未重放任何输入。"));
            setStage("disconnected");
          }
          client.reportNetworkSample(0, true);
          setUnstable(true);
          delay = retryDelay(failures++);
        }
      }
      if (!disposed) timer = setTimeout(heartbeat, delay);
    };
    timer = setTimeout(heartbeat, 5000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", visibility);
      disconnect();
    };
  }, []);

  useEffect(() => {
    if (!embedded && open && !surface.current?.open)
      surface.current?.showModal();
  }, [open, embedded]);
  useEffect(() => {
    if (embedded) void check();
    onStopReady?.(() => closeRef.current());
  }, []);
  useEffect(() => {
    if (!visible) {
      rfb.current?.blur();
      typing.current?.blur();
      rfb.current?.releasePointer();
    }
  }, [visible]);
  async function check() {
    setError("");
    setAvailable(null);
    try {
      const status = await postRef.current("desktop/status");
      setAvailable(status.available);
      setActive(status.connected || status.active);
      setAccount(status.username || "");
      setSavedCredentials(status.credentials?.saved === true);
      setCredentialStorage(status.credentials?.available === true);
    } catch (e) {
      setAvailable(false);
      setError((e as Error).message);
    }
  }
  async function connect() {
    setStage("connecting");
    setQuality(1);
    setUnstable(false);
    setError("");
    setCredentialTypes([]);
    const attempt = ++generation.current;
    const initialControl = capture.desktop ? "view" : "human";
    try {
      const s: Session = await postRef.current("desktop/start", {
        clientId,
        replace: active,
        mode: initialControl,
      });
      if (attempt !== generation.current) {
        void postRef
          .current("desktop/stop", { clientId, ticket: s.ticket })
          .catch(() => {});
        return;
      }
      session.current = s;
      const [{ default: Client }, { initLogging }] = await Promise.all([
        import("./desktop-rfb.mjs"),
        import("skyrail-novnc-logging"),
      ]);
      initLogging("none");
      if (attempt !== generation.current || !screen.current) return;
      const url = new URL("/v1/desktop/socket", window.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const client = new Client(screen.current, url.href, {
        shared: true,
        wsProtocols: ["binary", "skyrail." + s.ticket],
      });
      rfb.current = client;
      client.scaleViewport = true;
      client.setStreamMode(streamModeRef.current);
      client.setStreamVisible(visibleRef.current && !document.hidden);
      slowFrameAt.current = -Infinity;
      client.addEventListener("skyrail-slow-frame", () => {
        if (attempt !== generation.current) return;
        slowFrameAt.current = performance.now();
        client.reportNetworkSample(0, true);
        setUnstable(true);
      });
      client.addEventListener("skyrail-stream-quality", (event) => {
        if (attempt !== generation.current) return;
        const detail = (event as CustomEvent<{level: number; encoding: number | null}>).detail;
        setQuality(detail.level);
      });
      client.resizeSession = false;
      client.focusOnClick = !matchMedia("(pointer:coarse)").matches;
      client.showDotCursor = true;
      let credentialRequestPending=false, triedSaved=false;
      client.addEventListener("credentialsrequired", async (event) => {
        if (attempt !== generation.current) return;
        if (credentialRequestPending) return;
        const types = (event as CustomEvent<{ types: string[] }>).detail.types;
        if (types.some((t) => !["username", "password"].includes(t))) {
          setError(ui("系统请求了尚不支持的认证方式，请使用系统账户认证。"));
          disconnect();
          setStage("disconnected");
          return;
        }
        renewable.current = true;
        setCredentialTypes(types);
        if (savedRef.current && !skipSaved.current && !triedSaved) {
          triedSaved=true;credentialRequestPending=true;
          try {
            const stored = await postRef.current("desktop/credentials", {clientId,ticket:s.ticket});
            if (attempt !== generation.current) return;
            if (stored.saved && stored.credentials?.password) {
              const value:Record<string,string> = {password:stored.credentials.password};
              if (types.includes("username")) value.username=stored.credentials.username || account;
              credentials.current.push(value);
              client.sendCredentials(value);
              return;
            }
          } catch { /* A locked Keychain falls back to the explicit form. */ }
          finally {credentialRequestPending=false;}
        }
        if (attempt === generation.current) setStage("credentials");
      });
      client.addEventListener("connect", () => {
        if (attempt !== generation.current) return;
        renewable.current = true;
        const toSave=pendingSave.current;
        pendingSave.current=null;
        erase();
        const saveVersion=credentialVersion.current;
        if (toSave) void postRef.current("desktop/credentials/save", {clientId,ticket:s.ticket,credentials:toSave})
          .then(() => {if(saveVersion===credentialVersion.current){setSavedCredentials(true);skipSaved.current=false;}})
          .catch(() => setError(ui("已连接，但钥匙串保存失败；下次请手动输入。")))
          .finally(() => {for(const key of Object.keys(toSave))delete toSave[key];});
        setStage("live");

        client.viewOnly = initialControl === "view" || !visibleRef.current;
        setController(initialControl);
        if (initialControl === "human" && visibleRef.current) client.focus();
        else client.blur();
      });
      client.addEventListener("securityfailure", () => {
        if (attempt === generation.current) {
          skipSaved.current=true;
          setError(ui("系统账户认证失败。请重新连接后检查用户名与密码。"));
        }
      });
      client.addEventListener("disconnect", () => {
        if (attempt !== generation.current) return;
        disconnect();
        setStage("disconnected");
        setError(
          (previous) =>
            previous || ui("全桌面连接已结束。重新连接不会重放按键。"),
        );
      });
    } catch (e) {
      if (attempt === generation.current) {
        disconnect();
        setStage("disconnected");
        setError((e as Error).message);
      }
    }
  }
  async function setControl(mode: "view" | "human") {
    const current = session.current;
    if (!current || stage !== "live") throw Error(ui("请先连接电脑"));
    setSwitching(true);
    setError("");
    rfb.current?.releaseInput();
    rfb.current?.blur();
    if (rfb.current) rfb.current.viewOnly = true;
    setKeyboard(false);
    if (typing.current) typing.current.value = "";
    try {
      await postRef.current("desktop/control", {
        clientId,
        ticket: current.ticket,
        mode,
      });
      setController(mode);
      if (rfb.current) rfb.current.viewOnly = mode === "view";
      if (mode === "human") capture.capture();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setSwitching(false);
    }
  }
  async function handoff() {
    if (stage === "live") {
      if (controller !== "view") await setControl("view");
      return;
    }
    if (session.current) {
      disconnect();
      setStage("setup");
      await termination.current;
    }
  }
  async function close() {
    disconnect();
    if (!embedded) setOpen(false);
    setKeyboard(false);
    setStage("setup");
    const target = embedded ? inlineSurface.current : surface.current;
    if (document.fullscreenElement === target) void document.exitFullscreen();
    await termination.current;
    onCloseRef.current();
  }
  closeRef.current = handoff;
  function sendText(input: HTMLTextAreaElement) {
    const value = input.value;
    input.value = "";
    if (stage !== "live" || controller !== "human" || switching) return;
    for (const character of value) {
      const code = character.codePointAt(0)!;
      rfb.current?.sendKey(code <= 255 ? code : 0x01000000 | code);
    }
  }
  function key(symbol: number, code: string) {
    if (controller === "human" && !switching)
      rfb.current?.sendKey(symbol, code);
  }
  useEffect(() => {
    localStorage.setItem("skyrail.input", inputMode);
  }, [inputMode]);
  useEffect(() => {
    if (rfb.current) {
      rfb.current.viewOnly = !canInput;
      rfb.current.setStreamVisible(visible && !document.hidden);
    }
  }, [canInput, visible]);
  const content = (
    <>
      <div className="desktop-toolbar">
        <div>
          <span className="eyebrow">{ui("你的 MAC")}</span>
          <strong>{ui("我的 Mac")}</strong>
          <span role="status">
            {stage === "live"
              ? controller === "human"
                ? ui("已连接 · 可操作")
                : ui("已连接 · 只看画面")
              : stage === "credentials"
                ? ui("验证 Mac 账户")
                : stage === "connecting"
                  ? ui("正在连接…")
                  : ui("尚未连接")}
          </span>
        </div>
        <div>
          <button
            aria-label={ui("全屏")}
            onClick={() =>
              (embedded ? inlineSurface.current : surface.current)
                ?.requestFullscreen?.()
                .catch(() =>
                  setError(
                    ui("当前浏览器不支持全屏，请使用横屏或隐藏地址栏。"),
                  ),
                )
            }
          >
            <Icon name="expand" size={18} />
            <span>{ui("全屏")}</span>
          </button>
          <details className="desktop-menu">
            <summary aria-label={ui("电脑选项")}>
              <Icon name="settings" size={18} />
            </summary>
            <div>
              <label>
                {ui("画质与流畅度")}
                <select aria-label={ui("串流模式")} value={streamMode}
                  onChange={e => setStreamMode(e.target.value as "auto" | "high" | "smooth")}>
                  <option value="auto">{ui("自动适应网络")}</option>
                  <option value="high">{ui("高清优先")}</option>
                  <option value="smooth">{ui("连接优先")}</option>
                </select>
              </label>
              <small>{ui(streamMode === "high" ? "保持高清；弱网时可能更慢。" : streamMode === "smooth" ? "降低画质与帧率，优先保持响应。" : "网络变慢立即降级，稳定后逐步恢复。")}</small>
              <label>
                {ui("手机操作")}
                <select
                  aria-label={ui("手机操作方式")}
                  value={inputMode}
                  onChange={(e) =>
                    setInputMode(e.target.value as "trackpad" | "direct")
                  }
                >
                  <option value="trackpad">{ui("触控板：滑动移光标")}</option>
                  <option value="direct">{ui("直接点按目标")}</option>
                </select>
              </label>
              <small>
                {ui(
                  "轻点单击，连点双击；连点后按住可拖拽。双指缩放或移动画面。",
                )}
              </small>
              {savedCredentials && <button onClick={() => {
                credentialVersion.current++;
                void postRef.current("desktop/credentials/forget").then(() => {setSavedCredentials(false);skipSaved.current=false;}).catch(e=>setError(e.message));
              }}>{ui("忘记连接凭据")}</button>}
              <button onClick={() => void close()}>{ui("断开连接")}</button>
              <small>{ui("切换对话不会断开或锁屏。")}</small>
            </div>
          </details>
        </div>
      </div>
      {stage === "live" && controlsVisible && <StreamStatus
        label={unstable ? ui("连接不稳定") : quality === 0 ? ui("低带宽")
          : quality === 2 ? ui("高清画质") : ui("自动画质")}
        warning={unstable}
      >
        <div className="stream-mode-shortcuts" role="group" aria-label={ui("快速切换画质")}>
          {(["auto", "high", "smooth"] as const).map(mode => <button key={mode}
            aria-pressed={streamMode === mode} onClick={() => setStreamMode(mode)}>
            {ui(mode === "auto" ? "自动" : mode === "high" ? "高清优先" : "连接优先")}
          </button>)}
        </div>
      </StreamStatus>}
      <p className="desktop-privacy">
        {capture.desktop
          ? canInput ? ui("鼠标和键盘已接管 · Esc 退出") : ui("点击接管后，鼠标和键盘将用于操作 Mac")
          : ui("滑动移动光标，轻点单击，连点双击。双指缩放画面。")}
      </p>
      {error && (
        <p className="desktop-error" role="alert">
          {error}
        </p>
      )}
      <div
        className="desktop-screen-wrap"
        hidden={stage !== "live" && stage !== "connecting"}
      >
        <RemoteSurface
          enabled={canInput}
          visible={visible && stage === "live"}
          mode={inputMode}
          frame={() =>
            screen.current?.querySelector("canvas")?.getBoundingClientRect() ||
            null
          }
          send={(input) => rfb.current?.sendPointer(input)}
          onCancel={() => rfb.current?.releasePointer()}
          onFocus={() => rfb.current?.focus()}
          onZoomReady={(fn) => {
            zoomAction.current = fn;
          }}
          resetKey={stage}
        >
          <div className="desktop-screen" ref={screen} />
        </RemoteSurface>
      </div>
      {stage === "credentials" && (
        <form
          className="desktop-form"
          onSubmit={(e) => {
            e.preventDefault();
            const value: Record<string, string> = {};
            if (credentialTypes.includes("username"))
              value.username = user.current?.value || "";
            value.password = password.current?.value || "";
            if (rememberCredentials && credentialStorage)
              pendingSave.current={username:value.username || "",password:value.password};
            credentials.current.push(value);
            rfb.current?.sendCredentials(value);
            if (password.current) password.current.value = "";
            setStage("connecting");
          }}
        >
          <span className="desktop-form-icon">
            <Icon name="lock" size={28} />
          </span>
          <span className="eyebrow">{ui("连接你的 MAC")}</span>
          <h2>{ui("欢迎回来。")}</h2>
          <p>
            {ui(
              "这是屏幕共享连接认证，与锁屏解锁不同。记住后可自动连接；锁屏密码仍在远程画面里输入。",
            )}
          </p>
          {credentialTypes.includes("username") && (
            <label>
              {ui("Mac 用户名")}
              <input
                ref={user}
                name="mac-user"
                defaultValue={account}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>
          )}
          <label>
            {ui(credentialTypes.includes("username") ? "Mac 密码" : "屏幕共享密码")}
            <input
              ref={password}
              name="mac-password"
              type="password"
              autoComplete="off"
              required
            />
          </label>
          {credentialStorage && <label className="remember-connection">
            <input type="checkbox" checked={rememberCredentials} onChange={e=>setRememberCredentials(e.target.checked)} />
            <span>{ui("记住连接凭据（本机钥匙串）")}</span>
          </label>}
          <small>{ui("密码不写入浏览器存储或聊天记录。")}</small>
          <button className="primary">{ui("连接系统桌面")}</button>
        </form>
      )}
      {["setup", "disconnected"].includes(stage) && (
        <div className="desktop-form">
          <span className="desktop-form-icon">
            <Icon name={available ? "monitor" : "settings"} size={28} />
          </span>
          <span className="eyebrow">{ui("你的电脑，随时接续")}</span>
          <h2>
            {available === null
              ? ui("正在查找你的 Mac…")
              : available
                ? ui("连接你的 Mac")
                : ui("开启屏幕共享")}
          </h2>
          <p>
            {available === null
              ? ui("正在检查系统屏幕共享服务。")
              : available
                ? ui(
                    "共享整台 Mac 的桌面，直接点按和输入。连接时请选择共享现有桌面。",
                  )
                : ui(
                    "在 Mac 上打开「系统设置 → 通用 → 共享 → 屏幕共享」，仅允许你的账户访问。开启后回到这里刷新状态。",
                  )}
          </p>
          {available === false && (
            <p>{ui("无需启用“任何人请求控制”或单独设置传统 VNC 密码。")}</p>
          )}
          {savedCredentials && <p>{ui("已记住连接凭据，将自动验证屏幕共享。")}</p>}
          {active && (
            <p>{ui("另一页面仍连接着这台 Mac，可直接切换到当前设备。")}</p>
          )}
          <div className="desktop-actions">
            <button disabled={available === null} onClick={() => void check()}>
              {ui("刷新状态")}
            </button>
            <button
              className="primary"
              disabled={!available}
              onClick={() => void connect()}
            >
              {active ? ui("切换到此设备") : ui("连接 Mac")}
            </button>
          </div>
        </div>
      )}
      {stage === "connecting" && (
        <p className="desktop-connecting" role="status">
          {ui("正在等待系统画面…")}
        </p>
      )}
      {stage === "live" && (
        <div className="desktop-controls" hidden={!controlsVisible}>
          <div className="desktop-touch-primary">
            <span>
              <span className="status-dot" />
              {capture.desktop
                ? canInput ? ui("鼠标和键盘已接管 · Esc 退出") : ui("只看画面，随时接手")
                : controller === "human"
                ? inputMode === "trackpad"
                  ? ui("滑动移光标 · 轻点点击")
                  : ui("点按目标 · 滑动移光标")
                : ui("只看画面，随时接手")}
            </span>
            <button
              className="desktop-zoom"
              aria-label={ui("缩放画面")}
              onClick={() => zoomAction.current()}
            >
              <Icon name="expand" size={17} />
              {ui("缩放")}
            </button>
            {controller === "view" || (capture.desktop && !capture.captured) ? (
              <button
                className="primary"
                disabled={switching}
                onClick={() => void setControl("human").catch(() => {})}
              >
                {switching ? ui("正在接手…") : capture.desktop ? ui("接管鼠标和键盘") : ui("接手操作")}
              </button>
            ) : capture.desktop ? (
              <button disabled={switching} onClick={() => void setControl("view").catch(() => {})}>
                {ui("退出接管")} <kbd>Esc</kbd>
              </button>
            ) : (
              <button
                className="primary"
                disabled={switching}
                aria-pressed={keyboard}
                onClick={() => {
                  flushSync(() => setKeyboard(!keyboard));
                  if (!keyboard) typing.current?.focus({ preventScroll: true });
                  else typing.current?.blur();
                }}
              >
                <Icon name="keyboard" size={18} />
                {keyboard ? ui("收起键盘") : ui("输入文字")}
              </button>
            )}
          </div>
          {keyboard && controller === "human" && (
            <div className="desktop-keyboard-area">
              <textarea
                rows={1}
                className="desktop-keyboard"
                ref={typing}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label={ui("远程键盘，输入立即发送且不保留")}
                placeholder={ui("在这里输入到 Mac…")}
                onCompositionStart={() => {
                  composing.current = true;
                }}
                onCompositionEnd={(e) => {
                  composing.current = false;
                  sendText(e.currentTarget);
                }}
                onChange={(e) => {
                  if (!composing.current) sendText(e.currentTarget);
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === "Enter" || e.key === "Backspace") {
                    e.preventDefault();
                    key(e.key === "Enter" ? 0xff0d : 0xff08, e.key);
                  }
                }}
              />
              <div className="desktop-special-keys">
                {[
                  [0xff09, "Tab", "Tab"],
                  [0xff0d, "Enter", ui("回车")],
                  [0xff08, "Backspace", ui("退格")],
                  [0xff1b, "Escape", "Esc"],
                ].map(([symbol, code, label]) => (
                  <button
                    key={code}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => key(Number(symbol), String(code))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
  return (
    <>
      {!embedded && (
        <div className="desktop-entry">
          <span className="desktop-entry-icon">
            <Icon name={locked ? "lock" : "monitor"} />
          </span>
          <div>
            <strong>{locked ? ui("Mac 已锁屏") : ui("人工全桌面")}</strong>
            <small>
              {locked
                ? ui("远程输入密码，解锁后继续原对话")
                : ui("查看完整桌面或处理系统登录画面")}
            </small>
          </div>
          <button
            className="primary"
            onClick={() => {
              setOpen(true);
              setStage("setup");
              void check();
            }}
          >
            {locked ? ui("人工解锁") : ui("打开全桌面")}
          </button>
        </div>
      )}
      {embedded ? (
        <section
          className={"desktop-inline stage-" + stage + (keyboard ? " keyboard-expanded" : "") + (canInput && capture.desktop ? " remote-captured" : "")}
          ref={inlineSurface}
          aria-label={ui("整台 Mac 控制台")}
        >
          {content}
        </section>
      ) : (
        open && (
          <dialog
            className="desktop-console"
            ref={surface}
            onCancel={(e) => e.preventDefault()}
            aria-label={ui("人工全桌面控制台")}
          >
            {content}
          </dialog>
        )
      )}
    </>
  );
}
