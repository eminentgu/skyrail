# Skyrail 天轨

直接在你的 Mac 上使用本地 Codex 的聊天工作台。聊天、应用窗口观察、操作审批、人工接管与交还在同一页面完成。项目位置：`/Users/Eminent/CodeSpace/skyrail`。

## 启动

需要 macOS 14+、Xcode Command Line Tools、Node.js 22+、已登录的 Codex CLI。

```sh
npm ci
npm run setup:mac
npm run dev
```

打开 http://127.0.0.1:4317 。找不到 Codex 时设置 `CODEX_BIN=/absolute/path/to/codex`。当前兼容测试版本是 Codex `0.165.0-alpha.1.2`。`PORT` 可调整监听端口，使用 127.0.0.1 访问。

## 使用路径

1. 点击“连接 Codex”，在历史菜单创建新对话。
2. 打开电脑面板，点击“检测 Mac 应用”。
3. 如缺少权限，点击“申请系统权限”。在系统设置的辅助功能与屏幕录制中允许 `Skyrail Mac.app`；它位于项目 `.data/` 目录。Touch ID 或密码必须由本人完成。辅助程序重新编译会改变临时签名，可能需要重新授权。
4. 选择一个已运行的应用及具体窗口，点击“连接应用”。窗口串流真实来自 ScreenCaptureKit。辅助功能未授权时可以观看，不能点击输入。
5. 点击“交还 Codex”，然后发送任务。Codex 通过 `mac_computer` 工具观察与操作；每次修改都显示审批卡，只有点击“允许本次”才执行。
6. “人工接管”先撤销新输入并等待当前原子操作结束，然后请求中断轮次。可以直接在串流画面里点击、拖动、滚轮、输入文字，也可以直接使用 Mac；Escape 释放画面键盘捕获。交还时会重新截图。之后发送“从当前状态继续”开启下一轮。
7. “暂停电脑操作”关闭后续电脑输入；“停止任务”还请求中断 Codex。已发生的外部操作不能撤回。

窗口由独立 SCStream 进程持续采集，通过经过会话鉴权的 MJPEG 连接传到浏览器。配置上限 15 FPS、最长边宽度 1600px；实际帧率取决于窗口更新、尺寸和负载。无需手动刷新，Codex 操作期间也持续观看。收起或隐藏网页后停止订阅，无观看者时释放采集进程。画面与模型观察分离，视频不会按帧发送给模型，也不修改 AX 元素编号。人工接管后，画面坐标会按窗口等比缩放与留白反算，再由 macOS 发送给绑定应用；文字支持中文组合输入和粘贴。浏览器常用退出快捷键仍可能被浏览器保留。点击“断开窗口”会释放输入、关闭串流并清除线程绑定，不会关闭 Mac 应用本身。

## 当前实现

React / TypeScript 界面 + 本地 Node 服务 + Codex app-server stdio + 自建 Swift macOS 适配器。适配器使用 ScreenCaptureKit 截图和 Accessibility 观察、按下元素、填写元素，以及向选定应用发送有限按键。没有 Linux 虚拟机、VNC 或宿主 Cookie 复制。

电脑写操作逐次审批，并绑定线程、所选应用、控制 epoch 与观察版本。交接期间关闭写入；旧线程、迟到操作和失效元素索引拒绝执行。辅助程序异常或超时关闭输入，不自动重试未知操作。截图只留在内存供页面显示，但作为工具结果提交给 Codex 后，其保留方式遵循 Codex 运行时。

聊天记录在 `.data/threads.json` 原子保存；任务目录在 `workspaces/`，都不入 Git。运行时凭据仍由 Codex 管理。服务仅监听 loopback 并检查 Host、Origin、命令令牌；事件通过 HttpOnly Cookie 认证。

## 验证

```sh
npm run build
npm test
node scripts/smoke-protocol.mjs
```

最后一个测试会调用真实 Codex 模型，验证动态工具协议，但不操作 Mac。详细证据见 [验证记录](docs/VALIDATION.md)。

## 开发预览的边界

当前是一个可运行的 macOS 开发版本，尚未达到完整发布验收。尚缺 SQLite 事件补齐、完整审批类型、文件下载管理、稳定签名与安装包。原生适配器只能操作已运行应用的 AX 元素；不支持 AX 的控件会明确失败。对话运行期间的补充要求需等当前轮次结束。旧版本创建的对话没有动态电脑工具，请新建对话。

Codex 自带 shell 和本机配置的 MCP 属于运行时能力；本产品通过开发者指令要求所有 GUI 操作只走电脑闸门，未知审批默认拒绝，但这不等于操作系统级沙箱隔离，也不能仲裁用户其他 Codex 会话。使用时避免其他自动化同时操作同一应用。当前不作为无人值守或不可信任务执行平台。

`npm start` 与 `npm run dev` 都使用本地 Vite 中间件；`npm run build` 检查类型并生成 dist，尚非独立生产服务。许可证及正式名称商标核查未完成。

[实施计划](docs/PLAN.md) · [架构](docs/ARCHITECTURE.md) · [设计依据](docs/DESIGN.md)
