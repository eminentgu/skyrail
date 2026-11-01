# Skyrail 天轨

[![CI](https://github.com/eminentgu/skyrail/actions/workflows/ci.yml/badge.svg)](https://github.com/eminentgu/skyrail/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Local-first Codex chat, live Mac windows, and human takeover.**

把本机 Codex 对话、Mac 应用窗口串流和人工接管放在同一页面。直接适配你的 Mac，不需要 Linux 虚拟机。电脑用鼠标与键盘，手机用触屏操作。

> 早期 0.x 项目。已有可运行实现，跨应用输入、原生全屏与手机真机兼容仍在持续验收；见 [验证记录](docs/VALIDATION.md)。

## Quick start / 快速开始

需要 macOS 14+、Xcode Command Line Tools、Node.js 22+、已登录的 Codex CLI。

```sh
git clone https://github.com/eminentgu/skyrail.git
cd skyrail
npm ci
npm run setup:mac
npm run dev
```

打开 **http://127.0.0.1:4317**。找不到 Codex 时设置 `CODEX_BIN=/absolute/path/to/codex`。当前实际测试的 Codex CLI 为 `0.165.0-alpha.1.2`；其他版本未承诺兼容。

第一次使用，在系统设置「辅助功能」和「屏幕与系统音频录制」中允许项目 `.data/Skyrail Mac.app`。身份验证由本人完成；临时签名重编译后可能需移除旧授权再重新添加。

## 使用

1. 连接 Codex 并创建对话，可直接请求“打开计算器”。Skyrail 会在聊天中请求连接应用。
2. 也可在电脑面板选择已运行的应用和具体窗口。画面由 ScreenCaptureKit 连续采集。
3. “人工接管”撤销模型电脑输入，可在画面里操作；“交给 Codex”后发送任务继续。
4. 默认逐次确认电脑写操作；“本次连接允许全部操作”只对当前窗口连接生效，断开或换应用后恢复默认。
5. “断开窗口”释放输入、停止串流、清除绑定，不关闭目标应用。
6. 历史对话可删除到“最近删除”，支持恢复；不会永久擦除 Codex 历史或任务文件。

### 手机触屏

| 手势 / 按钮 | 行为 |
| --- | --- |
| 轻点画面 | 点击对应控件，不自动弹出键盘 |
| 单指滑动 | 滚动内容，避免误触发鼠标拖拽 |
| 切换“拖拽”后移动 | 按住并拖动鼠标；完成后切回“点按 / 滚动” |
| “键盘” | 显式唤起软键盘，提供 Tab、回车和退格 |
| 页面切走、取消或多指介入 | 取消手势并释放输入 |

横屏或“放大”工作区更适合小控件。不支持画面内捏合缩放；iOS / Android 真机、跨 Space 拖拽和特殊控件仍需继续验证。

## 远程访问与常驻

本地服务只监听 loopback。可选网关在 **127.0.0.1:4318** 增加密码登录，再通过自己的 HTTPS tunnel 访问。

```sh
SKYRAIL_REMOTE_HOST=your.domain.example node apps/remote-gateway/server.mjs
```

首次运行生成密码并仅保存到 `.data/remote-access.txt`。不要上传此文件或把密码发到 Issue。登录 Cookie 有效 24 小时，网关重启后需重新登录。**公网 tunnel 应映射 4318，不能直接映射 4317。** 项目不提供公共演示实例。

macOS 登录后自动启动服务和网关：

```sh
SKYRAIL_REMOTE_HOST=your.domain.example CODEX_BIN=/absolute/path/to/codex npm run service:install
```

安装器使用当前 Node 路径生成 `~/Library/LaunchAgents/local.skyrail.{service,gateway}.plist`，替换这两个同名任务并重启，日志在 `.data/`。它不会创建或修改 Cloudflare tunnel。更新 Node 路径后需重新安装服务。

停止常驻：

```sh
launchctl bootout gui/$(id -u)/local.skyrail.service
launchctl bootout gui/$(id -u)/local.skyrail.gateway
```

停止后可删除上述两个 plist 取消下次登录启动。安装常驻服务前先退出手动启动的 `npm run dev`，避免端口占用。

## 实现与边界

React / TypeScript → loopback Node 服务 → Codex app-server stdio；Swift 负责 ScreenCaptureKit 和 Accessibility。持续视频走单独的 MJPEG 连接，不会逐帧发送给模型。配置上限 15 FPS、最长边 1600px，不代表所有设备的实测表现。

电脑操作绑定线程、应用、epoch 和浏览器客户端。模型通过显式注入的 [skyrail-computer-use](skills/skyrail-computer-use/SKILL.md) 调用 `skyrail_computer`。当前代码使用 Vite 中间件运行，构建产物尚非独立生产部署；原生适配器未稳定签名 / 公证。

聊天保存在 `.data/threads.json`，任务目录是 `workspaces/`，均不入 Git。Codex 的 shell / MCP 能力不是 OS 沙箱；GUI 路由指令也不等于绝对隔离。远程网关是单用户认证，不是多用户权限系统。参见 [安全边界](SECURITY.md)。

## 开发与支持

```sh
npm test
npm run build
npm run setup:mac  # 修改 Swift 后
```

CI 检查 Linux / macOS 下的 JS 测试和前端构建，并在 macOS 编译 Swift；不会调用真实模型或授予系统权限。

`node scripts/smoke-protocol.mjs` 和 `node scripts/smoke-routing.mjs` 会调用真实 Codex 模型，分别检查协议及路由，不能替代真实 Mac 输入验收。

[贡献指南](CONTRIBUTING.md) · [使用与故障排查](SUPPORT.md) · [报告问题](https://github.com/eminentgu/skyrail/issues/new/choose) · [变更记录](CHANGELOG.md) · [实施计划](docs/PLAN.md) · [架构](docs/ARCHITECTURE.md)

项目代码采用 [MIT](LICENSE)；依赖和外部服务适用各自许可证与条款。欢迎中文或英文反馈，维护为尽力支持，无响应时限承诺。

### 显示器熄屏与系统睡眠

默认在观看窗口、执行模型任务或获取窗口观察时，Skyrail 临时唤醒并保持系统 / 显示器运行；会话活动结束后释放，不永久修改系统电源设置。**物理屏幕可能亮起。** 整机强制睡眠或关机后，本机服务无法继续执行。

如部署已有独立虚拟显示器，可在启动 / 安装服务时设置 `SKYRAIL_DISPLAY_MODE=headless`，关闭 Skyrail 主动亮屏，仅保持系统运行。这个选项不会创建虚拟显示器，尚未通过物理屏幕熄灭、合盖及锁屏的完整验证。详见 [休眠排障](SUPPORT.md#熄屏睡眠与--3811)。

## 与 Codex 共享会话记录

Skyrail 对话关联一个稳定的 Codex session ID，已确认的消息从 Codex 持久化历史读取；`.data/threads.json` 保存显示缓存、未确认发送和本地删除状态。升级工具版本不会自动换一个 session。

- 对话上方可复制会话编号、手动同步；选中的会话每 5 秒自动刷新。
- 历史菜单的“Codex 会话”可搜索、分页导入本机已有会话，保留原 ID、工作目录与原有工具配置。
- 每个执行中的会话使用独立 app-server 写入进程，完成后关闭，释放写入锁；其他任务不受影响。读取历史不占用写入会话。
- 两端交替执行，同一 session 不支持并发写入。若另一客户端仍持有锁，Skyrail 保留草稿并提示先释放，记录仍可读取。
- 电脑操作工具由 Skyrail 提供；同步历史不会把宿主专有工具或系统权限复制给另一客户端。
- Skyrail 的删除仍是本地可恢复隐藏，不会永久删除 Codex 原始会话。

真实双客户端验收（会调用模型，创建专用测试会话；成功后移到最近删除并归档原生测试会话）：

```sh
node scripts/smoke-session-sync.mjs
# --keep 可保留测试记录供检查
```

Mac 锁屏时会明确暂停窗口采集与输入，聊天和会话同步仍可使用。若升级后缺少锁屏检测组件，可只运行 `npm run setup:session` 安装只读状态检测器，无需重新签名已授权的电脑操作程序。
