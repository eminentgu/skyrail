# 验证记录

## 2026-11-03：默认完整权限与文件传输

- 构建及 94 项测试通过。新增覆盖权限持久化、同 session 变更权限、typed approval 分发、原生历史附件保留、Unicode 二进制上传、同名隔离、超限 / 中断清理、目录越界、跨对话附件与符号链接。
- 本机服务协议 9。默认 fullAccess=true；权限设置保存后仍为 true，start / resume 使用 never + danger-full-access，turn/start 明确设置 dangerFullAccess，未修改用户全局 Codex 配置。
- **真实 Codex 轮次**通过当前 Skyrail UI 提交：读取 90 字节上传附件，原样写出项目 `skyrail-transfer-result.txt`，在 Desktop 创建专用测试文件、读回比对并删除。原生 commandExecution exitCode=0，实际 stdout 包含 project_verified=true、desktop_write=true、desktop_readback_match=true、desktop_test_file_deleted=true。
- 从对话中点击真实下载链接，Chrome 保存到 Downloads。读取浏览器下载文件与原上传内容、项目生成文件逐字节一致。任务完成后的原生历史同步仍保留附件元数据及下载链接。
- 外网 `skyrail.eminentgu.top` 已验证登录 303、bootstrap 200、二进制上传 201、项目文件下载 200，下载内容与原上传一致。
- 上传使用真实二进制接口，201；无会话访问返回 403，父目录越界请求返回 400。界面文件选择器已成功触发，但当前 ChatGPT Chrome 扩展未启用 Allow access to file URLs，因此自动化选择本地文件未完成；不将接口成功声称为自动化 picker.setFiles 成功。用户手动文件选择入口仍可使用。
- 手机 390×844 与 320×568 的文件抽屉、上传 / 下载 / 添加消息按钮与默认已开启的权限开关已检查；320px 页面无横向溢出。macOS 系统授权状态与 Skyrail 任务权限分开显示。

## 2026-11-01：单应用选择与手机触控板

- 构建与 82 项测试通过。新增手势状态机覆盖：移动不按下按钮、触控板与直接点按坐标、双击、连点拖拽、第二指取消拖拽、缩放后抬指不点击、点按紧接双指缩放不误触、手势取消、光标边界和缩放 / 平移边界。
- Chrome 390×844、320×568 手机尺寸模拟验证范围选择与控制布局，无横向溢出。以 CDP 触控输入验证合成 RFB 的移光标、两次点击和双指缩放（1 → 1.67 倍）；未使用真实 Mac 密码。原生窗口合成通道的点按坐标为 x=0.6111、y=0.5，印证移动光标与轻点位置相互独立。
- 最终版真实应用画面 2 倍放大时继续滑动，画面平移到 x=-258px，光标保持在视口内 x=332px；再一键恢复到 1 倍。
- noVNC 备用光标路径以 Chrome touch emulation 验证：网页 body 的备用 canvas opacity=0；切到对话后画面内光标 hidden=true、rendered=false。保留连接时没有把远程光标带进对话。
- **真实 Mac 窗口验收**：在 Skyrail 单个 App 模式选择 Calculator，通过浏览器触控板手势移动光标并轻点，原生计算器从 1,024 变为 7；放大到 2 倍后再移动并轻点，从 7 变为 78，均由独立原生 AX 读取确认。只传输所选窗口画面，未共享其他应用。无须重新签名或修改 macOS 权限。
- 仍需真实 iPhone / Safari 与 Android 真机测试。浏览器触控模拟、协议端事件和本机 Calculator 成功不等同于已完成所有手机、应用弹窗、双击文件和拖拽控件兼容验收。系统断开恢复锁屏的管理员设置仍未由本轮更改。
- 自动安全扫描覆盖 10 个前端文件，未报告问题；质量脚本只识别一个 JS 文件，未覆盖 TSX / MJS，因此额外人工检查了新手势模块、noVNC 适配层、原生输入队列和隐藏视图的释放逻辑，不把脚本结果当作全面审计。

## 2026-11-01：两页导航、项目会话和不断线交接

- 本机服务已升级协议 8；真实 Codex 元数据读取 30 条会话、归为 6 个项目，所有会话均带项目描述。系统 RestoreMachineState 仍为默认值，等待本人运行管理员脚本。

- 构建与 69 项测试通过；新增覆盖 RFB 完整 / 分片握手、交接时的输入过滤和按键释放、非法包关闭、保留连接的查看 / 接手、设备切换、Git 项目与 worktree 归类，以及运行版构建快照不随源码构建变化。
- Chrome 390×844 模拟流程已验证：保留 Hark 渐变与半透明面板；主导航只有对话 / 电脑；管理按钮在对话页；原生项目列表将同一项目两条会话折叠在一起。
- 合成 ARD 桌面认证一次后发送测试对话，再回到电脑仍为同一连接的只看画面模式。再接手并输入 Q7 / 回车后，测试端记录 6 个按键事件，认证次数仍为 1。该流程未调用真实模型或使用真实 Mac 密码；真实系统解锁和断开后不锁屏仍需管理员设置与本人验证。
- 本机无密码 sudo 修改 RestoreMachineState 未获系统授权，设置尚未由本轮自动修改；一次性脚本已准备。不得将不断线交接等同于已更改系统断开恢复策略。

