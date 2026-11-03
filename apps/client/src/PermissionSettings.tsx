import React, { useEffect, useState } from "react";
export function PermissionSettings({
  fullAccess,
  busy,
  post,
  onSnapshot,
}: {
  fullAccess: boolean;
  busy: boolean;
  post: (p: string, d?: object) => Promise<any>;
  onSnapshot: (v: any) => void;
}) {
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [health, setHealth] = useState<{
      accessibility: boolean;
      screenRecording: boolean;
    } | null>(null);
  useEffect(() => {
    let active = true;
    post("mac/health")
      .then((h) => {
        if (active) setHealth(h);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="permission-settings">
      <label className="full-access-toggle">
        <span>
          <strong>允许全部操作</strong>
          <small>
            {fullAccess
              ? "命令行、文件、网络与应用操作已允许"
              : "工作区权限，命令与应用操作按需确认"}
          </small>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={fullAccess}
          disabled={busy || saving}
          onChange={async (e) => {
            const value = e.target.checked;
            setSaving(true);
            setError("");
            try {
              onSnapshot(
                await post("settings/permissions", { fullAccess: value }),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        />
      </label>
      <p>
        默认开启，作用于 Skyrail 发起的任务。切换后沿用原 Codex
        会话，下次任务生效。{busy ? "执行中请先停止任务再切换。" : ""}
      </p>
      <div className="system-permissions">
        <span>
          辅助功能{" "}
          {health ? (health.accessibility ? "已授权" : "未授权") : "检查中"}
        </span>
        <span>
          屏幕录制{" "}
          {health ? (health.screenRecording ? "已授权" : "未授权") : "检查中"}
        </span>
      </div>
      <small>
        macOS 的文件权限独立管理。请为常驻应用 Skyrail Mac 开启完全磁盘访问，授权后重启服务；此开关无法代替系统授权。
      </small>
      <button
        onClick={() =>
          void post("settings/system-permissions").catch((e) =>
            setError(e.message),
          )
        }
      >
        打开 macOS 隐私设置
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
