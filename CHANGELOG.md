# Changelog

## Unreleased — 2026-11-01

- 手机触屏独立交互：轻点、滑动滚动、显式拖拽与软键盘入口。
- 触屏工具条、44px 按钮、安全区域、小屏和横屏布局。
- 跨 Space 点击先按绑定窗口自身 AX 几何命中，避免依赖桌面顶层命中。
- 带密码的 loopback 远程网关；修复登录表单因 Referrer-Policy 导致 Origin 为 null 被拒绝。
- macOS 常驻服务安装脚本和启动器退出后孤儿服务清理。
- MIT 许可证、贡献 / 支持 / 安全说明、Issue / PR 模板、CI 和依赖更新配置。

## 0.2.0 — 2026-10-31

- 本机 Mac 窗口连续串流、画面输入、人工接管与断开。
- Skyrail computer-use 技能、应用打开授权、旧对话迁移。
- 本次连接全部允许、Markdown 对话、可恢复删除。

### Follow-up fixes

- Isolate and disable system-cursor capture that reproduced -3811 on two Mac applications.
- Report unavailable displays separately from missing system permissions.
- Hold session-scoped system/display wake assertions during active viewing and model tasks; release on inactivity. Existing virtual-display setups can opt out of physical wake with headless mode.

### Shared Codex sessions and connection recovery

- Keep the original native session ID across tool-version changes; synchronize confirmed history from Codex and expose search/import, manual refresh and copy-ID controls.
- Use a separate process for each active session writer, release it after completion, and preserve read-only history access. Report foreign writer conflicts without cloning the conversation or silently losing the draft.
- Detect system lock independently of TCC permissions, pause and disconnect computer control, and allow chat/history synchronization to continue.
- Recover zero-frame video through an isolated read-only window snapshot source; reject late frames after a switch.
- Protect replacement connections from stale process exits and replies; expose backend protocol identity for restart verification.
