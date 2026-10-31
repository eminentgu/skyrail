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

## 原生 Mac 版本 0.2 2026-10-31

- 本机 Apple Swift 编译与临时签名成功，最低目标 macOS 14。
- 原生 health 检测 screenRecording=true；辅助功能授权仍需独立核验。
- 初次捕获遇到 CGS_REQUIRE_INIT 断言，已通过初始化 NSApplication 修复。
- 修复后直接原生捕获 Calculator 成功：674×408，PNG data URL 124322 字符。AX 未授权时返回明确的只读提示。
- 真实 Codex dynamicTools 测试：模型调用 mac_computer，客户端处理 item/tool/call 并返回工具内容，最终 SKYRAIL_TOOL_OK，turn 状态 completed。该测试使用固定工具响应，只证明协议接通，不证明 GUI 操作。
- 通过系统 Safari 打开本地页面，实际检查分栏、应用选择、权限提示及截图布局。前次“无法视觉验收”仅指内置浏览器禁用，本次已使用原生 Safari 完成页面查看。
- 服务端控制测试覆盖跨线程、旧 epoch、在途排空、排队取消、交还观察失败与并发交接。

仍需真实辅助功能权限后核验点击输入和模型计算闭环；完整 A01–A12 未全部完成。没有将协议测试冒充电脑操作结果。

## 实时串流与体验修复 2026-10-31

观看链路已从两秒截图改为 ScreenCaptureKit SCStream 连续捕获、独立进程 JPEG 编码、Node MJPEG 传输。观看与模型观察完全分离，不修改 AX 索引。

实测证据（本机 macOS，Calculator 674×408，无网络延迟模拟）：

- 原生串流一次 6 秒采样接收 13 帧、362221 字节，包含改变 Calculator 内容的操作；原生心跳持续到达。
- 同源 HTTP/MJPEG 一次约 5 秒采样接收 69 帧、1875412 字节；响应 200，Content-Type 为 multipart/x-mixed-replace。
- Safari 实际界面显示实时画面、人工接管按钮；服务统计一段采样为 14.9 FPS，Codex 获得控制权期间仍持续串流。这是本机局部采样，不能外推为各种窗口和负载下稳定 15 FPS。
- 无会话串流请求返回 401，跨线程请求返回 409。聊天快照不再包含图像字段。
- 12 项自动测试通过，覆盖分包解码、帧长度边界、慢客户端背压、切换应用清除旧帧、失败绑定不提交新目标及控制交接。
- 修复发送失败丢草稿、未连接时 Enter 误发送、刷新后事件订阅缺失、重启令牌更新、跨线程旧画面、窗口绑定失败后状态误报。
- 发现共享承载 Skyrail 的浏览器窗口会产生正常的镜像反馈，已增加具体窗口选择与提示；建议另选任务窗口。

当前传输为 MJPEG 连续串流，没有 H.264/WebRTC 硬件编码，不宣称音频、远程输入或广域网低延迟。没有新的完整模型 GUI 任务验收结论。

## 断开窗口与画面直控修复

- 新增断开接口：先验证绑定/epoch，再撤销输入，释放键鼠，关闭串流并清除 app/window/thread/frame；不会关闭用户应用。
- 新增浏览器画面输入：点击、左右键、拖动、滚轮、文字/组合输入/粘贴，以及有限的导航键和字母快捷键。Escape 退出键盘捕获；浏览器/系统保留的快捷键无法保证转发。
- 输入在浏览器有序发送，服务端在派发前再次核对线程、epoch、humanClientId，另一标签页不能沿用旧人工控制权。
- 16 项测试通过，新增缩放留白坐标映射、跨客户端拒绝、旧 epoch 队列丢弃与断开绑定清理。
- Safari 实测：连接 Calculator 后出现实时串流、断开窗口按钮和“可直接点击与输入”；通过页面中的串流图像点击并输入字符 `8`，独立读取 Calculator AX 显示结果 `8`。这是浏览器→产品输入接口→Swift→真实应用的文字输入证据。全量快捷键、拖拽和中文跨应用矩阵尚未完整验收。

