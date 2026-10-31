# Contributing to Skyrail

感谢参与。Skyrail 是早期 macOS 项目，欢迎中文或英文 Issue / PR。先查看已有问题；较大的架构或协议变更请先开 Issue 说明用途和取舍。

## 本地开发

需要 macOS 14+、Xcode Command Line Tools、Node.js 22+，真实聊天另需已登录的 Codex CLI。

```sh
npm ci
npm run setup:mac
npm run dev
```

`CODEX_BIN` 可以指定 Codex 路径。Linux CI 可以检查前端和纯 JavaScript 测试，不能证明 Mac 行为。原生程序采用临时签名，重编译可能要求重新授予权限。

## 提交前

```sh
npm test
npm run build
npm run setup:mac  # 修改 Swift 时，在 Mac 上执行
```

输入、权限、控制权、会话迁移等行为变更需有针对性的回归测试。文案和样式变更附截图、尺寸和交互说明。触屏变更分别记录浏览器模拟与实际手机结果；没有设备时明确写未验证。真实模型冒烟测试会调用用户的 Codex，CI 不运行它们。

PR 请说明解决的问题、行为变化、验证结果和剩余限制。不要附 `.data/`、`workspaces/`、Cookie、聊天记录、远程密码、Cloudflare token 或包含私人桌面的截图。使用虚构数据复现。

## 设计与代码

- 延续 [设计依据](docs/DESIGN.md) 与 [.impeccable.md](.impeccable.md)。
- 视频采集与模型观察分离。配置帧率不是实测性能。
- 电脑写操作遵守线程、应用、epoch 和客户端控制权；不能绕过闸门补做失败操作。
- 结果未知的写操作不能自动重试；错误、取消和断连需释放输入。
- 不为新依赖复制整套实现；第三方代码与资源需保留许可和来源。

提交贡献即表示你有权以项目 MIT 许可证提供这些内容。维护为尽力支持，没有响应时限或商业 SLA。
