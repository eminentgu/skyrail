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
      officialAutomation?: { state: string; allowed: boolean };
      computerBackend?: string;
      officialClient?: { transport: string; authentication: string; lastError?: { code: string; message: string } };
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
      {health?.computerBackend === "official" && (
        <div className="official-connection-status" role="status">
          <p>{ui(health.officialClient?.authentication === "accepted"
            ? "官方服务已接受操作连接"
            : health.officialClient?.authentication === "rejected"
              ? "官方服务未认证当前宿主。重复申请 macOS 权限无法修复此错误。"
              : "官方操作连接尚未验证；工具列表连接成功不代表可以操作。")}</p>
          <button disabled={busy || saving} onClick={async () => {
            setSaving(true); setError("");
            try {
              const officialClient = await post("mac/official-check");
              setHealth((previous) => previous ? { ...previous, officialClient } : previous);
              if (officialClient.lastError) setError(officialClient.lastError.message);
            } catch (e) { setError((e as Error).message); }
            finally { setSaving(false); }
          }}>{ui("检查官方操作连接")}</button>
        </div>
      )}
      <button
        disabled={busy || saving || !!health?.officialAutomation?.allowed}
        onClick={async () => {
          setSaving(true); setError("");
          try {
            const result = await post("mac/official-permission");
            setHealth(await post("mac/health"));
            if (!result.allowed) setError(ui(
              result.state === "update_required"
                ? "请更新并重启 Skyrail Mac，旧版本缺少自动化权限声明。"
                : result.state === "denied"
                  ? "自动化未获允许。请在 macOS 自动化中允许 Skyrail Mac 访问 Codex Computer Use。"
                  : result.state === "not_running"
                    ? "官方 Computer Use 服务未运行，请先启动 Codex 后重试。"
                    : "自动化授权未完成（系统状态：{0}）。", result.osStatus ?? result.state));
          } catch (e) { setError((e as Error).message); }
          finally { setSaving(false); }
        }}
      >
        {ui(health?.officialAutomation?.allowed ? "官方 Computer Use 已授权" : "连接官方 Computer Use")}
      </button>
      <small>{ui("仅请求连接已安装的官方服务；请在 macOS 弹窗中决定是否允许。授权不代表已启用官方后端。")}</small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
