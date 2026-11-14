import { ComputerDock } from "./ComputerDock";
import { retryDelay } from "./connection.mjs";
import { getLanguage, setLanguage, t as ui } from "./i18n";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { StreamStatus } from "./StreamStatus";
import { Picture, isPicture } from "./Attachments";
import { useComposerUploads } from "./useComposerUploads";
import { SessionConnection } from "./SessionConnection";
import { FilesPanel, type Attachment } from "./FilesPanel";
import { PermissionSettings } from "./PermissionSettings";
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
  hasEarlier?: boolean;
  status: string;
  error?: string;
  errorCode?: string;
  retryDraft?: { text: string; attachments?: Attachment[] };
  cwd?: string;
  codexId?: string;
  imported?: boolean;
  syncedAt?: string;
  syncError?: string;
};
type State = {
  permissions?: { fullAccess: boolean };
  desktop?: { active: boolean; connected?: boolean };
  threads: Thread[];
  deletedThreads?: { id: string; title: string; deletedAt: string }[];
  runtime: string;
  lease: Lease;
  stream?: StreamState;
  approvals?: ChatApproval[];
};
function App() {
  const [language, changeLanguage] = useState(getLanguage);
  const [network, setNetwork] = useState("connecting");
  const reconnect = React.useRef(() => {});
  const subscribeThread = React.useRef<(id: string) => void>(() => {});
  const [older, setOlder] = useState<{
    thread: string;
    items: Message[];
    more: boolean;
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  useEffect(() => {
    setLanguage(language);
  }, [language]);
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
    [panel, setPanel] = useState(
      () => !matchMedia("(min-width:700px) and (pointer:fine)").matches &&
        localStorage.getItem("skyrail.page") === "computer",
    ),
    [history, showHistory] = useState(false),
    [full, setFull] = useState(false),
    [dark, setDark] = useState(
      () => localStorage.getItem("skyrail.theme") === "dark",
    ),
    [guide, showGuide] = useState(false),
    [deletedId, setDeletedId] = useState(""),
    [copied, setCopied] = useState(false);
  const [filesOpen, showFiles] = useState(false),
    [attachments, setAttachments] = useState<Attachment[]>([]);
  const [desktopLayout, setDesktopLayout] = useState(() =>
    matchMedia("(min-width:700px) and (pointer:fine)").matches);
  const [mobileFloating, setMobileFloating] = useState(() => localStorage.getItem("skyrail.mobile-computer") !== "full");
  const [desktopComputer, setDesktopComputer] = useState<"floating" | "sidebar">(() => localStorage.getItem("skyrail.desktop-computer") === "sidebar" ? "sidebar" : "floating");
  const [computerToolsOpen, setComputerToolsOpen] = useState(false);
  const floating = panel && !full && (desktopLayout ? desktopComputer === "floating" : mobileFloating);
  const computerPage = panel && !floating;
  useEffect(() => { localStorage.setItem("skyrail.mobile-computer", mobileFloating ? "floating" : "full"); }, [mobileFloating]);
  useEffect(() => { localStorage.setItem("skyrail.desktop-computer", desktopComputer); }, [desktopComputer]);
  const [composerExpanded, expandComposer] = useState(false);
  const hasComputer = (!!state.lease.app && state.lease.threadId === selected) ||
    !!state.desktop?.connected;
  function open(value: boolean) {
    setPanel(value);
    if (!value) {setFull(false);setComputerToolsOpen(false);}
  }
  useEffect(() => {
    const media = matchMedia("(min-width:700px) and (pointer:fine)");
    const change = () => {
      setDesktopLayout(media.matches);
      setFull(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const selectedRef = React.useRef(selected);
  selectedRef.current = selected;
  useEffect(() => {
    setAttachments([]);
  }, [selected]);
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
      document.documentElement.style.setProperty("--app-top", viewport.offsetTop + "px");
      document.documentElement.style.setProperty("--app-left", viewport.offsetLeft + "px");
      document.documentElement.style.setProperty(
        "--app-width", viewport.width + "px",
      );
      document.documentElement.classList.toggle(
        "keyboard-open",
        window.innerHeight - viewport.height > 140,
      );
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      for (const name of ["--app-top", "--app-left", "--app-width"]) document.documentElement.style.removeProperty(name);
      document.documentElement.style.removeProperty("--app-height");
      document.documentElement.classList.remove("keyboard-open");
    };
  }, []);
  React.useLayoutEffect(() => {
    const field = composerRef.current;
    if (field) {
      field.style.height = "auto";
      field.style.height = text ? Math.min(140, Math.max(44, field.scrollHeight)) + "px" : "44px";
    }
  }, [text, panel]);
  const thread = state.threads.find((t) => t.id === selected);
  const earlier = older?.thread === selected ? older : null;
  const currentMessages = thread?.messages || [];
  const recentIds = new Set(currentMessages.map((message) => message.id));
  const messages = earlier
    ? [
        ...earlier.items.filter((message) => !recentIds.has(message.id)),
        ...currentMessages,
      ]
    : currentMessages;
  const localRunning = ["running", "submitting"].includes(thread?.status || "");
  const externalRunning = thread?.status === "external_running";
  const syncing = thread?.status === "syncing";
  const running = localRunning || externalRunning || syncing;
  const sourceRef = React.useRef<EventSource | null>(null);
  const messagesRef = React.useRef<HTMLDivElement | null>(null);
  const follows = React.useRef(true);
  function selectThread(id: string) {
    if (selectedRef.current !== id) {
      selectedRef.current = id;
      setOlder(null);
      setLoadingHistory(false);
      subscribeThread.current(id);
    }
    select(id);
    localStorage.setItem("skyrail.thread", id);
    follows.current = true;
  }
  useEffect(() => {
    let disposed = false;
    let initialized = false;
    let busy = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const schedule = () => {
      if (disposed) return;
      setNetwork(navigator.onLine ? "recovering" : "offline");
      clearTimeout(timer);
      if (navigator.onLine) timer = setTimeout(attach, retryDelay(attempts++));
    };
    function subscribe(id: string) {
      sourceRef.current?.close();
      const source = new EventSource(
        "/v1/events?compact=1&threadId=" + encodeURIComponent(id),
      );
      sourceRef.current = source;
      source.onmessage = (event) => {
        if (disposed || sourceRef.current !== source) return;
        setState(JSON.parse(event.data));
        attempts = 0;
        setNetwork("online");
      };
      source.addEventListener("stream", (event) => {
        if (!disposed && sourceRef.current === source)
          setState((previous) => ({
            ...previous,
            stream: JSON.parse((event as MessageEvent).data),
          }));
      });
      source.onerror = () => {
        if (sourceRef.current !== source) return;
        source.close();
        schedule();
      };
    }
    subscribeThread.current = (id) => {
      if (initialized && !busy && navigator.onLine) subscribe(id);
    };
    async function attach() {
      if (busy || disposed) return;
      if (!navigator.onLine) {
        schedule();
        return;
      }
      busy = true;
      try {
        const response = await fetch("/v1/bootstrap?compact=1&threadId=", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8000),
          ]),
        });
        if (response.status === 401) {
          window.location.assign("/");
          return;
        }
        if (!response.ok) throw Error("Bootstrap unavailable");
        const snapshot = await response.json();
        if (disposed) return;
        setToken(snapshot.token);
        setState((previous) => ({
          ...snapshot,
          threads: snapshot.threads.map((entry: Thread) => ({
            ...entry,
            messages:
              previous.threads.find((existing) => existing.id === entry.id)
                ?.messages || [],
          })),
        }));
        if (!initialized) {
          initialized = true;
          const saved = localStorage.getItem("skyrail.thread");
          selectThread(
            snapshot.threads.some((thread: Thread) => thread.id === saved)
              ? saved
              : snapshot.threads[0]?.id || "",
          );
        }
        if (snapshot.runtime !== "connected" && attempts === 0) {
          try {
            const response = await fetch("/v1/connect", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Skyrail-Token": snapshot.token,
                "X-Skyrail-Thread": selectedRef.current,
              },
              body: "{}",
              signal: AbortSignal.any([
                controller.signal,
                AbortSignal.timeout(12000),
              ]),
            });
            if (response.ok && !disposed) setState(await response.json());
          } catch {
            /* The manual Codex connect action remains available. */
          }
        }
        if (disposed) return;
        subscribe(selectedRef.current);
      } catch {
        schedule();
      } finally {
        busy = false;
      }
    }
    const retry = () => {
      clearTimeout(timer);
      sourceRef.current?.close();
      void attach();
    };
    reconnect.current = retry;
    window.addEventListener("online", retry);
    window.addEventListener("offline", schedule);
    void attach();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
      sourceRef.current?.close();
      window.removeEventListener("online", retry);
      window.removeEventListener("offline", schedule);
    };
  }, []);
  async function loadEarlier() {
    if (loadingHistory || !messages[0]?.id) return;
    const id = selected;
    const list = messagesRef.current;
    const before = list?.scrollHeight || 0;
    const scroll = list?.scrollTop || 0;
    setLoadingHistory(true);
    follows.current = false;
    try {
      const query = new URLSearchParams({
        threadId: id,
        before: messages[0].id,
      });
      const response = await fetch("/v1/history?" + query);
      if (!response.ok) throw Error(ui("无法读取较早记录"));
      const page = await response.json();
      if (selectedRef.current !== id) return;
      setOlder({
        thread: id,
        items: [...page.messages, ...messages],
        more: page.hasEarlier,
      });
      requestAnimationFrame(() => {
        if (list && selectedRef.current === id)
          list.scrollTop = scroll + list.scrollHeight - before;
      });
    } catch (error) {
      if (selectedRef.current === id) setError((error as Error).message);
    } finally {
      if (selectedRef.current === id) setLoadingHistory(false);
    }
  }
  React.useLayoutEffect(() => {
    const el = messagesRef.current;
    if (el && follows.current) el.scrollTop = el.scrollHeight;
  }, [messages.map((m) => m.text).join(""), selected, panel]);
  useEffect(() => {
    localStorage.setItem("skyrail.page", panel ? "computer" : "chat");
  }, [panel]);
  const appSession = state.lease.owner === "agent" && state.lease.threadId === selected
    ? state.lease.sessionId : null;
  useEffect(() => {
    if (appSession && desktopLayout) setPanel(true);
  }, [appSession, desktopLayout]);
  const computerActivity = messages.filter(message =>
    message.role === "tool" && message.action &&
      ["running", "waiting_approval"].includes(message.status || "")).at(-1)?.id;
  useEffect(() => {
    if (computerActivity && desktopLayout) setPanel(true);
  }, [computerActivity, desktopLayout]);
  async function post(path: string, data: object = {}, signal?: AbortSignal) {
    const r = await fetch("/v1/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Skyrail-Token": token,
        "X-Skyrail-Thread": selectedRef.current,
      },
      body: JSON.stringify(data),
      signal:
        signal ??
        (path === "mac/input" || path === "mac/release"
          ? AbortSignal.timeout(8000)
          : undefined),
    });
    if (r.status === 401) {
      window.location.assign("/");
      throw Error(ui("远程登录已过期，请重新登录"));
    }
    const s = await r.json();
    if (!r.ok)
      throw Object.assign(Error(ui(s.message || "请求失败")), {
        status: r.status,
      });
    return s;
  }
  useEffect(() => {
    if (
      !selected ||
      !token ||
      state.runtime !== "connected" ||
      network !== "online" ||
      (panel && !matchMedia("(min-width:1100px)").matches)
    )
      return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        if (document.hidden) return;
        const r = await fetch("/v1/threads/" + selected + "/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Skyrail-Token": token,
            "X-Skyrail-Thread": selected,
          },
          body: "{}",
        });
        if (r.ok && !disposed) setState(await r.json());
      } catch {
      } finally {
        if (!disposed) timer = setTimeout(refresh, 12000);
      }
    };
    void refresh();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [selected, token, state.runtime, network, panel]);
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
    if (
      (!text.trim() && !attachments.length) ||
      running ||
      busy ||
      imageUploads.uploading ||
      network !== "online" ||
      state.runtime !== "connected"
    )
      return;
    const value = text;
    const attached = attachments;
    await act(async () => {
      if (state.desktop?.active) await stopDesktop.current();
      const id = selected || (await create());
      try {
        setText("");
        await post(`threads/${id}/messages`, {
          text: value,
          attachments: attached.map(({ root, path }) => ({ root, path })),
          clientMessageId: crypto.randomUUID(),
        });
        setAttachments([]);
      } catch (e) {
        setText(value);
        throw e;
      }
    });
  }
  const imagePicker = React.useRef<HTMLInputElement>(null);
  function addAttachment(file: Attachment) {
    if (selectedRef.current === file.threadId)
      setAttachments((a) =>
        a.some((f) => f.root === file.root && f.path === file.path)
          ? a
          : [...a, file],
      );
  }
  const imageUploads = useComposerUploads({
    token,
    selected,
    attachmentCount: attachments.length,
    ensureThread: create,
    currentThread: () => selectedRef.current,
    attach: addAttachment,
    onError: setError,
  });
  const writerBusy =
    !!thread?.codexId &&
    (thread.errorCode === "writer_busy" ||
      /active writer|另一客户端占用/.test(thread.error || "") ||
      thread.status === "external_running");
  useEffect(() => {
    if (thread?.retryDraft && writerBusy) {
      setText((previous) => previous || thread.retryDraft!.text);
      setAttachments((previous) =>
        previous.length ? previous : thread.retryDraft!.attachments || [],
      );
    }
  }, [selected, thread?.retryDraft?.text]);
  const runtimeLabel =
    network === "offline"
      ? ui("网络已断开")
      : network === "recovering"
        ? ui("正在恢复连接…")
        : state.runtime === "connected"
          ? ui("已连接")
          : state.runtime === "connecting"
            ? ui("连接中")
            : ui("未连接");
  const approvalCount = (state.approvals || []).filter(
    (a) => a.threadId === selected,
  ).length;
  return (
    <div
      className={"app " + (dark ? "dark " : "") + (computerPage ? "desktop-view" : "") + (floating ? " computer-floating" : "")}
      data-computer-layout={!panel ? "closed" : floating ? "floating" : desktopLayout && !full ? "sidebar" : "full"}
    >
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            open(false);
            setFull(false);
          }}
          aria-label={ui("Skyrail 返回对话")}
        >
          <BrandMark />
          <span>
            Skyrail<small>{ui("你的 Mac 工作台")}</small>
          </span>
        </a>
        <div className="header-actions">
          <button
            className="language-toggle"
            type="button"
            aria-label={ui("切换语言")}
            onClick={() => {
              const next = language === "en" ? "zh-CN" : "en";
              setLanguage(next);
              changeLanguage(next);
            }}
          >
            {language === "en" ? "中文" : "EN"}
          </button>
          <button
            className="icon-button theme-toggle"
            onClick={() => setDark(!dark)}
            aria-label={ui("切换主题")}
            title={ui("切换主题")}
          >
            <Icon name={dark ? "sun" : "moon"} />
          </button>
        </div>
      </header>
      {(network === "offline" || network === "recovering") && (
        <div className="network-status">
          <StreamStatus label={network === "offline" ? ui("网络已断开") : ui("正在恢复连接…")}
            warning retry={network === "recovering" ? () => reconnect.current() : undefined} />
        </div>
      )}
      {panel && error && (
        <div className="workspace-connection-error" role="alert">
          <span>{error}</span>
          <button
            onClick={() => {
              setError("");
              reconnect.current();
            }}
          >
            {ui("刷新连接")}
          </button>
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
          <span>{ui("对话已移到最近删除")}</span>
          <button onClick={() => restoreThread(deletedId)}>{ui("撤销")}</button>
          <button
            className="icon-button"
            onClick={() => setDeletedId("")}
            aria-label={ui("关闭撤销提示")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <main className={`${computerPage ? "split" : ""} ${full ? "full" : ""}`}>
        <section
          className="chat"
          aria-label={ui("Codex 对话")}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDrop={(e) => {
            if (e.dataTransfer.files.length) {
              e.preventDefault();
              void imageUploads.upload(Array.from(e.dataTransfer.files));
            }
          }}
        >
          <div className="conversation-heading">
            <div className="conversation-identity">
              <span className="codex-symbol">
                <Icon name="code" />
              </span>
              <div>
                <span className="eyebrow">{ui("与 CODEX 一起")}</span>
                <h1 title={thread?.title}>
                  {thread?.title === "新对话"
                    ? ui("新对话")
                    : thread?.title || ui("新的想法，从这里开始")}
                </h1>
              </div>
            </div>
            <div className="conversation-actions">
              <span className={"connection " + state.runtime}>
                <span className="status-dot" />
                {runtimeLabel}
              </span>
              <button
                className="manage-conversations"
                onClick={() => showHistory(true)}
                aria-label={ui("管理对话")}
                aria-expanded={history}
              >
                <Icon name="history" size={18} />
                <span>{ui("管理对话")}</span>
              </button>
            </div>
          </div>
          {thread?.codexId && (
            <details className="session-details">
              <summary>
                <Icon name="history" size={15} />
                <span>
                  {thread.syncError
                    ? ui("记录同步遇到问题")
                    : ui("已关联 Codex 会话")}
                </span>
                <span className="session-state">
                  {thread.syncError
                    ? ui("查看详情")
                    : syncing
                      ? ui("同步中")
                      : thread.syncedAt
                        ? ui("记录已同步")
                        : ui("等待同步")}
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
                    {copied ? ui("已复制") : ui("复制编号")}
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
                    {ui("同步记录")}
                  </button>
                </div>
                {thread.syncError && <small>{thread.syncError}</small>}
              </div>
            </details>
          )}
          {writerBusy && (
            <SessionConnection
              key={selected}
              threadId={selected}
              post={post}
              onSnapshot={(next) => {
                setState(next);
                setError("");
              }}
            />
          )}
          {guide && (
            <div className="chat-guide">
              <div className="guide-heading">
                <strong>{ui("说出任务，让 Codex 动手。")}</strong>
                <button
                  className="icon-button"
                  onClick={() => showGuide(false)}
                  aria-label={ui("关闭指南")}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              <PermissionSettings
                fullAccess={state.permissions?.fullAccess !== false}
                busy={running || busy}
                post={post}
                onSnapshot={setState}
              />
              <p>
                {ui(
                  "例如“打开计算器，计算 2 的 10 次方”。允许应用访问后，可查看画面或随时接管。",
                )}
              </p>
              <div>
                <button
                  onClick={() => {
                    setText(ui("打开本机计算器，计算 2 的 10 次方"));
                    showGuide(false);
                    composerRef.current?.focus();
                  }}
                >
                  {ui("试试计算器")}
                </button>
                <button
                  onClick={() => {
                    open(true);
                    showGuide(false);
                  }}
                >
                  {ui("查看电脑")}
                </button>
                <button
                  onClick={() => {
                    setApplicationTools((n) => n + 1);
                    open(true);
                    showGuide(false);
                  }}
                >
                  {ui("应用工具设置")}
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
            {!messages.length ? (
              <div className="welcome">
                <span className="welcome-mark">
                  <BrandMark />
                </span>
                <p className="eyebrow">{ui("从想法，到行动")}</p>
                <h2>
                  {ui("从一句话开始，")}
                  <br />
                  {ui("一起把事情做好。")}
                </h2>
                <p className="welcome-description">
                  {ui("接着上次的思路，或开始一件新鲜事。")}
                  <br />
                  {ui("你的 Codex 和 Mac，都在这里。")}
                </p>
                <div className="suggestions">
                  {[
                    {
                      icon: "monitor" as const,
                      title: ui("让 Mac 动起来"),
                      text: ui("打开本机计算器，计算 2 的 10 次方"),
                      detail: ui("打开应用，一起完成任务"),
                    },
                    {
                      icon: "code" as const,
                      title: ui("梳理一个项目"),
                      text: ui("梳理一个项目的实施计划"),
                      detail: ui("从代码和问题，走到下一步"),
                    },
                    {
                      icon: "chat" as const,
                      title: ui("一起想清楚"),
                      text: ui("帮我比较两种技术方案"),
                      detail: ui("比较方案，理清思路"),
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
              <>
                {(earlier ? earlier.more : thread?.hasEarlier) && (
                  <button
                    className="load-history"
                    disabled={loadingHistory}
                    onClick={() => void loadEarlier()}
                  >
                    {loadingHistory
                      ? ui("正在读取较早记录…")
                      : ui("加载较早记录")}
                  </button>
                )}
                <Conversation
                  threadId={selected}
                  cwd={thread?.cwd}
                  messages={messages}
                  approvals={(state.approvals || []).filter(
                    (a) => a.threadId === selected,
                  )}
                  decide={async (id, allow, allowAll) => {
                    await post("approval", { id, allow, allowAll });
                  }}
                />
              </>
            )}
            {running && (
              <div className="working" role="status">
                <span className="working-dot" />
                {syncing
                  ? ui("正在同步会话记录")
                  : externalRunning
                    ? ui("另一端正在执行，记录会自动同步")
                    : approvalCount
                      ? ui("等待你的操作确认")
                      : ui("Codex 正在处理")}
              </div>
            )}
            {thread?.error && (
              <p className="error" role="alert">
                {thread.error}
              </p>
            )}
          </div>
          <div className="composer-area">
            {attachments.length > 0 && (
              <div className="draft-files" aria-label={ui("待发送文件")}>
                {attachments.map((file) => (
                  <span key={file.root + file.path}>
                    {isPicture(file) ? (
                      <Picture file={file} compact />
                    ) : (
                      <Icon name="file" size={16} />
                    )}
                    <span>{file.name}</span>
                    <button
                      aria-label={ui("移除附件：") + file.name}
                      onClick={() =>
                        setAttachments((a) => a.filter((f) => f !== file))
                      }
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {error && (
              <div className="error" role="alert">
                {error}
                <button
                  className="icon-button"
                  aria-label={ui("关闭错误提示")}
                  onClick={() => setError("")}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            )}
            {state.runtime !== "connected" && (
              <div className="connect-strip">
                <span>{ui("连接本机 Codex，继续你的任务")}</span>
                <button disabled={busy} onClick={connect}>
                  {busy ? ui("正在连接…") : ui("重新连接")}
                </button>
              </div>
            )}
            <form
              className="composer"
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files);
                if (files.length) {
                  e.preventDefault();
                  void imageUploads.upload(files);
                }
              }}
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input
                type="file"
                ref={imagePicker}
                hidden
                multiple
                accept="image/*"
                aria-label={ui("选择图片")}
                onChange={(e) => {
                  void imageUploads.upload(Array.from(e.target.files || []));
                  e.target.value = "";
                }}
              />
              {imageUploads.uploading && (
                <div className="image-upload-progress" role="status">
                  {imageUploads.progress || ui("正在上传…")}
                  <button type="button" onClick={imageUploads.cancel}>
                    {ui("取消上传")}
                  </button>
                </div>
              )}
              <textarea
                ref={composerRef}
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={ui(desktopLayout ? "给 Codex 发消息…" : "发消息…")}
                aria-describedby={state.desktop?.active ? "composer-handoff-hint" : undefined}
                aria-label={ui("消息")}
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
              {state.desktop?.active && (
                <small id="composer-handoff-hint"
                  className={"composer-handoff-hint" + (!composerExpanded ? " is-collapsed" : "")}>
                  {ui("发送后交给 Codex，电脑画面保持连接。")}
                </small>
              )}
              <div className={"composer-tools" + (composerExpanded ? " is-expanded" : "")}>
                <button className="composer-more" type="button"
                  aria-label={ui("附件与设置")} aria-expanded={composerExpanded}
                  onClick={() => expandComposer(!composerExpanded)}>
                  <Icon name={composerExpanded ? "close" : "plus"} size={20} />
                </button>
                <button
                  className="composer-images"
                  type="button"
                  aria-label={ui("添加图片")}
                  title={ui("添加图片，可粘贴或拖入")}
                  disabled={imageUploads.uploading || !token}
                  onClick={() => imagePicker.current?.click()}
                >
                  <Icon name="image" size={18} />
                </button>
                <button
                  className="composer-files"
                  type="button"
                  aria-label={ui("文件上传与下载")}
                  title={ui("文件上传与下载")}
                  onClick={() => showFiles(true)}
                >
                  <Icon name="folder" size={18} />
                </button>
                <span className="composer-context">
                  <span
                    className={
                      "status-dot " +
                      (state.runtime === "connected" ? "" : "offline")
                    }
                  />
                  Codex <span className="composer-separator">/</span>
                  {ui("本机 Mac")}
                </span>
                <button
                  className="composer-guide"
                  type="button"
                  onClick={() => showGuide(!guide)}
                  aria-label={ui("权限与电脑设置")}
                >
                  <Icon name="settings" size={16} />
                  <span className="permission-mode-label">
                    {state.permissions?.fullAccess === false
                      ? ui("按需确认")
                      : ui("全部允许")}
                  </span>
                </button>
                <span className="keyboard-shortcut">{ui("↵ 发送")}</span>
                {syncing ? (
                  <button type="button" disabled>
                    {ui("同步中")}
                  </button>
                ) : localRunning ? (
                  <button
                    type="button"
                    className="stop-button"
                    aria-label={ui("停止")}
                    onClick={() =>
                      act(async () => {
                        await post(`threads/${selected}/stop`);
                      })
                    }
                  >
                    <span />
                    {ui("停止")}
                  </button>
                ) : externalRunning ? (
                  <button type="button" disabled>
                    {ui("另一端执行中")}
                  </button>
                ) : (
                  <button
                    className={
                      state.desktop?.active ? "send handoff-send" : "send"
                    }
                    disabled={
                      busy ||
                      imageUploads.uploading ||
                      network !== "online" ||
                      (!text.trim() && !attachments.length) ||
                      state.runtime !== "connected"
                    }
                    aria-label={state.desktop?.active ? ui("交给 Codex") : ui("发送消息")}
                    title={state.desktop?.active ? ui("发送后交给 Codex，电脑画面保持连接。") : ui("发送消息")}
                  >
                    <Icon name="arrow" size={21} />
                  </button>
                )}
              </div>
            </form>
            <p className="footnote">
              <Icon name="lock" size={12} />
              {ui("对话与电脑，留在你的掌握中")}
            </p>
          </div>
        </section>
        <ComputerDock visible={panel} desktop={desktopLayout}
          layout={floating ? "floating" : desktopLayout && !full ? "sidebar" : "full"}
          toolsOpen={computerToolsOpen} onTools={() => setComputerToolsOpen(!computerToolsOpen)}
          onClose={() => open(false)} onLayout={layout => {
            setComputerToolsOpen(false);
            if (desktopLayout) {
              if (layout !== "full") setDesktopComputer(layout);
              setFull(layout === "full");
            } else {setMobileFloating(layout === "floating");setFull(false);}
          }}>
          {token ? (
            <MacWorkspace
              toolsOpen={computerToolsOpen}
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
              fullAccess={state.permissions?.fullAccess !== false}
              onStopReady={(fn) => {
                stopDesktop.current = fn;
              }}
            />
          ) : (
            <div className="desk-loading" role="status">
              {ui("正在连接你的 Mac…")}
            </div>
          )}
        </ComputerDock>
      </main>
      {filesOpen && (
        <FilesPanel
          selected={selected}
          token={token}
          ensureThread={async () => selectedRef.current || (await create())}
          close={() => showFiles(false)}
          attach={(file) => {
            if (selectedRef.current === file.threadId)
              setAttachments((a) =>
                a.some((f) => f.path === file.path && f.root === file.root)
                  ? a
                  : [...a, file],
              );
          }}
        />
      )}
      <button className={"computer-orb " + (panel ? "is-open" : "") + (hasComputer ? " is-connected" : "")}
        aria-label={panel ? ui("收起电脑") : ui("打开电脑")}
        aria-expanded={panel}
        onClick={() => { showHistory(false); open(!panel); }}>
        <Icon name={panel ? "chat" : "monitor"} size={22} />
        {hasComputer && <span className="orb-connected" aria-hidden="true" />}
        {!!approvalCount && <span className="orb-count">{approvalCount}</span>}
      </button>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
