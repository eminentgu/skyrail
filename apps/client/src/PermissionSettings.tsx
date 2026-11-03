import { t as ui } from "./i18n";
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
          <strong>{ui("允许全部操作")}</strong>
          <small>
            {fullAccess
              ? ui("命令行、文件、网络与应用操作已允许")
              : ui("工作区权限，命令与应用操作按需确认")}
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
        {ui(
          "默认开启，作用于 Skyrail 发起的任务。切换后沿用原 Codex 会话，下次任务生效。",
        )}
        {busy ? ui("执行中请先停止任务再切换。") : ""}
      </p>
      <div className="system-permissions">
        <span>
          {ui("辅助功能")}{" "}
          {health
            ? health.accessibility
              ? ui("已授权")
              : ui("未授权")
            : ui("检查中")}
        </span>
        <span>
          {ui("屏幕录制")}{" "}
          {health
            ? health.screenRecording
              ? ui("已授权")
              : ui("未授权")
            : ui("检查中")}
        </span>
      </div>
      <small>
        {ui(
          "macOS 的文件权限独立管理。请为常驻应用 Skyrail Mac 开启完全磁盘访问，授权后重启服务；此开关无法代替系统授权。",
        )}
      </small>
      <button
        onClick={() =>
          void post("settings/system-permissions").catch((e) =>
            setError(e.message),
          )
        }
      >
        {ui("打开 macOS 隐私设置")}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
