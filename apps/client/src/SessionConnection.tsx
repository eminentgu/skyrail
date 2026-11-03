import React, { useState } from "react";
import { Icon } from "./Icon";
type Owner = {
  occupied: boolean;
  client?: string;
  sessionCount?: number;
  fingerprint?: string;
  canStop?: boolean;
  local?: boolean;
};
export function SessionConnection({
  threadId,
  post,
  onSnapshot,
}: {
  threadId: string;
  post: (path: string, data?: object) => Promise<any>;
  onSnapshot: (value: any) => void;
}) {
  const [owner, setOwner] = useState<Owner | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(action: string) {
    setBusy(true);
    setError("");
    try {
      const result = await post(
        `threads/${threadId}/${action}`,
        owner?.fingerprint ? { fingerprint: owner.fingerprint } : {},
      );
      if (action === "connection") setOwner(result);
      else {
        onSnapshot(result);
        setOwner(null);
      }
    } catch (e) {
      setError((e as Error).message);
      if (action === "stop-owner") setOwner(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="session-connection"
      role="group"
      aria-label="Codex 会话连接管理"
    >
      <div>
        <strong>原会话连接被占用</strong>
        <p>
          历史记录和草稿保留。可重新连接原会话，或检查并结束占用它的 Codex
          后台连接。
        </p>
      </div>
      <div className="connection-recovery-actions">
        <button disabled={busy} onClick={() => void run("reconnect")}>
          <Icon name="refresh" size={16} />
          {busy ? "处理中…" : "重新连接"}
        </button>
        <button disabled={busy} onClick={() => void run("connection")}>
          检查占用连接
        </button>
      </div>
      {owner && (
        <div className="owner-review">
          {!owner.occupied ? (
            <p>目前没有检测到占用进程，可以重新连接。</p>
          ) : (
            <>
              <p>
                {owner.client} 持有该会话。结束它会断开同一进程中的{" "}
                <strong>{owner.sessionCount} 个会话连接</strong>
                ，包括可能正在进行的任务和桌面端当前聊天；聊天记录保留。
              </p>
              {owner.canStop ? (
                <button disabled={busy} onClick={() => void run("stop-owner")}>
                  确认结束占用并连接原会话
                </button>
              ) : (
                <p>该进程无法由 Skyrail 结束，请在原客户端关闭连接。</p>
              )}
            </>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
