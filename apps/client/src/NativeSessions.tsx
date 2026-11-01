import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
type Session = {
  id: string;
  title: string;
  cwd: string;
  project?: { id: string; name: string; path: string | null };
  originator?: string;
  updatedAt: number;
  linked: boolean;
};
export function NativeSessions({
  post,
  onImport,
}: {
  post: (path: string, data?: object) => Promise<any>;
  onImport: (state: any, id: string) => void;
}) {
  const [items, setItems] = useState<Session[]>([]),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const postRef = useRef(post),
    request = useRef(0);
  postRef.current = post;
  async function load(value = "", next?: string) {
    const version = ++request.current;
    setBusy(true);
    setError("");
    try {
      const r = await postRef.current("sessions/list", {
        search: value,
        cursor: next,
      });
      if (version !== request.current) return;
      setItems((previous) =>
        next
          ? [
              ...previous,
              ...r.sessions.filter(
                (s: Session) => !previous.some((p) => p.id === s.id),
              ),
            ]
          : r.sessions,
      );
      setCursor(r.nextCursor || null);
      setQuery(value);
    } catch (e) {
      if (version === request.current) setError((e as Error).message);
    } finally {
      if (version === request.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      request.current++;
    };
  }, []);
  async function open(id: string) {
    setBusy(true);
    setError("");
    try {
      const r = await postRef.current("sessions/import", { codexId: id });
      onImport(r, r.threadId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const groups = new Map<
    string,
    { name: string; path: string | null; items: Session[] }
  >();
  for (const session of items) {
    const key = session.project?.id || session.cwd || "unassigned";
    let group = groups.get(key);
    if (!group) {
      group = {
        name:
          session.project?.name ||
          session.cwd?.split("/").filter(Boolean).at(-1) ||
          "其他会话",
        path: session.project?.path || session.cwd,
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(session);
  }
  return (
    <div className="native-sessions">
      <form
        className="session-search"
        onSubmit={(e) => {
          e.preventDefault();
          void load(search);
        }}
      >
        <input
          aria-label="搜索 Codex 会话"
          placeholder="搜索项目中的对话"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button disabled={busy}>搜索</button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {[...groups].map(([key, group], index) => (
        <details
          className="project-group"
          key={key}
          open={index === 0 || !!query}
        >
          <summary>
            <Icon name="code" size={18} />
            <span>
              <strong>{group.name}</strong>
              <small title={group.path || ""}>{group.path}</small>
            </span>
            <em>{group.items.length}</em>
            <Icon name="chevron" size={15} />
          </summary>
          <div className="project-sessions">
            {group.items.map((s) => (
              <div className="native-session" key={s.id}>
                <button disabled={busy} onClick={() => void open(s.id)}>
                  <strong>{s.title}</strong>
                  <span>
                    {s.linked ? "继续对话" : "打开对话"} ·{" "}
                    {new Date(s.updatedAt * 1000).toLocaleDateString("zh-HK")}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </details>
      ))}
      {!items.length && !busy && !error && (
        <p className="history-note">没有匹配的对话。</p>
      )}
      {busy && (
        <p role="status" className="history-note">
          正在读取项目和对话…
        </p>
      )}
      {cursor && (
        <button
          className="new"
          disabled={busy}
          onClick={() => void load(query, cursor)}
        >
          加载更多项目与对话
        </button>
      )}
      <p className="history-note project-note">
        按项目目录归类，保留原 Codex 会话与工作目录。
      </p>
    </div>
  );
}
