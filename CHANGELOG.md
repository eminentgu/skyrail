# Changelog

## Unreleased — 2026-11-01

- 电脑页可选整个桌面或单个 App；恢复独立应用窗口的人工接管，并收起重复控制按钮。
- 手机默认触控板式滑动移光标，支持单击、双击、连点拖拽、双指缩放 / 平移和光标边缘跟随；可切换直接点按。
- 隐藏 noVNC 全网页备用光标，离开电脑页时阻止键鼠输入，修复远程光标残留到对话页。

- 按最新要求保留 Hark 风格，仅对话 / 电脑两页；对话页管理全部会话，Codex 按项目与 Git 仓库分组。
- 人工与 Codex 交接保留桌面串流，不再自动断开；服务端协议闸门过滤人工输入，一键恢复接手。
- 显式切换连接设备；延长持续会话期限；提供管理员一次性设置脚本，关闭系统屏幕共享断开后恢复旧锁屏状态。
- 常驻版固定构建快照，避免前后端版本混用。

- 电脑优先的界面重构：完整 Mac 桌面为主、Codex 次级导航、会话抽屉与搜索、统一主题和登录页。
- 手机主路径简化为点按与可见键盘；系统桌面覆盖新窗口，避免依赖旧窗口的人工点击。应用工具设置保留为次级入口。
- 系统账户名自动预填；聊天发送任务时先释放人工桌面，再交给同一 Codex 会话。增加软键盘高度适配和复制回复。
- 常驻版使用构建产物，不再向控制页面注入开发热更新；校验静态文件边界和缺失构建，避免改代码时重建输入组件。

- 人工全桌面 / 远程解锁入口：noVNC ARD 认证、手机键盘与平移、专用 WebSocket 认证转发及独占控制租约。首次须启用系统屏幕共享，真实锁屏验收尚待完成。

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
