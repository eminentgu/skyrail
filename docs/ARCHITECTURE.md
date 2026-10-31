# 原生 Mac 架构

React UI → 本地同源 HTTP/SSE 协调器 → Codex app-server stdio。Codex 动态工具请求 `item/tool/call` 由协调器处理：校验线程与控制状态 → 修改操作的用户审批 → 串行输入闸门 → Swift 辅助程序 → macOS Accessibility / ScreenCaptureKit → 文字与窗口截图返回 Codex 和界面。

用户选择一个已运行应用，辅助程序只捕获该应用的一扇窗口并通过 bundle ID 绑定输入。人工接管既可在本机直接操作，也可通过画面指针/键盘输入。画面排除 object-fit 留白后映射到窗口归一化坐标；服务端重验 thread、epoch 与 humanClientId，再串行转给 Swift，输入目标由服务端绑定的 app/windowId 决定。断开、交接与失焦会释放键鼠。模型观察仍按需截图；界面观看使用独立 SCStream 进程持续采集，JPEG 编码后经长度分帧管道进入 Node，再由独立 MJPEG HTTP 连接呈现。观看不会重建 AX 树或改变模型元素编号。帧不进入聊天 SSE；SSE 每秒只更新流状态和指标。慢客户端丢弃新到帧以限制缓冲，不排长视频队列；无订阅者时释放采集进程。窗口 ID 固定在绑定时，重连不暗换窗口。

控制权状态与 UI 分开。交接先将 owner 改为 none、递增 epoch，再等待已派发操作完成。排队操作在执行边界重验 epoch / thread。交还先观察再授予 agent；输入索引还需符合 agent 最近观察版本。原生调用超时后杀死辅助进程并撤销控制，结果标为未知，不自动重试。

## 为什么没有直接调用 Codex 桌面私有组件

本机发现 @oai/sky 0.7.13 及 Computer Use 插件 1.0.1001641。插件声明 Proprietary，应用策略、授权 elicitation 与服务启动由桌面宿主管理。app-server 的正常握手不会自动取得这套桌面授权。未仿造 trusted nodeRepl、宿主元数据或私有服务身份，也没有复制/分发其二进制。

因此复用 Codex 任务运行时与动态工具协议；原生 Mac 操作部分自行用系统公开 API 实现。内置 Computer Use 与自建适配器之间保留架构区分，未来仅在提供公开支持的宿主接入方式时再替换。

## 数据与局限

Codex 持有自身凭据和线程；产品 JSON 文件保存线程映射和消息。截图在服务内存中，不写产品数据库；模型工具结果仍进入 Codex 记录。native app 只使用本机临时签名，重编译可能使权限失效。

目前 epoch 只约束 Skyrail 路径，不控制其他桌面客户端或用户物理输入；没有多客户端租约和系统级自动化隔离。主机 shell / 用户已有 MCP 的防绕过仍依赖 runtime 约束和开发者指令，尚不是强制白名单产品。没有承诺生产级安全接管。

参考：官方 app-server https://learn.chatgpt.com/docs/app-server 和 Computer Use https://learn.chatgpt.com/docs/computer-use 。本机生成的 schema 验证了 dynamicTools、item/tool/call 与 inputImage 输出结构。

## 工具路由与旧会话升级

旧对话未注册 dynamicTools，原执行记录实际出现 cua_repl 工具失败。v2 使用唯一工具名 skyrail_computer，并显式注入项目 skill；启动参数仅作用于 Skyrail 子进程，不改用户全局配置。mcpServerStatus 仍可能列出宿主提供的工具，因此这不是严格工具白名单隔离；真实模型路由测试和应用确认构成当前验证边界。

旧 product thread 的 codexThreadId 版本不符时，新建运行时并归档 previousCodexIds；本地消息不删除，最近三十条正文以历史数据输入新线程，不能把旧失败声明当作当前权限事实。原生权限继续由 macOS 强制执行。

默认逐次确认；allow_session 由聊天授权卡或电脑面板显式设置，绑定随机 sessionId，不持久化到磁盘。重新绑定窗口、断开或重启服务恢复 ask。聊天删除为可恢复的 deletedAt 标记，默认快照不返回被删除的正文，“最近删除”只返回标题及恢复入口。
