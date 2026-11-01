import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import {
  Conversation,
  type ChatMessage,
  type ChatApproval,
} from "./Conversation";
import { MacWorkspace, type Lease, type StreamState } from "./MacWorkspace";
import { SessionDrawer } from "./SessionDrawer";
import { Icon, BrandMark } from "./Icon";
type Message = ChatMessage;
type Thread = {
  id: string;
  title: string;
  messages: Message[];
  status: string;
  error?: string;
  codexId?: string;
  imported?: boolean;
  syncedAt?: string;
  syncError?: string;
};
type State = {
  desktop?: { active: boolean };
  threads: Thread[];
  deletedThreads?: { id: string; title: string; deletedAt: string }[];
  runtime: string;
  lease: Lease;
  stream?: StreamState;
  approvals?: ChatApproval[];
};
function App() {
  const [state, setState] = useState<State>({
      threads: [],
      runtime: "disconnected",
      lease: { owner: "none", epoch: 0 },
    }),
    [token, setToken] = useState(""),
    [selected, select] = useState(""),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [panel, open] = useState(true),
    [history, showHistory] = useState(false),
    [full, setFull] = useState(false),
    [dark, setDark] = useState(
      () => localStorage.getItem("skyrail.theme") === "dark",
    ),
    [guide, showGuide] = useState(false),
    [deletedId, setDeletedId] = useState(""),
    [copied, setCopied] = useState(false);
  const autoOpened = React.useRef("");
  const stopDesktop = React.useRef<() => Promise<void>>(async () => {});
  const [applicationTools, setApplicationTools] = useState(0);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("skyrail.theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      if (!viewport || viewport.scale !== 1) return;
      document.documentElement.style.setProperty(
        "--app-height",
        viewport.height + "px",
      );
      document.documentElement.classList.toggle(
        "keyboard-open",
        window.innerHeight - viewport.height > 140,
      );
    };
    resize();
    viewport?.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      document.documentElement.style.removeProperty("--app-height");
      document.documentElement.classList.remove("keyboard-open");
    };
  }, []);
  React.useLayoutEffect(() => {
    const field = composerRef.current;
    if (field) {
      field.style.height = "auto";
      field.style.height = Math.min(160, field.scrollHeight) + "px";
    }
  }, [text, panel]);
  const thread = state.threads.find((t) => t.id === selected);
  const localRunning = ["running", "submitting"].includes(thread?.status || "");
  const externalRunning = thread?.status === "external_running";
  const syncing = thread?.status === "syncing";
  const running = localRunning || externalRunning || syncing;
  const sourceRef = React.useRef<EventSource | null>(null);
  const messagesRef = React.useRef<HTMLDivElement | null>(null);
  const follows = React.useRef(true);
  function selectThread(id: string) {
    select(id);
    localStorage.setItem("skyrail.thread", id);
    follows.current = true;
  }
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function attach(initial = false) {
      try {
        const response = await fetch("/v1/bootstrap");
        if (response.status === 401) {
          window.location.assign("/");
          return;
        }
        if (!response.ok) throw Error("bootstrap failed");
        const s = await response.json();
        if (disposed) return;
        setToken(s.token);
        setState(s);
        if (s.runtime !== "connected") {
          try {
            setState({ ...s, runtime: "connecting" });
            const connected = await fetch("/v1/connect", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Skyrail-Token": s.token,
              },
              body: "{}",
            });
            const next = await connected.json();
            if (!connected.ok) throw Error(next.message || "Codex 连接失败");
            if (!disposed) setState(next);
          } catch (e) {
            if (!disposed) {
              setState(s);
              setError("Codex 连接失败：" + (e as Error).message);
            }
          }
        }
        if (initial) {
          const saved = localStorage.getItem("skyrail.thread");
          selectThread(
            s.threads.some((t: Thread) => t.id === saved)
              ? saved
              : s.threads[0]?.id || "",
          );
        }
        sourceRef.current?.close();
        const source = new EventSource("/v1/events");
        sourceRef.current = source;
        source.onmessage = (e) => {
          if (!disposed) setState(JSON.parse(e.data));
        };
        source.onopen = () =>
          setError((e) => (e.startsWith("本地服务") ? "" : e));
        source.onerror = () => {
          source.close();
          if (!disposed) {
            setError("本地服务连接中断，正在重连…");
            timer = setTimeout(() => attach(), 2000);
          }
        };
      } catch {
        if (!disposed) {
          setError("本地服务连接失败，正在重连…");
          timer = setTimeout(() => attach(initial), 3000);
        }
      }
    }
    attach(true);
    return () => {
      disposed = true;
      clearTimeout(timer);
      sourceRef.current?.close();
    };
  }, []);
  React.useLayoutEffect(() => {
    const el = messagesRef.current;
    if (el && follows.current) el.scrollTop = el.scrollHeight;
  }, [thread?.messages.map((m) => m.text).join(""), selected]);
  useEffect(() => {
    if (state.lease.app && state.lease.threadId === selected) {
      const binding = selected + state.lease.app;
      if (autoOpened.current !== binding) {
        autoOpened.current = binding;
        open(true);
      }
    }
  }, [state.lease.app, state.lease.threadId, selected]);
  async function post(path: string, data: object = {}) {
    const r = await fetch("/v1/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Skyrail-Token": token },
      body: JSON.stringify(data),
    });
    if (r.status === 401) {
      window.location.assign("/");
      throw Error("远程登录已过期，请重新登录");
    }
    const s = await r.json();
    if (!r.ok) throw Error(s.message);
    return s;
  }
  useEffect(() => {
    if (!selected || !token || state.runtime !== "connected") return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const r = await fetch("/v1/threads/" + selected + "/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Skyrail-Token": token,
          },
          body: "{}",
        });
        if (r.ok && !disposed) setState(await r.json());
      } catch {
      } finally {
        if (!disposed) timer = setTimeout(refresh, 5000);
      }
    };
    void refresh();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [selected, token, state.runtime]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    await act(async () => setState(await post("connect")));
  }
  async function create() {
    const t = await post("threads");
    selectThread(t.id);
    setState((s) => ({
      ...s,
      threads: s.threads.some((x) => x.id === t.id)
        ? s.threads
        : [t, ...s.threads],
    }));
    return t.id;
  }
  async function deleteThread(id: string) {
    await act(async () => {
      const next = await post(`threads/${id}/delete`);
      setState(next);
      setDeletedId(id);
      if (selected === id) selectThread(next.threads[0]?.id || "");
    });
  }
  async function restoreThread(id: string) {
    await act(async () => {
      const next = await post(`threads/${id}/restore`);
      setState(next);
      setDeletedId("");
      selectThread(id);
      showHistory(false);
    });
  }
  async function send() {
    if (!text.trim() || running || busy || state.runtime !== "connected")
      return;
    const value = text;
    await act(async () => {
      if (state.desktop?.active) await stopDesktop.current();
      const id = selected || (await create());
      try {
        setText("");
        await post(`threads/${id}/messages`, {
          text: value,
          clientMessageId: crypto.randomUUID(),
        });
      } catch (e) {
        setText(value);
        throw e;
      }
    });
  }
  const runtimeLabel =
    state.runtime === "connected"
      ? "已连接"
      : state.runtime === "connecting"
        ? "连接中"
        : "未连接";
  const approvalCount = (state.approvals || []).filter(
    (a) => a.threadId === selected,
  ).length;
  return (
    <div
      className={"app " + (dark ? "dark " : "") + (panel ? "desktop-view" : "")}
    >
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            open(true);
            setFull(false);
          }}
          aria-label="Skyrail 返回电脑"
        >
          <BrandMark />
          <span>
            Skyrail<small>你的 Mac 工作台</small>
          </span>
        </a>
        <nav className="desktop-switch" aria-label="工作区">
          <button aria-pressed={panel} onClick={() => open(true)}>
            <Icon name="monitor" size={18} />
            电脑
          </button>
          <button
            aria-pressed={!panel}
            onClick={() => {
              open(false);
              setFull(false);
            }}
          >
            <Icon name="chat" size={18} />
            Codex
          </button>
        </nav>
        <div className="header-actions">
          {panel && (
            <button
              className="icon-button"
              aria-label="Codex 应用连接设置"
              title="Codex 应用连接设置"
              onClick={() => setApplicationTools((n) => n + 1)}
            >
              <Icon name="settings" size={18} />
            </button>
          )}
          <button
            className="icon-button theme-toggle"
            onClick={() => setDark(!dark)}
            aria-label="切换主题"
            title="切换主题"
          >
            <Icon name={dark ? "sun" : "moon"} />
          </button>
          <button
            className="history-trigger"
            onClick={() => showHistory(true)}
            aria-label="会话管理"
          >
            <Icon name="history" />
            <span>会话</span>
          </button>
          <button
            className="header-new"
            disabled={busy || !token}
            onClick={() =>
              act(async () => {
                await create();
                open(false);
                setFull(false);
              })
            }
            aria-label="新对话"
          >
            <Icon name="plus" size={18} />
            <span>新对话</span>
          </button>
        </div>
      </header>
      {panel && error && (
        <div className="workspace-connection-error" role="alert">
          <span>{error}</span>
          <button onClick={() => window.location.reload()}>刷新连接</button>
        </div>
      )}
      {history && (
        <SessionDrawer
          threads={state.threads}
          deleted={state.deletedThreads}
          selected={selected}
          busy={busy}
          close={() => showHistory(false)}
          create={() =>
            act(async () => {
              await create();
              showHistory(false);
              open(false);
              setFull(false);
            })
          }
          select={(id) => {
            selectThread(id);
            showHistory(false);
            open(false);
            setFull(false);
          }}
          remove={deleteThread}
          restore={restoreThread}
          post={post}
          onImport={(next, id) => {
            setState(next);
            selectThread(id);
            showHistory(false);
            open(false);
            setFull(false);
          }}
        />
      )}
      {deletedId && (
        <div className="undo-toast" role="status">
          <Icon name="check" size={18} />
          <span>对话已移到最近删除</span>
          <button onClick={() => restoreThread(deletedId)}>撤销</button>
          <button
            className="icon-button"
            onClick={() => setDeletedId("")}
            aria-label="关闭撤销提示"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <main className={`${panel ? "split" : ""} ${full ? "full" : ""}`}>
        <section className="chat" aria-label="Codex 对话">
          <div className="conversation-heading">
            <div className="conversation-identity">
              <span className="codex-symbol">
                <Icon name="code" />
              </span>
              <div>
                <span className="eyebrow">与 CODEX 一起</span>
                <h1 title={thread?.title}>
                  {thread?.title || "新的想法，从这里开始"}
                </h1>
              </div>
            </div>
            <div className="conversation-actions">
              <span className={"connection " + state.runtime}>
                <span className="status-dot" />
                {runtimeLabel}
              </span>
              <button
                className="icon-button guide-trigger"
                onClick={() => showGuide(!guide)}
                aria-expanded={guide}
                aria-label="电脑操作指南"
              >
                <Icon name="settings" size={18} />
              </button>
            </div>
          </div>
          {thread?.codexId && (
            <details className="session-details">
              <summary>
                <Icon name="history" size={15} />
                <span>
                  {thread.syncError ? "记录同步遇到问题" : "已关联 Codex 会话"}
                </span>
                <span className="session-state">
                  {thread.syncError
                    ? "查看详情"
                    : syncing
                      ? "同步中"
                      : thread.syncedAt
                        ? "记录已同步"
                        : "等待同步"}
                </span>
                <Icon name="chevron" size={14} />
              </summary>
              <div className="session-bar">
                <code>{thread.codexId}</code>
                <div>
                  <button
                    onClick={() =>
                      act(async () => {
                        await navigator.clipboard.writeText(thread.codexId!);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      })
                    }
                  >
                    <Icon name={copied ? "check" : "copy"} size={15} />
                    {copied ? "已复制" : "复制编号"}
                  </button>
                  <button
                    disabled={busy || localRunning || syncing}
                    onClick={() =>
                      act(async () =>
                        setState(await post(`threads/${selected}/sync`)),
                      )
                    }
                  >
                    <Icon name="refresh" size={15} />
                    同步记录
                  </button>
                </div>
                {thread.syncError && <small>{thread.syncError}</small>}
              </div>
            </details>
          )}
          {guide && (
            <div className="chat-guide">
              <div className="guide-heading">
                <strong>说出任务，让 Codex 动手。</strong>
                <button
                  className="icon-button"
                  onClick={() => showGuide(false)}
                  aria-label="关闭指南"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              <p>
                例如“打开计算器，计算 2 的 10
                次方”。允许应用访问后，可查看画面或随时接管。
              </p>
              <div>
                <button
                  onClick={() => {
                    setText("打开本机计算器，计算 2 的 10 次方");
                    showGuide(false);
                    composerRef.current?.focus();
                  }}
                >
                  试试计算器
                </button>
                <button
                  onClick={() => {
                    open(true);
                    showGuide(false);
                  }}
                >
                  查看电脑
                </button>
              </div>
            </div>
          )}
          <div
            className="messages"
            ref={messagesRef}
            onScroll={() => {
              const el = messagesRef.current;
              if (el)
                follows.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            aria-live="polite"
          >
            {!thread?.messages.length ? (
              <div className="welcome">
                <span className="welcome-mark">
                  <BrandMark />
                </span>
                <p className="eyebrow">从想法，到行动</p>
                <h2>
                  聊一聊，
                  <br />
                  也动手做一做。
                </h2>
                <p className="welcome-description">
                  接着上次的思路，或开始一件新鲜事。
                  <br />
                  你的 Codex 和 Mac，都在这里。
                </p>
                <div className="suggestions">
                  {[
                    {
                      icon: "monitor" as const,
                      title: "让 Mac 动起来",
                      text: "打开本机计算器，计算 2 的 10 次方",
                      detail: "打开应用，一起完成任务",
                    },
                    {
                      icon: "code" as const,
                      title: "梳理一个项目",
                      text: "梳理一个项目的实施计划",
                      detail: "从代码和问题，走到下一步",
                    },
                    {
                      icon: "chat" as const,
                      title: "一起想清楚",
                      text: "帮我比较两种技术方案",
                      detail: "比较方案，理清思路",
                    },
                  ].map((s) => (
                    <button
                      key={s.title}
                      onClick={() => {
                        setText(s.text);
                        composerRef.current?.focus();
                      }}
                    >
                      <span className="suggestion-icon">
                        <Icon name={s.icon} />
                      </span>
                      <span>
                        <strong>{s.title}</strong>
                        <small>{s.detail}</small>
                      </span>
                      <Icon name="chevron" size={17} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Conversation
                messages={thread.messages}
                approvals={(state.approvals || []).filter(
                  (a) => a.threadId === selected,
                )}
                decide={async (id, allow, allowAll) => {
                  await post("approval", { id, allow, allowAll });
                }}
              />
            )}
            {running && (
              <div className="working" role="status">
                <span className="working-dot" />
                {syncing
                  ? "正在同步会话记录"
                  : externalRunning
                    ? "另一端正在执行，记录会自动同步"
                    : approvalCount
                      ? "等待你的操作确认"
                      : "Codex 正在处理"}
              </div>
            )}
            {thread?.error && (
              <p className="error" role="alert">
                {thread.error}
              </p>
            )}
          </div>
          <div className="composer-area">
            {error && (
              <div className="error" role="alert">
                {error}
                <button
                  className="icon-button"
                  aria-label="关闭错误提示"
                  onClick={() => setError("")}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            )}
            {state.runtime !== "connected" && (
              <div className="connect-strip">
                <span>连接本机 Codex，继续你的任务</span>
                <button disabled={busy} onClick={connect}>
                  {busy ? "正在连接…" : "重新连接"}
                </button>
              </div>
            )}
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <textarea
                ref={composerRef}
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  state.desktop?.active
                    ? "输入任务，发送时交还电脑给 Codex"
                    : "说说你想做什么…"
                }
                aria-label="消息"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing &&
                    !matchMedia("(max-width:699px),(pointer:coarse)").matches
                  ) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <div className="composer-tools">
                <span className="composer-context">
                  <span
                    className={
                      "status-dot " +
                      (state.runtime === "connected" ? "" : "offline")
                    }
                  />
                  Codex <span className="composer-separator">/</span> 本机 Mac
                </span>
                <span className="keyboard-shortcut">↵ 发送</span>
                {syncing ? (
                  <button type="button" disabled>
                    同步中
                  </button>
                ) : localRunning ? (
                  <button
                    type="button"
                    className="stop-button"
                    onClick={() =>
                      act(async () => {
                        await post(`threads/${selected}/stop`);
                      })
                    }
                  >
                    <span />
                    停止
                  </button>
                ) : externalRunning ? (
                  <button type="button" disabled>
                    另一端执行中
                  </button>
                ) : (
                  <button
                    className={
                      state.desktop?.active ? "send handoff-send" : "send"
                    }
                    disabled={
                      busy || !text.trim() || state.runtime !== "connected"
                    }
                    aria-label="发送消息"
                  >
                    {state.desktop?.active ? (
                      "交给 Codex"
                    ) : (
                      <Icon name="arrow" size={21} />
                    )}
                  </button>
                )}
              </div>
            </form>
            <p className="footnote">
              <Icon name="lock" size={12} />
              对话与电脑，留在你的掌握中
            </p>
          </div>
        </section>
        <div className={"desk-host " + (!panel ? "is-hidden" : "")}>
          {token ? (
            <MacWorkspace
              running={running}
              lease={state.lease}
              stream={state.stream}
              approvals={[]}
              selected={selected}
              full={full}
              setFull={setFull}
              collapse={() => {
                open(false);
                setFull(false);
              }}
              post={post}
              onSnapshot={setState}
              ensureThread={async () => selected || (await create())}
              switchThread={selectThread}
              visible={panel}
              applicationTools={applicationTools}
              onStopReady={(fn) => {
                stopDesktop.current = fn;
              }}
            />
          ) : (
            <div className="desk-loading" role="status">
              正在连接你的 Mac…
            </div>
          )}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="手机导航">
        <button
          aria-current={panel && !history ? "page" : undefined}
          onClick={() => {
            showHistory(false);
            open(true);
          }}
        >
          <Icon name="monitor" />
          电脑
        </button>
        <button
          aria-current={!panel && !history ? "page" : undefined}
          onClick={() => {
            showHistory(false);
            open(false);
            setFull(false);
          }}
        >
          <span>
            <Icon name="chat" />
            {approvalCount > 0 && <i>{approvalCount}</i>}
          </span>
          Codex
        </button>
        <button
          aria-current={history ? "page" : undefined}
          onClick={() => showHistory(true)}
        >
          <Icon name="history" />
          会话
        </button>
      </nav>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
