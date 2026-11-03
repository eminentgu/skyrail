import { t as ui } from "./i18n";
import React, { useEffect, useRef, useState } from "react";
import { NativeSessions } from "./NativeSessions";
import { Icon } from "./Icon";
type Thread = { id: string; title: string; status: string };
type Props = {
  threads: Thread[];
  deleted?: { id: string; title: string }[];
  selected: string;
  busy: boolean;
  close: () => void;
  create: () => void;
  select: (id: string) => void;
  remove: (id: string) => void;
  restore: (id: string) => void;
  post: (path: string, data?: object) => Promise<any>;
  onImport: (state: any, id: string) => void;
};
export function SessionDrawer({
  threads,
  deleted = [],
  selected,
  busy,
  close,
  create,
  select,
  remove,
  restore,
  post,
  onImport,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState("native"),
    [search, setSearch] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const items = threads.filter((t) =>
    t.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <dialog
      className="history-dialog"
      ref={ref}
      aria-label={ui("会话管理")}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside className="history-sheet">
        <div className="drawer-heading">
          <div>
            <span className="eyebrow">YOUR WORKSPACE</span>
            <h2>{ui("你的对话")}</h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label={ui("关闭会话管理")}
          >
            <Icon name="close" />
          </button>
        </div>
        <button className="new-chat primary" onClick={create} disabled={busy}>
          <Icon name="plus" />
          {ui("新对话")}
        </button>
        <div
          className="history-tabs"
          role="tablist"
          aria-label={ui("会话来源")}
        >
          {[
            ["local", ui("最近对话")],
            ["native", ui("Codex 项目")],
            ["trash", ui("最近删除")],
          ].map(([id, label]) => (
            <button
              role="tab"
              id={"tab-" + id}
              aria-controls="session-list"
              aria-selected={tab === id}
              key={id}
              onClick={() => setTab(id)}
            >
              {label}
              {id === "local" && <span>{threads.length}</span>}
            </button>
          ))}
        </div>
        <div
          className="drawer-content"
          role="tabpanel"
          id="session-list"
          aria-labelledby={"tab-" + tab}
        >
          {tab === "native" ? (
            <NativeSessions post={post} onImport={onImport} />
          ) : tab === "local" ? (
            <>
              <label className="drawer-search">
                <Icon name="chat" size={18} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={ui("查找你的对话")}
                  aria-label={ui("查找 Skyrail 对话")}
                />
              </label>
              <p className="list-caption">
                {search ? ui("搜索结果") : ui("最近对话")} · {items.length}
              </p>
              {items.map((t) => (
                <div
                  className={
                    "history-row " + (selected === t.id ? "is-current" : "")
                  }
                  key={t.id}
                >
                  <button className="history-item" onClick={() => select(t.id)}>
                    <Icon name="chat" size={18} />
                    <span>
                      <strong>
                        {t.title === "新对话" ? ui("新对话") : t.title}
                      </strong>
                      <small>
                        {{
                          idle: ui("尚未开始"),
                          completed: ui("已完成"),
                          running: ui("任务进行中"),
                          submitting: ui("正在发送"),
                          interrupted: ui("已中断"),
                          failed: ui("未完成"),
                          external_running: ui("其他客户端执行中"),
                          syncing: ui("同步中"),
                        }[t.status] || t.status}
                      </small>
                    </span>
                  </button>
                  <button
                    className="delete-chat icon-button"
                    disabled={
                      busy ||
                      ["running", "submitting", "syncing"].includes(t.status)
                    }
                    aria-label={ui("删除对话：") + t.title}
                    title={ui("移到最近删除")}
                    onClick={() => remove(t.id)}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </div>
              ))}
              {!items.length && (
                <div className="drawer-empty">
                  <Icon name="chat" size={32} />
                  <h3>{search ? ui("没有匹配的对话") : ui("还没有对话")}</h3>
                  <p>
                    {search
                      ? ui("试试更短的关键词。")
                      : ui("开始一个想法，随时回来继续。")}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="history-note">
                {ui("这里的对话可以恢复。Codex 原始记录会保留。")}
              </p>
              {deleted.map((t) => (
                <div className="history-row" key={t.id}>
                  <span>{t.title === "新对话" ? ui("新对话") : t.title}</span>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => restore(t.id)}
                  >
                    {ui("恢复")}
                  </button>
                </div>
              ))}
              {!deleted.length && (
                <div className="drawer-empty">
                  <Icon name="history" size={32} />
                  <h3>{ui("没有已删除的对话")}</h3>
                  <p>{ui("移除的对话会先保留在这里。")}</p>
                </div>
              )}
            </>
          )}
        </div>
        <p className="drawer-footer">
          <span className="status-dot" />
          {ui("保留原会话，跨设备继续")}
        </p>
      </aside>
    </dialog>
  );
}