### 用户反馈后的鼠标路径修订

用户确认键盘正常、鼠标点击不对。已将点击改为所选应用坐标命中 AX 元素后执行原生 Press；不支持 AX 的目标回退到带 windowNumber 和窗口局部坐标的 NSEvent。拖动延迟到实际移动才派发 down，防止与语义点击重复执行；采集排除窗口阴影以对齐画面与窗口边界。正常关闭时释放输入。

修订后的 Swift 编译、前端构建与 16 项测试通过。准备真实按钮验收时系统报告 Mac locked，无法完成点击复验。鼠标修复仍须解锁后的真实验收；不能将此前键盘 `8` 的成功当作鼠标通过。先前“尚不宣称远程输入”的限制已由新增画面输入实现取代，但拖拽、特殊键与跨应用矩阵仍未完成。

### 解锁后的真实复验通过

2026-10-31，在用户解锁后继续执行。初次绑定仍遇到 ScreenCaptureKit audio/video capture failure，重启本地服务和原生辅助进程后恢复；这只证明本次恢复有效，尚未实现锁屏后的自动重建。

- 在系统 Safari 中连接 Calculator，确认约 14.8–15 FPS 的连续画面及人工输入状态。
- 只通过 Safari 内的串流画面坐标点击数字 7，再点击 +、2、=；没有使用键盘输入数字，也没有直接点击 Calculator 原窗口。
- 独立读取 Calculator 的辅助功能树，确认 Last Expression 为 `7 + 2`，Edit field 为 `9`。因此具体 Calculator 按钮的画面坐标映射与原生点击路径已通过，取代上一节的“待解锁复验”状态。
- 点击页面“断开窗口”，画面和输入控件消失，页面回到未连接状态。
- 服务端快照确认 app=null、threadId=null、owner=none、frame=null、stream.status=disconnected。
- 再次独立读取 Calculator 确认应用仍存在，结果仍为 9。断开没有关闭用户应用。

结论限于上述真实按钮和断开场景。非 AX 控件的 NSEvent 回退、右键、拖拽、滚动及跨应用矩阵仍需扩展验收，不宣称所有 macOS 应用已兼容。

## 工具路由、专用技能与授权体验

2026-10-31：用户原失败会话没有 toolVersion。读取旧 Codex 执行记录，发现两次 mcpToolCall 指向 cua_repl，状态 failed；不能将此等同于 macOS 系统权限未开。

- 新增项目技能 skyrail-computer-use，quick_validate 验证通过；每轮以 skill input 注入，并提供运行时指令。
- 真实模型路由测试 scripts/smoke-routing.mjs：用户请求“打开本机的计算器软件”，模型调用 skyrail_computer/open_app/Calculator，未调用其他 MCP。工具响应为测试桩，只验证路由。
- 在用户原来失败的会话中重发打开应用请求，自动升级为 skyrail-mac-v2，previousCodexIds 保留一项旧编号，历史消息保留。
- Safari 实际看到“允许并连接”卡片，确认后 open_app 完成，模型报告已打开 Calculator 并读取 1,024。系统权限仍由原生 helper 检查，未复制桌面插件的私有授权。
- 开启“本次连接全部允许”后，真实模型通过连续 press 执行 3+4，未逐步弹确认；独立读取 Calculator AX 确认 Last Expression 为 3+4，结果为 7。服务端 mode=allow_session，pending approvals=0，turn completed。
- 21 项测试通过，覆盖旧对话升级不丢历史、当前版本恢复、确认模式的会话绑定/撤销/换窗重置。
- Markdown 与工具活动卡已在 Safari 查看；修复旧样式把消息头渲染成独立大气泡的问题。外部 Markdown 图片默认不加载，不启用原始 HTML。