## 2026-11-01：电脑优先与手机交互重构

- 当前构建及 59 项测试通过。UI 默认整台 Mac，Codex 为次级导航；会话管理、复制回复、统一深浅色、登录页和系统用户名预填已实现。
- 真实计算器窗口输入验收发现：Chrome 触屏模拟通过原窗口通道发送了单次 tap，前端得到成功回执，但 Calculator 仍显示原来的 12。因此没有把原生窗口点击标为通过，人工主路径改走系统级整桌面 RFB。
- 系统屏幕共享已启用，真实浏览器已到达 ARD 账户认证页，并预填本机用户名。未获取或输入真实 Mac 密码，等待本人认证后验证原桌面、新应用和弹窗。
- 使用独立合成桌面与虚构账户，经 Chrome 的触摸事件模拟完成 ARD 握手、全桌面画面、点按和输入；服务记录 3 个指针事件和 10 个按键事件。切换到 Codex 后连接保留，返回仍为 live；结束控制后 active=false。此结果不代表真实 iOS / Android 软键盘或 Mac 弹窗验收通过。
- 检查 320×568 的深色手机布局、390×844 竖屏及 1440×900 桌面。320px 和 1440px 下页面 scrollWidth 等于视口宽度，320px 下输入框位于底部导航之上。检查会话抽屉和键盘焦点；实际手机横屏与软键盘仍需真机验证。
- 本机服务协议升级为 7；原已授权 Swift 程序未重新签名。系统级桌面身份认证与窗口工具授权仍分别管理。
- 常驻版切换为静态构建产物，静态响应不注入开发热更新；测试覆盖 MIME / 缓存、HEAD、缺失构建、目录穿越与符号链接越界拒绝。

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

## 2026-11-01：连接、锁屏与同一 session 双客户端验证

- 确认当时 Mac 实际处于锁屏：电脑使用工具拒绝操作，CoreGraphics 状态检测也返回 locked=true。此时两项系统权限仍为 true；应用 AX 只返回菜单 / 空窗口数组，采集可产生旧图或零帧。因此不能把之前的空控件树单独归因于菜单数量，也不能把权限 true 当作已解锁。
- 加入独立只读 `SkyrailSessionStatus`，本机仅编译此组件，保留原已授权 Mac app 二进制，避免再次改变 TCC 签名。HTTP 锁屏绑定验证返回 423，模型工具在申请应用卡之前拒绝锁屏 GUI 操作。
- 连续采集加入零帧 / 错误恢复。测试覆盖 PNG multipart 输出、旧采集迟到帧丢弃、换窗后的在途帧丢弃、回退错误时关闭画面；没有自动重试任何输入。锁屏期间未宣称真实串流或按钮操作通过。
- 原生历史只读回读：现有业务会话的 3 轮、17 条可见消息完整读回；浏览器记录中不含截图 base64。
- 初次双客户端验收暴露 active writer 冲突。仅调用 unsubscribe 未能立即释放；按官方协议存在无订阅者保留期。改为每个活动会话一个写入进程，在完成后关闭进程并等待退出。
- 修订后真实模型三轮验收通过：Skyrail 回复 → 第二个 app-server 客户端在同 ID 追加 → 关闭第二端连接 → Skyrail 继续并正确读取第二端标记。最终同一 native ID，3 轮、6 条消息；Codex app 的 read_thread 也能读到同 ID、相同标题与 3 轮记录。
- UI 增加原生会话搜索 / 分页导入、复制编号、手动同步及 5 秒自动同步，服务重连时自动连接 Codex。构建检查通过；Mac 锁屏期间未完成浏览器视觉或真实 GUI 输入复验。
- 本轮最终 48 项单元测试、TypeScript / Vite 构建通过；技能格式校验通过。安全模式扫描未命中，不能替代完整安全审计。三个专用 QA 会话已在 Skyrail 软删除、在 Codex 可恢复归档，业务会话未删除。

## 2026-11-01：人工全桌面通道

- 前端构建和 53 项测试通过。新增验证包括网关 upgrade 登录 Cookie / Host / Origin / 路径校验、本地票据、二进制转发、并发接管拒绝、断线与超时回收、旧票据隔离、人工控制期间原生 GUI 禁止派发。
- 独立 loopback 模拟桌面经真实浏览器 noVNC 完成 RFB 握手，收到合成画面；测试服务记录 10 个按键事件及 10 个指针事件，断开后 active=false。另一轮模拟 Apple RFB 003.889 / ARD 握手，虚构账户认证后收到画面。测试服务不验证真实系统密码，也不连接实际 Mac / Codex。
- 检查 390×844 竖屏，画面、原尺寸 / 平移、软键盘与特殊键可见。当前 IAB 不支持 Fullscreen API，界面显示兼容提示；原生浏览器全屏与手机真机仍待验证。
- 本机服务重启后协议升级为 6、服务 ID 已变化；公网登录 303、bootstrap / desktop status 200、未登录 WebSocket 401。
- 本机系统屏幕共享仍为 disabled，5900 无监听；电脑使用工具也报告 Mac locked。因此真实系统认证、登录画面输入、原桌面恢复及交还 Codex 仍未验收，未把模拟测试标为真实解锁通过。


