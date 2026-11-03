# Local validation · 本地验证 · 2026-11-03

This is a fresh-checkout result, separate from historical deployment records. Source baseline: `a572d16`; changes on `codex/product-docs-local-validation`. No macOS privacy grants, Screen Sharing configuration, administrator settings, or existing deployment services were changed.

本记录来自新下载的工作区，与历史部署验证分开。基线为 `a572d16`，改动位于 `codex/product-docs-local-validation`。未改变 macOS 隐私授权、屏幕共享、管理员设置或已有部署服务。

## Environment / 环境

- macOS 26.7.1; Node.js 25.9.0; Codex CLI `0.165.0-alpha.1.2`; Xcode Command Line Tools available.
- CI continues to use Node.js 22. The declared minimum is now 22.12.0 to match Vite's runtime requirement.
- Initial `npm ci` failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`; `NODE_USE_SYSTEM_CA=1 npm ci` succeeded (124 installed packages, audit reported zero vulnerabilities). TLS verification remained enabled. This is an environment fix, not a dependency change or a comprehensive security assessment.

CI 仍使用 Node.js 22；最低版本明确为 22.12.0，以符合 Vite 要求。首次依赖安装因证书链失败，使用系统 CA 后成功，保留 TLS 校验。安装审计报告无漏洞不等于完整安全审计。

## Passed / 已通过

- Existing 94 JavaScript tests; frontend TypeScript check and Vite build.
- Swift adapter and session-status helper compilation, plus ad-hoc signing. One existing `fullPath(forApplication:)` deprecation warning remains.
- Built frontend served from loopback on a separate local port; page and settings loaded.
- Composer switched to workspace approval mode in this test checkout. A new dedicated conversation returned `SKYRAIL_CHAT_OK` from real Codex without tools and displayed synchronized native history.
- Screen Sharing unavailable state displayed an explicit setup explanation and disabled the connect button.
- At a simulated 390×844 viewport, both conversation and desktop setup views had document width 390px, without page-level horizontal overflow. The viewport was reset after testing.
- Doctor human-readable and JSON outputs exercised; missing optional Codex executable reports a warning without marking UI prerequisites unavailable. Version/permission preflight does not imply real model or GUI success.

上述结果包括：94 项原有测试、前端检查 / 构建、原生编译、真实受限聊天与历史同步、屏幕共享缺失提示、390px 页面布局，以及诊断命令。编译保留一项已有弃用警告；手机检查仅为尺寸模拟。

## Permission preflight / 权限预检

- Accessibility: **not granted for this launch**.
- Screen Recording: preflight granted; one display reported. No screenshot/capture acceptance was performed through the Skyrail adapter.
- Session detector: available and unlocked during the check.
- Screen Sharing: no RFB banner received from loopback 5900.

辅助功能未授权；屏幕录制预检已授权、报告一个显示器；会话未锁屏；屏幕共享端口未返回协议应答。权限归属可能随启动方式或临时签名变化，不能套用于别的部署。

## Not validated / 未验收

Real app clicks/typing, app-stream frame quality, desktop account authentication, lock-screen login, human/agent control handover on a real desktop, phone hardware/IME, external HTTPS tunnel access, and background login service installation. Local chat success does not establish any of these.

未验收真实应用输入、串流质量、桌面认证、锁屏登录、真实桌面交接、手机真机 / 输入法、外网 tunnel 或登录常驻。没有自动授予系统权限或为此安装常驻服务。

## Main protection / main 保护

The existing ruleset was disabled and targeted no branches. It was activated for the default branch, with PRs, both current CI jobs, up-to-date branches, resolved threads, blocked deletion/force pushes and no bypass actors. Zero approving reviews are required for single-owner operation. GitHub displayed `Ruleset updated`; the ruleset API independently returned `active` with these rules. No collaborator access was added. See [maintainer notes](MAINTAINERS.md).

原规则未生效且没有匹配分支。现已启用并匹配默认分支，要求 PR、两项 CI、分支最新、讨论解决，禁止删除 / 强推，无绕过名单。单人维护不要求第二人审批。已通过 GitHub 页面与 API 回读确认，未新增协作者权限。