工具目录中可能仍列出宿主 MCP，未宣称运行时已严格隐藏所有替代工具；当前路由由显式技能、开发者指令及本次真实模型测试验证。

## 2026-11-01：触屏、远程入口和维护基础

- 25 项 Node 测试通过，包括新增的触屏 tap / scroll / drag 分离和网关认证回归；TypeScript / Vite 构建通过。
- Swift typecheck 通过；现有 `fullPath(forApplication:)` 有弃用警告。本轮未覆盖原生签名，以保留用户刚完成的授权。
- Chrome 390×844 页面检查：单栏工作区、权限区和 44px 按钮可见。独立本地测试页面加载真实 `InteractiveImage`，用 CDP touchStart / touchMove / touchEnd 输入，观察到轻点 down/up、滑动 scroll、显式拖拽 down/move/up；轻点不聚焦键盘，键盘按钮显示 Tab / 回车 / 退格。这是浏览器模拟，非手机真机或 Mac 写操作验收。
- 真实远程域名登录成功；登录回归保留 Host / Origin 限制，验证未登录 API 401、正确密码 303、Cookie 认证代理成功、错误 Origin 403、错误密码 401。
- 两项 macOS 权限重新检测均为 true。发现旧 wrapper 退出后残留 Node 占端口，已清理；新增 managed service 检查 wrapper 存活并退出。安装脚本迁移时只终止当前 checkout + Node 路径匹配的旧服务。
- 当前仍复现 ScreenCaptureKit `Failed to start stream due to audio/video capture failure`。replayd 日志显示 TCC Allow，随后 `Error in creating screenshot`；因此不能再把它简单归因于缺少权限，也不能宣称原生全屏点击修复通过。需要继续单独定位采集恢复与跨 Space 行为。
- iOS Safari、Android Chrome 真机、软键盘 / 中文 IME、真实应用滚动与拖拽尚未验收。
- MIT、贡献 / 支持 / 安全说明、Issue / PR 模板、GitHub CI 和 Dependabot 配置加入；CI 结果以推送后的 Actions 为准。安全模式扫描无命中，不能替代完整安全审计。
- 常驻进程强制重启复验：`launchctl kickstart -k` 后在约 6 秒内恢复到 Node 的父进程为原生 wrapper；两项权限仍为 true，未再连接残留孤儿进程。
- 未完成的验收已公开跟踪：[原生采集与全屏](https://github.com/eminentgu/skyrail/issues/1)、[手机真机矩阵](https://github.com/eminentgu/skyrail/issues/2)。

## 2026-11-01：熄屏与采集根因复现

同一份 SCWindow、尺寸和过滤器，在 Typora 与 Calculator 上对照配置：`showsCursor=true` 均报 -3811；`showsCursor=false` 均成功返回截图。改变阴影、透明度或 display filter 未解决问题。已将观察和 SCStream 均改为不采集系统光标，并明确禁用音频采集。

显示器熄屏时 `SCShareableContent.displays` 为空。测试版 SCStream 可报告 started / heartbeat，但没有帧；必须以收到实际帧判断可用。临时唤醒显示器后，修订后的采集进程在约 6 秒内收到 14 帧、384866 字节。另一次对照在熄屏前收到 14 帧，熄屏后即使向 Calculator 发送输入仍没有新帧；这不证明熄屏下的电脑操作或实时观看可用。

新增 MacPower：有观看者、模型轮次或窗口观察时按会话持有 caffeinate 电源断言，默认允许唤醒和保持显示器；没有活动后释放，不永久修改 pmset。`SKYRAIL_DISPLAY_MODE=headless` 只保持系统运行、不请求亮屏，供已有独立虚拟显示器的部署使用，不能单独解决无显示器的采集。

原生程序重编译后的临时签名改变，当前常驻服务两项权限重新变为 false，等待本人刷新系统授权；不能以交互诊断进程成功替代常驻服务验收。整机强制睡眠、关机、合盖行为及锁屏不通过本功能绕过。
