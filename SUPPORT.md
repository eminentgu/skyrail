**[Skyrail](README.md) / [Documentation](docs/README.md)**

# Support and troubleshooting

[简体中文](SUPPORT.zh-CN.md) · [Setup and permissions](docs/GETTING-STARTED.md)

Run `npm run doctor` first. Missing GUI permissions still allow UI, build, JavaScript and chat-only testing. Report installation issues through [GitHub Issues](https://github.com/eminentgu/skyrail/issues), in English or Chinese. Include the commit/version, macOS, browser/device, target app, reproduction and expected/actual result. Security reports follow [SECURITY.md](SECURITY.md).

## Install or launch fails

Use Node.js 22.12+ and finish `npm ci` before running tests or starting the service. For managed-network certificate errors, see the system-CA instructions in the [setup guide](docs/GETTING-STARTED.md). Keep TLS verification enabled.

Open `http://127.0.0.1:4317`, not a different hostname. `EADDRINUSE` means another server holds the port: stop your earlier foreground process or identify the existing service first. Do not stop unrelated Node processes. For a separate local test use `PORT=14317 npm run dev` and open that address. For missing Codex, set `CODEX_BIN` to the installed executable. For built-asset mode, run `npm run build` before `SKYRAIL_SERVE_DIST=1 npm start`.

## Permissions appear enabled but input fails

Check Screen Recording and Accessibility separately. The intended native identity is this checkout's `.data/Skyrail Mac.app`, not the browser. The managed service launches through that native wrapper. Direct development launches may have different permission attribution.

An ad-hoc rebuild can invalidate an older permission grant while its Settings entry still appears enabled. Re-add the current app yourself in Privacy & Security and restart. Do not modify privacy databases. If device management prohibits the grant, ask the administrator; use chat-only testing meanwhile. Folder access and Full Disk Access do not substitute for GUI permissions.

## Screen capture is empty or reports -3811

Check whether the Mac is locked and whether a display is available. Locked sessions pause app input/capture even if permissions still show as granted. A running capture process or heartbeat does not prove frames exist. Skyrail can recover with independent read-only window snapshots; the UI reports actual received frames. Unknown write outcomes are not automatically retried.

Active app capture may wake the physical display. Whole-machine sleep, shutdown, lid constraints and OS lock policy are not bypassed. `SKYRAIL_DISPLAY_MODE=headless` suppresses active display wake but creates no virtual monitor and does not establish closed-lid or screen-off compatibility. Validate that setup separately.

## Cannot connect to the whole desktop

Enable macOS **General → Sharing → Screen Sharing**, restricted to your own account. The gateway login uses the Skyrail password; desktop authentication uses your Mac account. Complete it yourself and choose the existing desktop when offered. A managed Mac may prohibit Screen Sharing. An answering port is not proof of valid authentication or lock-screen input.

Manual control uses the whole-desktop channel because older app-window clicks could report success without changing the app. Check the real visible result. See [manual unlock acceptance](docs/REMOTE-UNLOCK.md).

## Switching to chat locks or disconnects the Mac

Switching tabs or sending a task should retain the desktop stream. Sending parks manual input; **Take over** restores it without reauthentication. Choose **Disconnect** to end the connection explicitly. Another client can occupy the manual control lease.

macOS may restore the original lock state after a real Screen Sharing disconnect. The optional `scripts/keep-remote-session.sh` changes the system `RestoreMachineState` preference and requires administrator authorization; review it before using it. It is not needed for normal evaluation and can conflict with organizational policy. Restore the preference to `true` with administrator authorization to reverse it. [Vendor explanation](https://help.edovia.com/en/screens-5/troubleshooting/log-in-twice-mac/).

## Phone input or new dialogs do not respond

Use **Take over** first. Default gestures: slide to move the pointer, tap to click, double-tap to double-click, double-tap and hold to drag, and two fingers to zoom/pan. Direct targeting is optional. **Input text** opens the keyboard, including Tab, Return, Backspace and Esc; tapping the display does not automatically open it.

Use the whole desktop for new apps and system dialogs. A selected-app view is limited to its chosen window; select a new independent window from the list. Report real device/OS/browser and IME behavior. Simulated touches do not prove real-phone compatibility.

## Remote login fails

Read `.data/remote-access.txt` on the host; do not share its contents. The project provides no public demo. Expose gateway 4318 via your own HTTPS tunnel, never service 4317. Refresh the root URL before logging in. `401` means invalid/missing authentication, `429` means rate limiting, and `502` usually means the local service is unavailable. Restarting the gateway invalidates sessions. For `Invalid origin`, report browser and embedding/proxy setup without cookies. See [operation guide](docs/REMOTE-ACCESS.md).

## A synchronized Codex session cannot continue

The same native session permits one writer. Finish and release it in the other client first. Alternatively, choose **检查占用连接** (inspect the occupying connection), review the affected session count, and explicitly confirm **确认结束占用并连接原会话** (end the owner and reconnect). This ends the actual owning Codex background process, including other tasks sharing it. Records and drafts remain; Skyrail does not delete lock files, create replacement sessions or automatically resend the draft. If ownership changes, inspect again. Skyrail closes its writer after each completed turn, retaining a read-only history connection. Copy the ID and use `codex resume <SESSION_ID>` in another client after release. Imported sessions retain their original tool configuration; history sync does not copy host-specific tools.

## Commands or files are denied

Check **Allow all operations** in composer settings. Change it only when tasks are idle; the next task resumes the same session with the selected policy. `EPERM` / `Operation not permitted` can mean macOS folder restrictions, even in full access. The managed service accesses files as `.data/Skyrail Mac.app`, whose grants are separate from Codex or Terminal. Grant only the required directory permission, or Full Disk Access when needed for your chosen files, then restart the service. Full Disk Access is optional and cannot replace administrator rights or system GUI permissions.

## Uploads and downloads

Use the folder button to upload files or attach workspace files. The per-file upload limit is 50 MiB; interrupted uploads are cleaned up and same-name uploads are isolated. Refresh project outputs before downloading, or use the generated file links in replies. Test with synthetic files first. Browser automation's file-URL setting is not required for a user's normal file picker.

Logs live in `.data/`; remove credentials, cookies, private paths and conversation content before sharing. Do not attach `.data/`, `workspaces/`, personal desktop captures or full raw diagnostics to a public issue.

## Local files stop responding

Distinguish approval denial, macOS EPERM and storage timeouts. Full access does not grant macOS privacy permission or fix a stalled cloud-file provider. A Spotlight miss does not prove a file is absent.

The built-in skill can run bounded file checks under the current command permissions:

```sh
node scripts/local-files.mjs find 'filename keyword' "$HOME/Desktop"
node scripts/local-files.mjs probe '/absolute/path/to/document.docx'
```

Each check has an eight-second deadline. Discovery scans one directory level, at most 2,000 entries and 30 candidates; numeric fallback matches are labeled as candidates. A timeout returns `complete:false`; stop rather than launch repeated scans. `probe` reads only the file header, not Word body text or comments. Text extraction needs its own deadline. Check cloud download state and privacy grants, or upload a copy if needed.

---

[Documentation hub](docs/README.md)
