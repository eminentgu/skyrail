# Maintaining Skyrail / 维护指南

## Protected main / main 保护

The repository owner is `eminentgu`. CODEOWNERS records maintenance responsibility; it does not grant or revoke repository access. Public users can fork and propose PRs without receiving write access.

仓库所有者为 `eminentgu`。CODEOWNERS 只声明维护归属，不授予或撤销仓库权限。公开用户可以 fork 和提交 PR，不因此获得写权限。

The `main` ruleset targets the default branch (currently `main`) with:

- Active enforcement, no bypass actors.
- Pull requests required, zero required approving reviews for single-maintainer operation.
- All review conversations resolved before merge.
- Required GitHub Actions checks: `Node checks (ubuntu-latest)` and `Node checks (macos-15)`.
- Branch must be up to date before merge.
- Branch deletion and force pushes blocked.

规则针对默认分支（当前为 main）启用：无绕过名单、必须 PR、讨论须解决、上述两项 GitHub Actions 检查通过、分支须最新、禁止删除和强推。单人维护设置为零个必需审批，避免作者不能自审而无法合并。没有开启 Restrict updates；在没有绕过名单时，该项会连正常 PR 合并也阻止。

Only repository users with write access can merge. Requiring one other approving reviewer would block an owner's own PR when there are no other eligible maintainers. If collaborators are added, revisit access permissions and review requirements together. Renaming the CI jobs or changing the default branch also requires checking the ruleset so it cannot wait on a nonexistent check.

只有具备仓库写权限的人可以合并。未来增加协作者时，应同时复核访问权限和审批人数；CI 改名或默认分支变化时，复核规则，避免等待不存在的检查。

Verify live settings at [Rulesets](https://github.com/eminentgu/skyrail/settings/rules) and repository collaborators at [Access](https://github.com/eminentgu/skyrail/settings/access). This document describes the intended setup; GitHub's live settings remain authoritative. Do not test protection by force pushing or deleting main.

通过以上设置页复核实时规则和协作者。文档描述预期配置，以 GitHub 实际设置为准；不要通过强推或删除 main 来测试保护。

## Release readiness / 发布前

Use the [setup guide](GETTING-STARTED.md) and [operation guide](REMOTE-ACCESS.md). Record native, chat, desktop, handover and phone results separately. Do not promote simulated tests, successful compilation, responding endpoints or permission preflights to end-to-end acceptance.

按[安装指南](GETTING-STARTED.zh-CN.md)和[运维指南](REMOTE-ACCESS.zh-CN.md)验证，分别记录原生、聊天、桌面、交接和手机结果。模拟测试、编译成功、接口应答或权限预检都不代表端到端通过。
