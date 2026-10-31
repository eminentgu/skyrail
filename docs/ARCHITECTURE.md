# 架构与当前取舍

浏览器 React UI → 同源 Node HTTP / SSE 服务 → Codex app-server stdio。未来电脑帧和输入使用独立连接，由执行端仲裁器强制控制权。

目录：apps/client 是界面；apps/local-service 是会话协调器；packages/codex 封装运行时协议；packages/computer 目前只提供控制演示比较函数；workspaces 是每线程目录，默认不入 Git。

前端不获得长期 Codex 凭据。服务通过用户已认证的本地运行时工作，不复制网页登录态。服务启动时不自动启动模型任务，连接由按钮触发。聊天使用 CLI 默认模型，不硬编码账户可用性。

设计偏差：首版 SSE 替代 WebSocket，原子 JSON 替代 SQLite，手写轻量消息组件替代 assistant-ui，以缩小首轮兼容验证的依赖面。电脑租约仅用于模拟；尚无 TTL、clientId、执行端 drain 或新截图，因此不对外声称实现安全接管。

正式执行端不能复用演示 transition 函数直接授予输入。必须先封闭旧 epoch，等待在途动作结束，释放按键并观察，随后确认新租约。协调器失联时 fail closed。

官方协议参考：https://learn.chatgpt.com/docs/app-server 。当前版本从本机 `codex --version` 得出；升级前生成 schema 并重跑兼容检查。
