# Setup and local testing

[简体中文](GETTING-STARTED.zh-CN.md) · [Home](../README.md)

You can evaluate Skyrail in stages. Start without GUI permissions; add them only when you want to test computer control. A managed work Mac may prohibit Screen Sharing or privacy grants. That limits those features, not the entire project.

## 1. Check and install

Use Node.js 22.12+ (22 in CI). Native features require macOS 14+ and Xcode Command Line Tools. Install those from Apple's supported channels if missing. Real chat requires your own authenticated Codex CLI; the validated version is `0.165.0-alpha.1.2`.

```sh
node --version
codex --version
npm ci
npm run doctor
```

`doctor` is read-only: it checks versions, dependency/build availability, the helper's permission preflight, and whether the local Screen Sharing port answers. It never requests permission, reads credentials or chat history, captures a screenshot, logs into the Mac, or calls a model. A listening port is not proof of successful desktop login. Missing optional features are reported separately from prerequisites for testing the UI. For machine-readable output use `node scripts/doctor.mjs --json`.

If `npm ci` fails with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` on a managed Mac, use a Node version supporting system CAs and retry with `NODE_USE_SYSTEM_CA=1 npm ci`. This uses the system trust store without disabling TLS verification. If unavailable, ask your administrator for the approved CA configuration or use the supported Node release your organization supplies. Do not set `strict-ssl=false` or `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## 2. Test without desktop permissions

```sh
npm test
npm run build
npm run dev
```

Open **http://127.0.0.1:4317**. The UI and conversation/computer navigation should load even when the native helper is not built or permissions are denied. Decline permission prompts during this stage. Missing Mac components should be reported in the computer panel rather than treated as successful control.

Verify the page, navigation, settings and visible errors. JavaScript tests use temporary data and simulated boundaries; they do not need Codex login or real GUI control. Linux can run tests and the frontend build, but cannot validate native Mac features.

For built-asset testing instead of Vite, stop the development server, then run:

```sh
SKYRAIL_SERVE_DIST=1 npm start
```

This serves a build snapshot; it is still a local Node service, not a standalone installer. Stop with Ctrl+C. A custom `PORT` is supported; open that exact `127.0.0.1` address.

## 3. Test chat independently

Use a fresh test conversation instead of modifying an existing work session. Before sending, turn off **Allow all operations** in composer settings if you want workspace-scoped execution and approvals. Full access is currently enabled by default.

Send a harmless request such as `Reply with SKYRAIL_CHAT_OK. Do not use tools.` Verify the answer and refreshed history. This uses your Codex account and can incur usage. No Screen Recording, Accessibility or Screen Sharing grant is needed for text-only work. File access remains subject to macOS directory permissions.

To test attachments, use a small synthetic text file, attach it, ask for a copy in the test workspace, then download and compare the bytes. Do not upload private documents for an initial test. To check session continuity, finish a turn, copy its session ID, release the writer, and open it from another Codex client. Never write the same session from both clients at once.

## 4. Build native features

```sh
npm run setup:mac
npm run doctor
```

This compiles the Swift helpers and ad-hoc signs `.data/Skyrail Mac.app`; it does not grant system permissions. Rebuilding can invalidate an earlier grant. Do not rebuild an already-authorized deployment just to test JavaScript changes. To update only the read-only lock detector, use `npm run setup:session`.

For agent app control, grant **Accessibility** and **Screen Recording** to the helper in **System Settings → Privacy & Security**. The identity is the project `.data/Skyrail Mac.app`, not the browser. Start with a harmless app and verify its visible result, not only an API success response. The managed wrapper provides the intended app identity for background operation; direct development launches may require additional diagnosis of macOS attribution. Restart after grants if needed.

Folder access is separate. Grant Desktop/Documents access only for the folders you actually use. Full Disk Access is not required for basic evaluation and does not replace Accessibility or Screen Recording. On a managed device, have the administrator resolve policy restrictions; do not modify TCC databases.

## 5. Test manual desktop control separately

Enable **System Settings → General → Sharing → Screen Sharing**, restricted to your own account. Some managed Macs disallow it. In Skyrail choose the whole desktop, connect, and authenticate yourself with the Mac account. The Skyrail gateway password and the Mac login password are different.

Select the existing desktop when offered. Check a harmless click and text entry. Then send a task: the stream should stay connected while manual input pauses. **Take over** should restore manual input. The model's app tools do not inherit the manual VNC channel. Do not enter credentials into chat.

Test lock/unlock only after normal desktop login works, with local recovery available. Lock-screen authentication must be completed by you; it is not an automated model test. See [remote unlock acceptance](REMOTE-UNLOCK.md).

## 6. Record what actually passed

Keep separate results for JS/build, native compilation, real chat, real app input, desktop login, handover, and phone hardware. For a phone test, record device/OS/browser, portrait and landscape, pinch, drag, text entry/IME, reconnect, and new system dialogs. Desktop touch emulation alone is insufficient.

Optional smoke scripts:

- `node scripts/smoke-protocol.mjs`: real model and dynamic-tool transport; the tool result is synthetic, not a real app observation.
- `node scripts/smoke-routing.mjs`: real model and native app route; inspect its task/actions before running and grant the required permissions.
- `node scripts/smoke-session-sync.mjs`: requires a running local service and real Codex; creates a dedicated test session, uses three model turns, and cleans up its own test records after success (`--keep` retains them).

These scripts use model quota and may create native session records. Do not run them as a substitute for GUI acceptance. See [historical validation](VALIDATION.md) and [local validation for this checkout](LOCAL-VALIDATION-2026-11-03.md).
