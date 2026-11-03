export const repository = 'https://github.com/eminentgu/skyrail';
export const pages = [
 {id:'overview',group:'start',en:'docs/README.md',zh:'docs/README.zh-CN.md',title:['Documentation','文档中心'],description:['A clear path from first conversation to local Computer Use.','从第一次对话，到本地 Computer Use，找到下一步。']},
 {id:'getting-started',group:'start',en:'docs/GETTING-STARTED.md',zh:'docs/GETTING-STARTED.zh-CN.md',title:['Getting started','安装与开始'],description:['Start locally, then enable only the capabilities you need.','先在本地运行，再按需启用电脑能力。'],cover:'setup-flow'},
 {id:'visual-guide',group:'start',en:'docs/VISUAL-GUIDE.md',zh:'docs/VISUAL-GUIDE.zh-CN.md',title:['A visual tour','图解使用指南'],description:['Meet the interface, one view at a time.','用图像认识界面与工作流程。'],cover:'workspace'},
 {id:'remote-access',group:'use',en:'docs/REMOTE-ACCESS.md',zh:'docs/REMOTE-ACCESS.zh-CN.md',title:['Remote access','远程访问与运维'],description:['Your Mac stays at home. Your work can travel.','Mac 留在原地，工作可以随行。'],cover:'remote-path'},
 {id:'troubleshooting',group:'use',en:'SUPPORT.md',zh:'SUPPORT.zh-CN.md',title:['Troubleshooting','问题与排障'],description:['Find the right check before changing your setup.','先找到对应问题，再调整运行环境。'],cover:'permissions'},
 {id:'security',group:'use',en:'SECURITY.md',zh:'SECURITY.zh-CN.md',title:['Security & permissions','安全与权限'],description:['Understand the boundary between the agent, browser and Mac.','理解模型、浏览器和 Mac 之间的权限边界。'],cover:'permissions'},
 {id:'architecture',group:'build',en:'docs/ARCHITECTURE.md',zh:'docs/ARCHITECTURE.md',original:'zh',title:['Architecture','系统架构'],description:['The runtime, native tools and two computer-viewing paths.','运行时、原生工具与两条电脑画面通道。'],cover:'architecture'},
 {id:'contributing',group:'build',en:'CONTRIBUTING.md',zh:'CONTRIBUTING.zh-CN.md',title:['Contributing','参与贡献'],description:['Build, verify and propose a focused change.','开发、验证并提交清晰的改动。']},
 {id:'maintainers',group:'build',en:'docs/MAINTAINERS.md',zh:'docs/MAINTAINERS.md',title:['Maintaining Skyrail','项目维护'],description:['Protected branches and a repeatable release process.','分支保护与可复查的发布流程。']},
 {id:'design',group:'build',en:'docs/DESIGN.md',zh:'docs/DESIGN.md',original:'zh',title:['Design direction','设计方向'],description:['The decisions behind a calm, continuous workspace.','轻盈、连续的工作体验背后的设计决策。']},
 {id:'plan',group:'build',en:'docs/PLAN.md',zh:'docs/PLAN.md',original:'zh',title:['Implementation plan','实施计划'],description:['Implementation history and planned milestones.','实施记录与阶段规划。']},
 {id:'computer-use-skill',group:'build',en:'skills/skyrail-computer-use/SKILL.md',zh:'skills/skyrail-computer-use/SKILL.md',original:'en',title:['Computer Use skill','Computer Use 技能'],description:['The instructions used by Skyrail’s native computer tool.','Skyrail 原生电脑工具使用的技能说明。']},
 {id:'validation',group:'records',en:'docs/VALIDATION.md',zh:'docs/VALIDATION.md',original:'zh',title:['Validation records','验证记录'],description:['What was checked, where, and with which limits.','逐项记录验证环境、结果与边界。']},
 {id:'local-validation',group:'records',en:'docs/LOCAL-VALIDATION-2026-11-03.md',zh:'docs/LOCAL-VALIDATION-2026-11-03.md',title:['Local acceptance','本地验收'],description:['The fresh-checkout acceptance from November 3, 2026.','2026 年 11 月 3 日新工作区验收记录。']},
 {id:'remote-unlock',group:'records',en:'docs/REMOTE-UNLOCK.md',zh:'docs/REMOTE-UNLOCK.md',original:'zh',title:['Desktop login acceptance','桌面登录验收'],description:['Manual login, recovery and the desktop-control boundary.','人工登录、恢复与桌面控制边界。'],cover:'control-handover'},
 {id:'changelog',group:'records',en:'CHANGELOG.md',zh:'CHANGELOG.md',original:'zh',title:['Changelog','变更记录'],description:['Changes to the product over time.','产品变化的时间记录。']},
 {id:'third-party',group:'records',en:'THIRD-PARTY-NOTICES.md',zh:'THIRD-PARTY-NOTICES.md',original:'en',title:['Third-party notices','第三方声明'],description:['Dependencies, licenses and attribution.','依赖、许可证与来源说明。']},
 {id:'publishing',group:'build',en:'docs/DOCUMENTATION.md',zh:'docs/DOCUMENTATION.zh-CN.md',title:['Publishing the docs','文档网站维护'],description:['One Markdown source, a static website, a protected release.','Markdown 单一来源、静态网站与受保护的发布。']},
];
export const groups = {start:['Start here','开始使用'],use:['Use Skyrail','日常使用'],build:['Build & maintain','开发与维护'],records:['Evidence & history','验证与记录']};
