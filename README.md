<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/skyrail-banner-dark.svg">
    <img src="docs/assets/skyrail-banner.svg" alt="Skyrail · 天轨 — Codex + your Mac" width="100%">
  </picture>
</p>

<h1 align="center">Your Codex and Mac, side by side.</h1>

<p align="center">Continue a conversation. Share a file. See your Mac. Take over.</p>

<p align="center"><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>

<p align="center">
  <a href="https://github.com/eminentgu/skyrail/actions/workflows/ci.yml"><img src="https://github.com/eminentgu/skyrail/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-526c7c" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/macOS-14%2B-526c7c" alt="macOS 14 or newer for native features">
  <img src="https://img.shields.io/badge/Node.js-22.12%2B-526c7c" alt="Node.js 22.12 or newer">
</p>

<p align="center"><a href="#try-it-locally">Quick start</a> · <a href="docs/README.md">Documentation</a> · <a href="docs/GETTING-STARTED.md">Permissions & testing</a> · <a href="https://github.com/eminentgu/skyrail/issues/new/choose">Report an issue</a></p>

---

Skyrail is a local-first web interface for Codex and your Mac. Continue existing sessions from a desktop or phone browser, with conversations, files and computer control in one place.

> [!NOTE]
> **Early access · self-hosted · single user.** No hosted service or notarized installer. Real phones, cross-app input and lock-screen login still have acceptance gaps. [See validation records](docs/VALIDATION.md).

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/skyrail-desktop-dark.png">
    <img src="docs/assets/skyrail-desktop.png" alt="Skyrail local web interface with conversation/computer navigation and a message composer" width="100%">
  </picture>
</p>

<p align="center"><sub>Actual local interface · The current product UI is in Chinese; documentation is available in English and Chinese.</sub></p>

## From conversation to action

<table>
  <tr>
    <td width="50%" valign="top"><strong>Pick up where you left off</strong><br><br>Open Codex sessions by project, keeping their original IDs, working directories and history.</td>
    <td width="50%" valign="top"><strong>A workspace that travels</strong><br><br>Phone trackpad gestures, pinch-to-zoom, text entry, and a simple chat/computer switch.</td>
  </tr>
  <tr>
    <td width="50%" valign="top"><strong>See the work. Step in.</strong><br><br>Watch a selected app; use macOS Screen Sharing to control the whole desktop yourself.</td>
    <td width="50%" valign="top"><strong>Files that follow the task</strong><br><br>Attach uploads or project files and download the results. Upload limit: 50 MiB per file.</td>
  </tr>
  <tr>
    <td width="50%" valign="top"><strong>Your existing Codex</strong><br><br>Use the runtime and account you already have, without a separate agent execution stack.</td>
    <td width="50%" valign="top"><strong>Connect to your own Mac</strong><br><br>A password gateway and your HTTPS tunnel keep the workspace on your machine.</td>
  </tr>
</table>

Skyrail does not include a model subscription or bundle the desktop app’s private computer-use engine.

## Try it locally

Start with the browser interface. **Accessibility, Screen Recording, Screen Sharing, and administrator access are not required to install dependencies, run tests, build the UI, or open it.** Real tasks need an authenticated Codex CLI; desktop features need additional permissions.

Requirements: Node.js 22.12+; macOS 14+ and Xcode Command Line Tools for native features. CI uses Node.js 22. The currently validated Codex CLI is `0.165.0-alpha.1.2`; other versions need compatibility checks.

```sh
git clone https://github.com/eminentgu/skyrail.git
cd skyrail
npm ci
npm run doctor
npm run dev
```

Open **[http://127.0.0.1:4317](http://127.0.0.1:4317)**. Stop the foreground server with Ctrl+C. If Codex is not on PATH, use `CODEX_BIN=/absolute/path/to/codex npm run dev`.

> [!IMPORTANT]
> Before sending your first task, open the composer settings and turn off **Allow all operations** if you want workspace-scoped execution with approvals. Full access is currently the default; it does not grant macOS permissions.

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

<details>
<summary><strong>How session sync and control handover work</strong></summary>


Confirmed history comes from Codex's durable session records. Skyrail stores UI state, pending sends, and recoverable hidden conversations locally. Use clients alternately: **one session cannot have two concurrent writers**. If another client holds its write lock, release it there first. Synchronizing history does not transfer another client's private tools or system permissions.

Manual full-desktop control uses macOS Screen Sharing/noVNC; agent app control uses Skyrail's own Swift adapter. Sending a task parks manual keyboard/mouse input while retaining the desktop stream. Use **Take over** to resume manual input. This coordinates Skyrail clients, not every program or physical input device on the Mac.


</details>

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

## Explore the docs

**[Open the documentation hub →](docs/README.md)**

| Get started | Go deeper |
| --- | --- |
| [Setup, permissions & staged testing](docs/GETTING-STARTED.md) | [Architecture & control ownership](docs/ARCHITECTURE.md) |
| [Remote access, updates & removal](docs/REMOTE-ACCESS.md) | [Validation records](docs/VALIDATION.md) |
| [Troubleshooting](SUPPORT.md) | [Contributing](CONTRIBUTING.md) · [Maintaining](docs/MAINTAINERS.md) |
| [Security boundaries](SECURITY.md) | [Changelog](CHANGELOG.md) · [Third-party notices](THIRD-PARTY-NOTICES.md) |

### Develop with Skyrail

```sh
npm test
npm run build
npm run setup:mac  # macOS only, after native changes
```

Model smoke scripts are opt-in, use your Codex account, and can incur usage. They do not replace real desktop testing; read the setup guide before running them.

MIT licensed. Dependencies and external services have their own terms. Chinese and English feedback is welcome; support is best effort, without a response-time commitment.