## 2026-11-03：占用恢复、桌面布局与本地文件超时

- 104 项测试与 TypeScript / Vite 构建通过。新增测试覆盖写入进程退出屏障、共享连接影响、指纹变化拒绝、替代占用者不被终止、文件近似候选、单层范围、可读性和卡住的子进程被终止。
- 浏览器中对专用真实 Codex 测试进程点击“确认结束占用并连接原会话”：该进程退出，原 native ID / 历史 / 草稿保留，下一条消息得到“连接恢复成功。”。未以删除锁文件或新建会话代替恢复。
- 1440×900 合成对话完成桌面视觉检查。390×844 的 header / chat / messages / composer / navigation 几何、padding、字体和 display 与旧构建一致；截图差异仅在鼠标标记覆盖区。移动真机操作未在本轮重新验收。
- 本机交互环境可直接读取用户指定 Word，结构为 46 段、5 条批注、0 插入 / 0 删除修订；文件名和正文不作为公开测试夹具提交。Skyrail 常驻服务的两次目录定位均在 8 秒后明确返回 timeout / incomplete；尚不能把交互进程成功读文件当成常驻进程成功。
- 系统日志把该常驻文件检查归属到 local.skyrail.mac，并报告 SystemPolicyAllFiles preflight authValue=0；只读核对当前该应用有 Documents / FileProvider 记录，无 Desktop 授权记录。此证据支持检查常驻应用权限，不能单独证明目录阻塞的全部原因。已请求本人在完全磁盘访问中授权后复验，不修改系统授权库。
- 常驻服务已升级到协议 10。安全 / 质量技能脚本不识别 mjs / tsx 扩展，初次扫描 0 文件不能算安全通过；相关进程终止和文件检查边界另行代码审查。

- 精确路径 probe 在常驻服务中同样于 8 秒后超时，没有执行正文提取；因此文件内容读取故障仍待本人系统授权后复验。采用支持的 js / ts 后缀临时副本补扫 3 个新增源文件：无高危 / 中危发现，3 条 console.log 提示是 CLI 必需的 JSON 标准输出；质量扫描仅提示长行。这是模式扫描和局部审查，不是完整安全审计。

## 2026-11-03：图片聊天

- 108 项单元测试通过，TypeScript / Vite 构建通过。新增签名识别、文档不变成图片输入、附件 mediaType 重新验证、超限图片回收测试。
- 本机常驻服务协议 11，通过 Chrome 原生系统文件选择器上传合成 PNG。发送前缩略图真实解码为 720×420。Codex 原生记录含 input_image，未调用工具，正确回答图片中的四位数字与两个红圆；没有把答案放在消息文字或文件名中。
- 同一 native ID 同步 / 刷新后图片、附件元数据和回复保留。浏览器剪贴板真实粘贴 PNG 成功添加缩略图；模拟慢速上传后点击取消，待发送附件没有新增，发送保持禁用；恢复网络设置与原剪贴板。
- 390×844 布局无横向溢出（document scrollWidth=390），缩略图与图片模态预览可用，模态宽 366px；关闭预览和移除附件成功。手机真机相册与 IME 未在本轮验收。拖放入口已实现，未以剪贴板测试代替真实 OS 拖放验证。
- 登录后 raster preview 200 / image/png / nosniff，未登录 403，命名为 PNG 的 SVG 415。测试图片和对话位于忽略目录，不发布业务数据。HEIC / SVG 暂不支持原生识图；仅原生导入、没有 Skyrail 附件元数据的历史图片仍是占位。

## 2026-11-03 — Adaptive video and bilingual Web UI

- macOS Calculator was captured by the installed service using the standalone capture helper. The 640-pixel data-saver frame was 12,304 bytes and the 674-pixel high-quality frame was 30,189 bytes.
- Chrome at 390 ms latency and 24 KB/s download switched to Data saver and decoded a 640-pixel frame. Offline and online transitions preserved the unsent draft. Switching between English and Chinese preserved the draft as well.
- After taking control from Chrome, clicks on the remote Calculator entered 3 + 4 and the native accessibility tree showed 7. The keyboard pane stayed closed and the video rectangle kept its dimensions throughout the clicks.
- The service supports separate capture-only builds for installations with macOS grants tied to the existing application signature. Re-signing the complete app failed permission preflight on the test Mac. The original app was restored and capture-only operation was verified using the existing grant.
- The synthetic RFB server received a quality change from 7 to 2 during browser throttling. Blocking the renewal HTTP route briefly kept the same authenticated connection open. macOS Screen Sharing encoder-specific bitrate was not measured.
- Compact bootstrap sends conversation summaries. The live subscription sends only the selected transcript's latest message window, and older messages can be requested by ID.
