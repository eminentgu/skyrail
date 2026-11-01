import React, { useEffect, useRef, useState } from "react";
import type RFB from "@novnc/novnc";
import { flushSync } from "react-dom";
import { Icon } from "./Icon";
type Props = {
  post: (path: string, data?: object) => Promise<any>;
  clientId: string;
  locked?: boolean;
  onClose: () => void;
  embedded?: boolean;
  visible?: boolean;
  onStopReady?: (stop: () => Promise<void>) => void;
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
}: Props) {
  const [open, setOpen] = useState(embedded),
    [stage, setStage] = useState("setup"),
    [error, setError] = useState(""),
    [available, setAvailable] = useState<boolean | null>(null),
    [active, setActive] = useState(false),
    [credentialTypes, setCredentialTypes] = useState<string[]>([]),
    [keyboard, setKeyboard] = useState(false),
    [fit, setFit] = useState(true),
    [pan, setPan] = useState(false),
    [account, setAccount] = useState(""),
    [controller, setController] = useState<"human" | "view">("human"),
    [switching, setSwitching] = useState(false);
  const screen = useRef<HTMLDivElement>(null),
    surface = useRef<HTMLDialogElement>(null),
    user = useRef<HTMLInputElement>(null),
    password = useRef<HTMLInputElement>(null),
    typing = useRef<HTMLInputElement>(null),
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
  const erase = () => {
    for (const value of credentials.current)
      for (const key of Object.keys(value)) delete value[key];
    credentials.current = [];
    if (password.current) password.current.value = "";
    if (user.current) user.current.value = "";
    if (typing.current) typing.current.value = "";
  };
  const disconnect = () => {
    generation.current++;
    const previous = session.current;
    session.current = null;
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
    const heartbeat = setInterval(() => {
      const s = session.current;
      if (!s || !rfb.current) return;
      void postRef
        .current("desktop/renew", { clientId, ticket: s.ticket })
        .catch(() => {
          disconnect();
          setError("连接已过期，请重新连接；未重放任何输入。");
          setStage("disconnected");
        });
    }, 12000);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("pagehide", leave);
      disconnect();
    };
  }, []);
  useEffect(() => {
    if (rfb.current) {
      rfb.current.scaleViewport = fit;
      rfb.current.clipViewport = !fit;
      rfb.current.dragViewport = !fit && pan;
    }
  }, [fit, pan]);

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
    } catch (e) {
      setAvailable(false);
      setError((e as Error).message);
    }
  }
  async function connect() {
    setStage("connecting");
    setError("");
    setCredentialTypes([]);
    const attempt = ++generation.current;
    try {
      const s: Session = await postRef.current("desktop/start", {
        clientId,
        replace: active,
      });
      if (attempt !== generation.current) {
        void postRef
          .current("desktop/stop", { clientId, ticket: s.ticket })
          .catch(() => {});
        return;
      }
      session.current = s;
      const [{ default: Client }, { initLogging }] = await Promise.all([
        import("@novnc/novnc"),
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
      client.resizeSession = false;
      client.focusOnClick = !matchMedia("(pointer:coarse)").matches;
      client.showDotCursor = true;
      client.addEventListener("credentialsrequired", (event) => {
        if (attempt !== generation.current) return;
        const types = (event as CustomEvent<{ types: string[] }>).detail.types;
        if (types.some((t) => !["username", "password"].includes(t))) {
          setError("系统请求了尚不支持的认证方式，请使用系统账户认证。");
          disconnect();
          setStage("disconnected");
          return;
        }
        setCredentialTypes(types);
        setStage("credentials");
      });
      client.addEventListener("connect", () => {
        if (attempt !== generation.current) return;
        erase();
        setStage("live");
        setFit(true);
        setPan(false);
        client.viewOnly = false;
        setController("human");
        client.focus();
      });
      client.addEventListener("securityfailure", () => {
        if (attempt === generation.current)
          setError("系统账户认证失败。请重新连接后检查用户名与密码。");
      });
      client.addEventListener("disconnect", () => {
        if (attempt !== generation.current) return;
        disconnect();
        setStage("disconnected");
        setError(
          (previous) => previous || "全桌面连接已结束。重新连接不会重放按键。",
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
    if (!current || stage !== "live") throw Error("请先连接电脑");
    setSwitching(true);
    setError("");
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
  function sendText(input: HTMLInputElement) {
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
  const content = (
    <>
      <div className="desktop-toolbar">
        <div>
          <span className="eyebrow">你的 MAC</span>
          <strong>我的 Mac</strong>
          <span role="status">
            {stage === "live"
              ? controller === "human"
                ? "已连接 · 可点按操作"
                : "已连接 · 只看画面"
              : stage === "credentials"
                ? "验证 Mac 账户"
                : stage === "connecting"
                  ? "正在连接…"
                  : "尚未连接"}
          </span>
        </div>
        <div>
          <button
            aria-label="全屏"
            onClick={() =>
              (embedded ? inlineSurface.current : surface.current)
                ?.requestFullscreen?.()
                .catch(() =>
                  setError("当前浏览器不支持全屏，请使用横屏或隐藏地址栏。"),
                )
            }
          >
            <Icon name="expand" size={18} />
            <span>全屏</span>
          </button>
          <details className="desktop-menu">
            <summary aria-label="电脑选项">
              <Icon name="settings" size={18} />
            </summary>
            <div>
              <button onClick={() => void close()}>断开连接</button>
              <small>切换对话不会断开或锁屏。</small>
            </div>
          </details>
        </div>
      </div>
      <p className="desktop-privacy">
        点按桌面即可操作，新窗口也在这里。需要打字时，打开下方“输入文字”。
      </p>
      {error && (
        <p className="desktop-error" role="alert">
          {error}
        </p>
      )}
      <div
        className="desktop-screen"
        ref={screen}
        hidden={stage !== "live" && stage !== "connecting"}
      />
      {stage === "credentials" && (
        <form
          className="desktop-form"
          onSubmit={(e) => {
            e.preventDefault();
            const value: Record<string, string> = {};
            if (credentialTypes.includes("username"))
              value.username = user.current?.value || "";
            value.password = password.current?.value || "";
            credentials.current.push(value);
            rfb.current?.sendCredentials(value);
            if (password.current) password.current.value = "";
            setStage("connecting");
          }}
        >
          <span className="desktop-form-icon">
            <Icon name="lock" size={28} />
          </span>
          <span className="eyebrow">连接你的 MAC</span>
          <h2>欢迎回来。</h2>
          <p>
            使用 Mac 的系统账户，不是 Skyrail
            访问密码。系统有时还会显示登录画面，需要再次输入。
          </p>
          {credentialTypes.includes("username") && (
            <label>
              Mac 用户名
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
            Mac 密码
            <input
              ref={password}
              name="mac-password"
              type="password"
              autoComplete="off"
              required
            />
          </label>
          <button className="primary">连接系统桌面</button>
        </form>
      )}
      {["setup", "disconnected"].includes(stage) && (
        <div className="desktop-form">
          <span className="desktop-form-icon">
            <Icon name={available ? "monitor" : "settings"} size={28} />
          </span>
          <span className="eyebrow">你的电脑，随时接续</span>
          <h2>
            {available === null
              ? "正在查找你的 Mac…"
              : available
                ? "连接你的 Mac"
                : "开启屏幕共享"}
          </h2>
          <p>
            {available === null
              ? "正在检查系统屏幕共享服务。"
              : available
                ? "共享整台 Mac 的桌面，直接点按和输入。连接时请选择共享现有桌面。"
                : "在 Mac 上打开「系统设置 → 通用 → 共享 → 屏幕共享」，仅允许你的账户访问。开启后回到这里刷新状态。"}
          </p>
          {available === false && (
            <p>无需启用“任何人请求控制”或单独设置传统 VNC 密码。</p>
          )}
          {active && <p>另一页面仍连接着这台 Mac，可直接切换到当前设备。</p>}
          <div className="desktop-actions">
            <button disabled={available === null} onClick={() => void check()}>
              刷新状态
            </button>
            <button
              className="primary"
              disabled={!available}
              onClick={() => void connect()}
            >
              {active ? "切换到此设备" : "连接 Mac"}
            </button>
          </div>
        </div>
      )}
      {stage === "connecting" && (
        <p className="desktop-connecting" role="status">
          正在等待系统画面…
        </p>
      )}
      {stage === "live" && (
        <div className="desktop-controls">
          <div className="desktop-touch-primary">
            <span>
              <span className="status-dot" />
              {controller === "human"
                ? fit
                  ? "点按操作"
                  : "滑动查看"
                : "只看画面，随时接手"}
            </span>
            <button
              className="desktop-zoom"
              aria-label={fit ? "放大桌面" : "显示完整桌面"}
              onClick={() => {
                setFit(!fit);
                setPan(fit);
              }}
            >
              <Icon name={fit ? "expand" : "monitor"} size={17} />
              {fit ? "放大" : "全览"}
            </button>
            {controller === "view" ? (
              <button
                className="primary"
                disabled={switching}
                onClick={() => void setControl("human").catch(() => {})}
              >
                {switching ? "正在接手…" : "接手操作"}
              </button>
            ) : (
              <button
                className="primary"
                disabled={switching}
                aria-pressed={keyboard}
                onClick={() => {
                  flushSync(() => setKeyboard(!keyboard));
                  if (!keyboard) typing.current?.focus({ preventScroll: true });
                }}
              >
                <Icon name="keyboard" size={18} />
                {keyboard ? "收起键盘" : "输入文字"}
              </button>
            )}
          </div>
          {keyboard && controller === "human" && (
            <div className="desktop-keyboard-area">
              <input
                className="desktop-keyboard"
                ref={typing}
                type="password"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label="远程键盘，输入立即发送且不保留"
                placeholder="在这里输入到 Mac…"
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
                  [0xff0d, "Enter", "回车"],
                  [0xff08, "Backspace", "退格"],
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
            <strong>{locked ? "Mac 已锁屏" : "人工全桌面"}</strong>
            <small>
              {locked
                ? "远程输入密码，解锁后继续原对话"
                : "查看完整桌面或处理系统登录画面"}
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
            {locked ? "人工解锁" : "打开全桌面"}
          </button>
        </div>
      )}
      {embedded ? (
        <section
          className="desktop-inline"
          ref={inlineSurface}
          aria-label="整台 Mac 控制台"
        >
          {content}
        </section>
      ) : (
        open && (
          <dialog
            className="desktop-console"
            ref={surface}
            onCancel={(e) => e.preventDefault()}
            aria-label="人工全桌面控制台"
          >
            {content}
          </dialog>
        )
      )}
    </>
  );
}
