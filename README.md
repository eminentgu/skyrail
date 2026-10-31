# Skyrail 天轨

一个让对话与电脑操作保持连续的本地 Codex 工作台。基于桌面《Codex Desk 产品需求与交互架构设计 v1.0》（2026-10-29）开始实现，Skyrail 为独立项目名，尚未进行商标核查。

## 运行

需要 Node.js 22+ 和已登录的 Codex CLI。当前验证版本为 `codex-cli 0.165.0-alpha.1.2`。

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:4317 ，点击“连接 Codex”。若 PATH 无法找到 Codex，用 `CODEX_BIN=/absolute/path/to/codex npm run dev`。`PORT` 可改变端口，浏览器必须使用 127.0.0.1 地址。

```sh
npm run build
npm test
```

`npm start` 当前也运行本地 Vite 中间件，并非生产安装包。构建产物在 dist，发布服务待实现。

## 当前能力

- React / TypeScript 天空主题聊天 UI，历史切换、深色主题、电脑分栏和窄屏单视图。
- 本地 Node 服务启动真实 Codex app-server：initialize、thread/start、thread/resume、turn/start、流式输出、turn/interrupt。
- 产品聊天记录持久化到 `.data/threads.json`；Codex 自行管理其线程。重启后运行中记录标为 interrupted，不自动重放。
- 电脑面板是明确标注的模拟画面，控制演示在服务端比较 epoch，拒绝过期请求。
- 绑定 loopback、Host / Origin 校验、命令会话令牌；SSE 通过 HttpOnly SameSite Cookie 验证。

## 当前限制

没有真实 Linux 环境、桌面流、MCP 电脑操作、执行端租约、文件下载或审批界面。接管演示不控制真实 Codex，也不代表真实输入互斥已经实现。窄屏仅供观看与暂停演示。

真实聊天当前使用 read-only sandbox 与 untrusted 审批策略；未实现的审批/工具请求返回错误，不能完成需要批准的任务。Codex 的 read-only 不能等同于隔离虚拟机：本版本仅供本机开发验证。尚未引入完整工具白名单、凭据隔离、生产鉴权或安装包。

持久化暂用原子替换 JSON，后续迁移 SQLite。SSE 推送完整快照，后续改为持久化 seq / 事件补齐。发送中的超时可能意味着结果未知，UI 不自动重试。文件和对话默认不上传 GitHub；不复制宿主 Cookie 或登录凭据。

## 文档

- [实施计划](docs/PLAN.md)
- [架构及取舍](docs/ARCHITECTURE.md)
- [验证记录](docs/VALIDATION.md)
- [设计来源](docs/DESIGN.md)

项目当前为私有开发预览，许可证尚未决定。第三方包按其各自许可证使用。
