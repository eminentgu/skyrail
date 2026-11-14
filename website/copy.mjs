export const copy = {
  "en": {
    "lang": "en",
    "locale": "en_US",
    "name": "English",
    "tag": "LOCAL DEPLOYMENT · REMOTE ACCESS · LIVE STREAMING",
    "title": "Your Mac stays.<br>Your work goes<br><em>where you do.</em>",
    "lead": "Turn your own Mac into a remote AI workspace. Run Codex locally, watch Computer Use live in a browser, and take over when needed. Keep your sessions and files on the machine you already own.",
    "start": "Build your workspace",
    "tour": "Take a visual tour",
    "docs": "Documentation",
    "features": "Product tour",
    "github": "View source",
    "label": "LOCAL CODEX · LIVE COMPUTER USE",
    "version": "Early access · macOS 14+ · Open source",
    "screenLabel": "ACTUAL INTERFACE",
    "screenNote": "English product interface",
    "sectionTag": "ONE MAC. ONE CONTINUOUS WORKFLOW.",
    "sectionTitle": "Step away.<br>Keep going.",
    "sectionText": "Your runtime, project files and Codex sessions stay on your Mac. Connect securely from a desktop or phone browser to keep chatting, watch the screen and take control.",
    "stories": [
      [
        "01 / SESSION CONTINUITY",
        "Same session.<br>Next chapter.",
        "Reuse the original Codex session ID, history and working directory, organized by project. Keep the same context remotely. If another client holds the writer, inspect it and reconnect to the original session.",
        "Explore sessions and workspaces"
      ],
      [
        "02 / LIVE COMPUTER USE",
        "AI works.<br>You stay in view.",
        "Watch your Mac from the browser. Hand control to Codex while keeping the stream and pausing manual input. Take over when needed. Move between chat and computer without dropping the view.",
        "Explore streaming and handover"
      ],
      [
        "03 / REMOTE BY DESIGN",
        "One Mac.<br>A workspace to go.",
        "Connect through a protected gateway or tunnel. Phone browsers offer trackpad-style movement, pinch zoom, pan and explicit text entry, without installing another runtime on your phone.",
        "Set up remote access"
      ]
    ],
    "howTag": "SELF-HOSTED, BY YOU",
    "howTitle": "Your runtime.<br>Your way in.",
    "howText": "Codex, files and computer tools run on your Mac. The browser is where you interact and watch. Build a Dot, Grok bot or Hark-style experience around the workflow you already have.",
    "howSteps": [
      [
        "Start on your Mac",
        "Run the local service with your authenticated Codex installation."
      ],
      [
        "Enable the tools you need",
        "Grant system permissions for native app tools or desktop Screen Sharing."
      ],
      [
        "Connect from a browser",
        "Set up protected remote access, then continue from your computer or phone."
      ]
    ],
    "diagramTitle": "One workspace. Two computer paths.",
    "diagramText": "Live viewing is separate from model observations. Native app tools power the agent; Screen Sharing powers your manual desktop control.",
    "docsTag": "THE FIELD GUIDE",
    "docsTitle": "Everything you need.<br>Clearly connected.",
    "docsText": "Setup, screenshots, permissions and the details behind the experience.",
    "faqTitle": "A few things to know.",
    "faqs": [
      [
        "How does this relate to Dot, Grok bot or Hark?",
        "They are references for the experience. Skyrail lets you self-host a similar remote AI workflow using your Mac and Codex. This does not imply official integration or full feature parity."
      ],
      [
        "Does local deployment mean offline inference?",
        "Codex, native Mac tools, project files and the web service run on your computer. Model requests still use your Codex account and configured service. Local deployment does not mean offline inference."
      ],
      [
        "Do streaming and model control use the same path?",
        "Live viewing is separate from model observation. You manually control the full desktop through Screen Sharing; the model uses native tools for the selected app. Viewing does not grant the model full-desktop access."
      ],
      [
        "Can remote and desktop clients write the same session at once?",
        "Skyrail reuses the original session and history, but the session needs an exclusive writer connection. When another client holds it, inspect the owner and explicitly stop it before reconnecting. Skyrail does not automatically fork the session."
      ]
    ],
    "cta": "Your Mac, at home.<br>Your next step, anywhere.",
    "ctaText": "Build your own remote Codex Computer Use workspace.",
    "foot": "Local Codex. Browser-streamed Computer Use.",
    "search": "Search documentation",
    "searchHint": "Search titles and content",
    "close": "Close",
    "theme": "Switch theme",
    "menu": "Open navigation",
    "toc": "On this page",
    "edit": "Edit this page",
    "source": "Markdown source",
    "copy": "Copy",
    "copied": "Copied",
    "prev": "Previous",
    "next": "Next",
    "original": "This technical record is provided in its original language.",
    "image": "Click to expand",
    "back": "Documentation",
    "home": "Home",
    "empty": "No matching pages. Try another term.",
    "searchKey": "Search",
    "allDocs": "All documentation",
    "skip": "Skip to content",
    "demo": "Example data · interface demonstration",
    "real": "Actual product interface · no private content",
    "tuningTag": "ENGINEERED FOR THE DISTANCE",
    "tuningTitle": "Remote work.<br>Considered in detail.",
    "tuningText": "Session continuity, adaptive frames and clear control boundaries connect the parts that make remote use feel continuous.",
    "optimizations": [
      {
        "id": "sessions",
        "label": "Shared sessions",
        "code": "01 / CONTEXT",
        "title": "One context. More ways in.",
        "text": "Continue an existing Codex session instead of starting a separate conversation for remote access.",
        "points": [
          [
            "Original identity and history",
            "Keep the native Codex ID, name, working directory and confirmed conversation history."
          ],
          [
            "Organized by project",
            "Group Git repositories and worktrees together, with the original working directory."
          ],
          [
            "Recover an occupied connection",
            "Keep the draft, inspect the owning process and explicitly reconnect to the same session."
          ]
        ],
        "image": "projects-example.png",
        "doc": "architecture"
      },
      {
        "id": "stream",
        "label": "Adaptive streaming",
        "code": "02 / STREAM",
        "title": "The present frame comes first.",
        "text": "Choose Auto, Quality first or Connection first for the whole-desktop stream. Adapt clarity and pacing when the network slows.",
        "points": [
          [
            "Clarity follows the connection",
            "Reduce quality and request rate during slow delivery, then recover gradually."
          ],
          [
            "Latest frames, less backlog",
            "Serial pulls and a latest-frame strategy keep old frames from building up in a queue."
          ],
          [
            "A separate desktop path",
            "Full-desktop requests lower JPEG quality; the effect depends on the Screen Sharing encoding negotiated."
          ]
        ],
        "image": null,
        "doc": "architecture"
      },
      {
        "id": "permissions",
        "label": "Permissions & handover",
        "code": "03 / CONTROL",
        "title": "Clear ownership. Clear boundaries.",
        "text": "Task permissions, macOS authorization and computer control each have their own controls.",
        "points": [
          [
            "Choose task permissions",
            "Full access is on by default. Turn it off for on-demand command, file, network and app approvals, effective on the next task."
          ],
          [
            "See system authorization",
            "Check Accessibility and Screen Recording status and open macOS privacy settings."
          ],
          [
            "Keep viewing during handover",
            "Retain the stream when Codex takes control, with manual input gated in both browser and service."
          ]
        ],
        "image": "permissions-example.png",
        "doc": "security"
      }
    ],
    "streamVisualTitle": "Clarity follows the connection",
    "streamVisualNote": "Mechanism illustration · not a live speed test",
    "streamVisualLabels": [
      "Limited link",
      "Everyday link",
      "More headroom"
    ],
    "streamVisualModes": [
      "Keep up",
      "Balanced",
      "More detail"
    ],
    "streamVisualFooter": "Latest frames first · adaptive resolution and JPEG quality",
    "connectionLabels": [
      "Your Mac",
      "Protected connection",
      "Remote browser"
    ],
    "connectionNotes": [
      "Codex · sessions · files",
      "Gateway / tunnel",
      "Desktop · phone"
    ],
    "connectionCaption": "Locally deployed. Remotely within reach.",
    "themeLight": "Switch to light theme",
    "themeDark": "Switch to dark theme",
    "remoteTag": "A WINDOW INTO YOUR MAC",
    "remoteTitle": "Open remotely.<br><em>Still your computer.</em>",
    "remoteText": "Continue the original conversation while keeping the app in view. Your computer stays put; chat, viewing and handover travel with you.",
    "remoteCaption": "Remote-use illustration · example interfaces and synthetic data, not a live-device capture",
    "remoteLink": "Explore remote access",
    "remoteAlt": "Illustrated remote browser with a Codex conversation, app view and phone interface using synthetic example data.",
    "remotePills": [
      "Original session",
      "App-view streaming",
      "Human takeover"
    ]
  },
  "zh": {
    "lang": "zh-CN",
    "locale": "zh_CN",
    "name": "简体中文",
    "tag": "本地部署 · 远程使用 · 浏览器串流",
    "title": "电脑留在本地，<br>工作随你，<br><em>到任何地方。</em>",
    "lead": "把自己的 Mac 变成远程 AI 工作台。用本地 Codex 执行任务，在浏览器实时观看 Computer Use，随时接手。原有会话、项目文件与运行时，都留在你自己的电脑上。",
    "start": "搭建自己的工作台",
    "tour": "图解认识 Skyrail",
    "docs": "使用文档",
    "features": "产品演示",
    "github": "查看源码",
    "label": "LOCAL CODEX · LIVE COMPUTER USE",
    "version": "早期版本 · macOS 14+ · 开源",
    "screenLabel": "真实产品界面",
    "screenNote": "中文产品界面",
    "sectionTag": "同一台 MAC，同一条工作流",
    "sectionTitle": "离开电脑，<br>也能接着做。",
    "sectionText": "运行环境、项目文件和 Codex 会话留在 Mac。通过受保护的远程连接，在电脑或手机浏览器里继续对话、看画面、接管操作。",
    "stories": [
      [
        "01 / SESSION CONTINUITY",
        "同一个 session，<br>接着上次继续。",
        "复用 Codex 原始会话 ID、历史与工作目录，按项目整理。远程回来，仍在原来的上下文里；连接被占用时，可检查并重连原会话。",
        "了解会话与工作区"
      ],
      [
        "02 / LIVE COMPUTER USE",
        "AI 操作，<br>你始终看得见。",
        "在浏览器持续观看 Mac 画面。交给 Codex 后保留串流，暂停人工输入；需要介入时再接手。对话与电脑切换，观看不中断。",
        "了解串流与交接"
      ],
      [
        "03 / REMOTE BY DESIGN",
        "一台 Mac，<br>随身的工作台。",
        "通过受保护的网关或隧道远程连接。手机浏览器提供触控板式移动、双指缩放和平移，以及独立文字输入，无需在手机再装一套运行环境。",
        "配置远程访问"
      ]
    ],
    "howTag": "SELF-HOSTED, BY YOU",
    "howTitle": "自己的运行环境，<br>自己的访问方式。",
    "howText": "Mac 本地运行 Codex、文件和电脑工具，浏览器负责交互与观看。自行搭建接近 Dot / Grok bot / Hark 的体验，从已有工作流开始。",
    "howSteps": [
      [
        "在 Mac 启动",
        "本地运行服务，接入已经登录的 Codex。"
      ],
      [
        "按需开启电脑能力",
        "授予所需系统权限，选择应用工具或桌面屏幕共享。"
      ],
      [
        "从浏览器远程连接",
        "配置受保护的访问入口，在电脑或手机继续工作。"
      ]
    ],
    "diagramTitle": "一个工作台，两条电脑通道。",
    "diagramText": "实时观看与模型观察分开：原生应用工具服务于模型，屏幕共享服务于人工桌面操作。",
    "docsTag": "随手可查的使用手册",
    "docsTitle": "需要了解的，<br>清晰地连接起来。",
    "docsText": "从安装到截图，从权限到实现细节，找到对应的下一步。",
    "faqTitle": "开始之前，你可能想知道。",
    "faqs": [
      [
        "和 Dot / Grok bot / Hark 是什么关系？",
        "它们是体验方向的参照。Skyrail 让你用自己的 Mac 与 Codex 自行搭建类似的远程 AI 工作流，不代表官方集成或功能完全一致。"
      ],
      [
        "“本地部署”是否代表离线运行？",
        "Codex、Mac 原生工具、项目文件和网页服务在自己的电脑上。模型请求仍使用你的 Codex 账户与配置的服务，本地部署不等于离线推理。"
      ],
      [
        "远程串流和模型控制是同一条通道吗？",
        "实时观看与模型观察分开。人工通过屏幕共享控制整个桌面；模型通过原生工具操作所选应用。观看画面并不会自动授予模型整桌面权限。"
      ],
      [
        "远程和桌面端能同时写同一个会话吗？",
        "Skyrail 复用原始会话与历史，但同一会话需要独占写连接。发现其他客户端占用时，可先检查连接，再确认结束占用并重连；不会自动复制会话。"
      ]
    ],
    "cta": "Mac 在本地，<br>下一步在你手里。",
    "ctaText": "搭建自己的远程 Codex Computer Use 工作台。",
    "foot": "本地 Codex，浏览器里的 Computer Use。",
    "search": "搜索文档",
    "searchHint": "搜索标题和正文内容",
    "close": "关闭",
    "theme": "切换主题",
    "menu": "打开导航",
    "toc": "本页内容",
    "edit": "编辑本页",
    "source": "Markdown 原文",
    "copy": "复制",
    "copied": "已复制",
    "prev": "上一篇",
    "next": "下一篇",
    "original": "此技术记录以原始语言呈现。",
    "image": "点击放大",
    "back": "文档中心",
    "home": "首页",
    "empty": "没有匹配的文档，试试其他关键词。",
    "searchKey": "搜索",
    "allDocs": "浏览全部文档",
    "skip": "跳到正文",
    "demo": "示例数据 · 界面演示",
    "real": "真实产品界面 · 无私人内容",
    "tuningTag": "ENGINEERED FOR THE DISTANCE",
    "tuningTitle": "远程体验，<br>细节也要跟得上。",
    "tuningText": "从原会话连续性，到弱网画面和控制权边界，把远程使用的关键环节接起来。",
    "optimizations": [
      {
        "id": "sessions",
        "label": "会话复用",
        "code": "01 / CONTEXT",
        "title": "一个上下文，跨入口继续。",
        "text": "复用已有 Codex 会话，而不是为远程入口另起一段对话。",
        "points": [
          [
            "原始身份与历史",
            "保留原生 Codex ID、会话名称、cwd 和已确认的对话历史。"
          ],
          [
            "按项目归组",
            "Git 仓库与 worktree 归到对应项目，回到熟悉的工作目录。"
          ],
          [
            "占用可恢复",
            "保留草稿，检查占用进程，确认后重连同一个原会话。"
          ]
        ],
        "image": "projects-example.png",
        "doc": "architecture"
      },
      {
        "id": "stream",
        "label": "自适应串流",
        "code": "02 / STREAM",
        "title": "让当前画面，优先到达。",
        "text": "为整机串流选择自动、高清优先或连接优先；弱网下优先保持响应。",
        "points": [
          [
            "清晰度随网络调整",
            "整机与应用通道分别适配；自动模式降级后逐步恢复，手动画质模式保持选择。"
          ],
          [
            "优先传送最新帧",
            "串行拉取与最新帧策略，避免旧画面不断排队。"
          ],
          [
            "桌面路径独立调节",
            "整桌面请求降低 JPEG 质量；实际效果由屏幕共享编码协商决定。"
          ]
        ],
        "image": null,
        "doc": "architecture"
      },
      {
        "id": "permissions",
        "label": "权限与交接",
        "code": "03 / CONTROL",
        "title": "谁能操作，始终明确。",
        "text": "任务权限、macOS 系统授权和电脑控制权分别管理。",
        "points": [
          [
            "任务权限可切换",
            "默认允许全部操作，也可关闭并对命令、文件、网络和应用操作按需确认；下次任务生效。"
          ],
          [
            "系统权限看得见",
            "显示辅助功能与屏幕录制授权状态，跳转系统隐私设置。"
          ],
          [
            "交接保留画面",
            "切换为 Codex 控制时保留串流，同时在浏览器与服务端限制人工输入。"
          ]
        ],
        "image": "permissions-example.png",
        "doc": "security"
      }
    ],
    "streamVisualTitle": "清晰度跟随连接",
    "streamVisualNote": "机制示意 · 非实时网络测速",
    "streamVisualLabels": [
      "网络受限",
      "日常连接",
      "连接充裕"
    ],
    "streamVisualModes": [
      "优先跟随",
      "平衡画质",
      "提高细节"
    ],
    "streamVisualFooter": "新画面优先 · 动态调整分辨率与 JPEG 质量",
    "connectionLabels": [
      "你的 Mac",
      "受保护的连接",
      "远程浏览器"
    ],
    "connectionNotes": [
      "Codex · 会话 · 文件",
      "网关 / 隧道",
      "电脑 · 手机"
    ],
    "connectionCaption": "部署在本地，体验延伸到远程。",
    "themeLight": "切换到浅色主题",
    "themeDark": "切换到深色主题",
    "remoteTag": "A WINDOW INTO YOUR MAC",
    "remoteTitle": "远程打开，<br><em>仍是自己的电脑。</em>",
    "remoteText": "在浏览器里接着原会话沟通，同时看见应用画面。电脑留在原地，对话、观看与接手，随你一起移动。",
    "remoteCaption": "远程使用场景示意 · 示例界面与虚构数据，非实机直播",
    "remoteLink": "看看如何远程连接",
    "remoteAlt": "远程浏览器中的 Codex 对话、应用画面与手机视图，使用示例数据绘制的场景插画。",
    "remotePills": [
      "原会话继续",
      "应用画面串流",
      "随时人工接手"
    ]
  }
};
