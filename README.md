# Skyrail · 天轨

[![CI](https://github.com/eminentgu/skyrail/actions/workflows/ci.yml/badge.svg)](https://github.com/eminentgu/skyrail/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Continue your Codex conversations. See your Mac. Take over when you need to.**

English · [简体中文](README.zh-CN.md)

Skyrail is a local-first web interface for Codex and your Mac. Use a desktop or phone browser to continue existing Codex sessions, exchange files, watch an application, and switch between agent work and manual desktop control.

**Early access · macOS 14+ · self-hosted · single user.** There is a working implementation, but phone hardware, cross-application input, and real lock-screen login still have acceptance gaps. See [validation records](docs/VALIDATION.md). There is no hosted service or ready-to-install notarized app.

## What you can do

- **Continue your work:** open local Codex sessions grouped by project, retaining session IDs and working directories, and synchronize history.
- **Exchange files:** attach uploads or project files to a message and download generated results. Upload limit: 50 MiB per file.
- **Watch and intervene:** view a selected Mac application; use macOS Screen Sharing for manual control of the whole desktop.
- **Use your phone:** trackpad gestures, pinch-to-zoom, a text-entry keyboard, and a two-tab conversation/computer interface.
- **Connect remotely:** run a password-protected gateway behind your own HTTPS tunnel.

Skyrail uses your installed Codex runtime. It does not include a model subscription or bundle the desktop app's private computer-use engine.

## Try it locally

Start with the browser interface. **Accessibility, Screen Recording, Screen Sharing, and administrator access are not required to install dependencies, run tests, build the UI, or open it.** Real tasks need an authenticated Codex CLI; desktop features need additional permissions.

Requirements: Node.js 22.12+; macOS 14+ and Xcode Command Line Tools for native features. CI uses Node.js 22. The currently validated Codex CLI is `0.165.0-alpha.1.2`; other versions need compatibility checks.

```sh
git clone https://github.com/eminentgu/skyrail.git
cd skyrail
npm ci
npm run doctor
npm test
npm run build
npm run dev
```

Open **http://127.0.0.1:4317**. Stop the foreground server with Ctrl+C. If Codex is not on PATH, use `CODEX_BIN=/absolute/path/to/codex npm run dev`.

Before sending your first task, open the composer settings and turn off **Allow all operations** if you want workspace-scoped execution with approvals. Full access is currently the default; it does not grant macOS permissions.

For native app control, build the helper with `npm run setup:mac`, then grant the permissions required for that feature. Enable macOS Screen Sharing separately for manual desktop control. **[Follow the setup and permission guide →](docs/GETTING-STARTED.md)**

## Enable only what you need

| Feature | Additional requirement |
| --- | --- |
| UI, JavaScript tests, frontend build | No macOS privacy permission or model login |
| Real Codex conversations | Installed, authenticated Codex CLI |
| Agent app observation/input | Native helper, Screen Recording and Accessibility |
| Manual full-desktop control | macOS Screen Sharing and your own Mac account login |
| Protected Desktop/Documents folders | Folder access when needed; Full Disk Access is not a general prerequisite |
| Phone access from another device | Password gateway plus your own HTTPS tunnel |

Missing GUI permissions do not prevent chat-only testing. They do prevent validating real screenshots, input, and handover. `npm run doctor` checks prerequisites without requesting permissions, capturing screenshots, or making model calls.

## Sessions and control

Confirmed history comes from Codex's durable session records. Skyrail stores UI state, pending sends, and recoverable hidden conversations locally. Use clients alternately: **one session cannot have two concurrent writers**. If another client holds its write lock, release it there first. Synchronizing history does not transfer another client's private tools or system permissions.

Manual full-desktop control uses macOS Screen Sharing/noVNC; agent app control uses Skyrail's own Swift adapter. Sending a task parks manual keyboard/mouse input while retaining the desktop stream. Use **Take over** to resume manual input. This coordinates Skyrail clients, not every program or physical input device on the Mac.

## Remote access and updates

Keep the local service on loopback. Expose **gateway port 4318**, never the unauthenticated service on 4317. The gateway is single-user, not a multi-user authorization system.

**[Remote access, background service, updates, and removal →](docs/REMOTE-ACCESS.md)**

The managed service serves a fixed frontend build; development uses Vite. Build before installing or restarting the managed service. Native code is ad-hoc signed; rebuilding may invalidate macOS permission grants.

## Current boundaries

- Native functionality requires macOS; Linux CI covers JavaScript tests and frontend builds.
- No stable signing/notarization, automatic installer, or bundled HTTPS tunnel.
- Phone touch simulation does not establish real iOS/Android keyboard compatibility.
- Locking the Mac pauses app capture/input. Manual lock-screen login needs your own authentication and real-device acceptance.
- Active viewing/tasks can keep the system awake; app capture may light the physical display. Headless mode needs a separately validated display setup.
- Codex shell/MCP access is not an OS sandbox. Read [security boundaries](SECURITY.md) before enabling remote or full access.

## Documentation and development

- [Setup and local testing](docs/GETTING-STARTED.md) · [中文](docs/GETTING-STARTED.zh-CN.md)
- [Remote access and operation](docs/REMOTE-ACCESS.md) · [中文](docs/REMOTE-ACCESS.zh-CN.md)
- [Troubleshooting](SUPPORT.md) · [中文](SUPPORT.zh-CN.md)
- [Contributing](CONTRIBUTING.md) · [中文](CONTRIBUTING.zh-CN.md)
- [Architecture](docs/ARCHITECTURE.md) · [Validation](docs/VALIDATION.md) · [Changelog](CHANGELOG.md)
- [Report an issue](https://github.com/eminentgu/skyrail/issues/new/choose) · [Security policy](SECURITY.md) · [中文](SECURITY.zh-CN.md) · [Third-party notices](THIRD-PARTY-NOTICES.md)

```sh
npm test
npm run build
npm run setup:mac  # macOS only, after native changes
```

Model smoke scripts are opt-in, use your Codex account, and can incur usage. They do not replace real desktop testing; read the setup guide before running them.

MIT licensed. Dependencies and external services have their own terms. Chinese and English feedback is welcome; support is best effort, without a response-time commitment.
