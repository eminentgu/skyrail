import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
export type Attachment = {
  root: "uploads" | "workspace";
  path: string;
  name: string;
  size: number;
  threadId: string;
};
export const downloadUrl = (file: Attachment) =>
  "/v1/files/download?" +
  new URLSearchParams({
    threadId: file.threadId,
    root: file.root,
    path: file.path,
  });
type Entry = { name: string; path: string; directory: boolean; size: number };
export function FilesPanel({
  selected,
  token,
  ensureThread,
  attach,
  close,
}: {
  selected: string;
  token: string;
  ensureThread: () => Promise<string>;
  attach: (file: Attachment) => void;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    picker = useRef<HTMLInputElement>(null),
    requests = useRef(new Set<XMLHttpRequest>()),
    version = useRef(0),
    alive = useRef(true);
  const [root, setRoot] = useState<"workspace" | "uploads">("workspace"),
    [folder, setFolder] = useState(""),
    [entries, setEntries] = useState<Entry[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [uploading, setUploading] = useState(false),
    [progress, setProgress] = useState(""),
    [refresh, setRefresh] = useState(0),
    [notice, setNotice] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      alive.current = false;
      for (const request of requests.current) request.abort();
    };
  }, []);
  useEffect(() => {
    setFolder("");
    setEntries([]);
  }, [selected, root]);
  useEffect(() => {
    const current = ++version.current;
    if (!selected) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    fetch(
      "/v1/files/list?" +
        new URLSearchParams({ threadId: selected, root, path: folder }),
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.message);
        if (current === version.current) {
          setEntries(d.entries);
          setNotice(d.truncated ? "仅显示前 300 项，请进入子目录查看。" : "");
        }
      })
      .catch((e) => {
        if (current === version.current) setError(e.message);
      })
      .finally(() => {
        if (current === version.current) setLoading(false);
      });
    return () => {
      version.current++;
    };
  }, [selected, root, folder, refresh]);
  async function upload(files: File[]) {
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const threadId = selected || (await ensureThread());
      for (const file of files) {
        if (file.size > 50 * 1024 * 1024)
          throw Error(`${file.name} 超过 50 MB`);
        const uploaded = await new Promise<Attachment>((resolve, reject) => {
          const request = new XMLHttpRequest();
          requests.current.add(request);
          request.open(
            "POST",
            "/v1/files/upload?" +
              new URLSearchParams({ threadId, name: file.name }),
          );
          request.setRequestHeader("X-Skyrail-Token", token);
          request.setRequestHeader("Content-Type", "application/octet-stream");
          request.timeout = 180000;
          request.upload.onprogress = (e) => {
            if (alive.current)
              setProgress(
                `${file.name} · ${e.lengthComputable ? Math.round((e.loaded / e.total) * 100) + "%" : "上传中"}`,
              );
          };
          request.onload = () => {
            requests.current.delete(request);
            let d;
            try {
              d = JSON.parse(request.responseText);
            } catch {
              return reject(Error("上传响应无效"));
            }
            if (request.status >= 200 && request.status < 300)
              resolve({ ...d, threadId });
            else reject(Error(d.message || "上传失败"));
          };
          const fail = () => {
            requests.current.delete(request);
            reject(Error("上传已中断，未添加到消息"));
          };
          request.onerror = fail;
          request.onabort = fail;
          request.ontimeout = fail;
          request.send(file);
        });
        if (!alive.current) return;
        attach(uploaded);
      }
      if (alive.current) {
        setRoot("uploads");
        setFolder("");
        setRefresh((n) => n + 1);
        setNotice("已上传并添加到待发送消息。");
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) {
        setUploading(false);
        setProgress("");
      }
    }
  }
  const size = (value: number) =>
    value > 1024 * 1024
      ? (value / 1024 / 1024).toFixed(1) + " MB"
      : Math.max(1, Math.ceil(value / 1024)) + " KB";
  return (
    <dialog
      className="history-dialog files-dialog"
      ref={dialog}
      aria-label="文件上传与下载"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside className="history-sheet files-sheet">
        <div className="drawer-heading">
          <div>
            <span className="eyebrow">YOUR FILES</span>
            <h2>文件</h2>
          </div>
          <button
            className="icon-button"
            aria-label="关闭文件管理"
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </div>
        <div
          className="files-upload"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!uploading) void upload(Array.from(e.dataTransfer.files));
          }}
        >
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            aria-label="选择上传文件"
            onChange={(e) => {
              void upload(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
          <button
            className="primary"
            disabled={uploading}
            onClick={() => picker.current?.click()}
          >
            <Icon name="plus" size={18} />
            {uploading ? "正在上传…" : "上传并添加到对话"}
          </button>
          <small>支持多文件与拖放，单文件最多 50 MB。</small>
          {uploading && (
            <button
              onClick={() => {
                for (const request of requests.current) request.abort();
              }}
            >
              取消上传
            </button>
          )}
          <span role="status">{progress || notice}</span>
        </div>
        <div className="files-tabs" role="tablist" aria-label="文件位置">
          <button
            role="tab"
            aria-selected={root === "workspace"}
            onClick={() => setRoot("workspace")}
          >
            当前项目
          </button>
          <button
            role="tab"
            aria-selected={root === "uploads"}
            onClick={() => setRoot("uploads")}
          >
            上传的文件
          </button>
        </div>
        <div className="files-path">
          <button
            disabled={!folder}
            onClick={() => setFolder(folder.split("/").slice(0, -1).join("/"))}
          >
            上一级
          </button>
          <span title={folder}>/{folder}</span>
          <button
            aria-label="刷新文件"
            onClick={() => setRefresh((n) => n + 1)}
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
        {error && (
          <p className="files-error" role="alert">
            {error}
          </p>
        )}
        <div className="files-list">
          {loading ? (
            <p>正在读取文件…</p>
          ) : !selected ? (
            <p>上传文件后会创建对话；也可先打开已有对话。</p>
          ) : !entries.length ? (
            <p>这里还没有文件。上传文件，或让 Codex 将结果保存到项目中。</p>
          ) : (
            entries.map((entry) => (
              <div className="file-row" key={entry.path}>
                <div>
                  <button
                    className="file-name"
                    disabled={!entry.directory}
                    title={entry.name}
                    onClick={() => setFolder(entry.path)}
                  >
                    <Icon
                      name={entry.directory ? "folder" : "file"}
                      size={19}
                    />
                    <span>{entry.name}</span>
                  </button>
                  <small>{entry.directory ? "文件夹" : size(entry.size)}</small>
                </div>
                {!entry.directory && (
                  <div>
                    <button
                      aria-label={"添加到消息：" + entry.name}
                      onClick={() => {
                        attach({ ...entry, root, threadId: selected });
                        setNotice("已添加到待发送消息。");
                      }}
                    >
                      <Icon name="plus" size={18} />
                    </button>
                    <a
                      aria-label={"下载：" + entry.name}
                      href={downloadUrl({ ...entry, root, threadId: selected })}
                      download={entry.name}
                    >
                      <Icon name="download" size={18} />
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <p className="files-footnote">
          文件保存在这台 Mac。项目中的新结果可刷新后下载。
        </p>
      </aside>
    </dialog>
  );
}
