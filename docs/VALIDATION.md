# 验证记录

2026-10-31，macOS 本地开发。详细结果随本次验证补充。

本版本的构建、模拟控制权单元测试与 app-server 握手不能证明真实电脑流、输入互斥、恢复或性能目标。Linux 桌面环境尚未安装，A01–A12 尚未整体通过。

## 本次结果

- TypeScript 检查和 Vite 7.3.7 生产构建通过。
- 三个控制演示测试通过：epoch 冲突、暂停/交还递增、无效 owner 拒绝。
- HTTP 检查：未认证命令 403、过期 epoch 409、跨 Origin 403。
- 本机 Codex 0.165.0-alpha.1.2：initialize 握手成功、model/list 返回 8 项、thread/start 成功；真实模型返回 `SKYRAIL_OK`，turn/completed 状态为 completed。
- npm audit 在升级 Vite 后报告 0 vulnerabilities（仅代表本次依赖数据库检查）。
- 浏览器工具报告 Local browser use is disabled in Work settings，未能截图检查视觉与键盘流程。上述界面能力依据源码和构建，尚未经浏览器交互验收。

本次没有运行电脑执行端或真实控制交接，也没有完成重启、三轮聊天、附件、审批与断线综合验收。依赖升级期间旧开发进程报过模块缺失，重启后继续验证。
