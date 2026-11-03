# Security policy

[简体中文](SECURITY.zh-CN.md) · [Setup and permissions](docs/GETTING-STARTED.md)

Skyrail is an early 0.x project. Fixes target current main; there is no audited stable release or commercial support commitment.

Do not disclose exploitable details, remote passwords, cookies, tokens, conversations or desktop content in public issues. Prefer **Report a vulnerability** on the repository Security page if enabled. If unavailable, open an issue without exploit details asking the maintainer for a private contact route.

## Trust boundaries

- Skyrail operates a real Mac. OS permission grants are a separate step completed by the user. Missing GUI grants do not prevent UI/build/chat-only evaluation.
- Manual full-desktop control is separate from the model's selected-window tools. Its destination is fixed to local macOS Screen Sharing, not a user-selected remote host or port. The entire desktop is in scope.
- Manual desktop images, authentication and keyboard input do not enter chat, model tool results or session records. This channel provides no screenshot export, clipboard synchronization or input replay. Browser credential references are released on disconnect; verifiable erasure of JavaScript memory is not promised.
- When handing control to Codex, the RFB connection stays open while the server blocks manual key, pointer, clipboard and display-changing messages at protocol boundaries. Viewing requests continue. Partial messages cannot cross the handover boundary; held input is released. Resuming manual input first revokes the model window binding and drains the transition.
- The RFB filter parses handshake and client message boundaries, not screen images or reconstructed input text. It supports the current Mac's ARD, standard VNC and unauthenticated test handshakes. Unknown authentication/extensions or oversized messages close the channel.
- Remote WebSocket upgrades validate the access cookie, strict Origin/Host and fixed path. Local checks additionally validate the session cookie and a random control ticket, carried in the subprotocol rather than URLs/logs. Manual control is exclusive; the client renews every 12 seconds and the channel closes after 90 seconds without renewal or a 24-hour absolute limit. macOS validates system credentials.
- HTTPS terminates at the configured proxy (for example Cloudflare when used). That proxy and the local forwarding process are trusted parts of remote control; this is not an independent end-to-end encrypted channel. Configure macOS Screen Sharing's LAN exposure separately. Skyrail does not publicly forward TCP 5900.
- **Allow all operations** is a persistent setting for this Skyrail instance and is currently on by default. Session start/resume uses `approvalPolicy=never` and `sandbox=danger-full-access`; turns use `dangerFullAccess`. The runtime can use files, commands and networking available to its host account. This is not a read-only or isolated environment. It affects Skyrail child processes, not global Codex configuration. Turning it off selects workspace-write/on-request and restores app-operation approval.
- With global full access off, an explicit allow-all-for-this-connection grant is limited to the current window connection and ends when changing apps or disconnecting.
- Codex shell/MCP configuration is not OS-level isolation. Developer instructions are not a sandbox. Control leases govern Skyrail's own routes, not other clients or physical input.
- Default listeners are loopback-only. Public access needs HTTPS, the authenticated gateway and a controlled tunnel. Never expose service port 4317 directly.
- The gateway uses a single-owner shared password, not multi-user identities or role management. Cookies expire after 24 hours and on gateway restart.
- Keep `.data/`, workspaces and credentials out of Git. A public repository does not mean a running instance is public.

Third-party dependencies, Codex and any tunnel/proxy provider have their own licenses and service terms. The project's MIT license grants no right to those services.

## Touch input adapter

The gesture layer maps image-relative coordinates into the selected native window or existing local RFB channel. It does not broaden app permissions, select another host or persist cursor/key/credential payloads. noVNC 1.7.0 private pointer encoding is isolated in `desktop-rfb.mjs`; upgrades need synthetic RFB browser acceptance. Hidden views disable input and hide remote cursors. Cancellation invalidates queued native input before releasing held buttons; the server lease remains authoritative.

## File transfers

Transfer endpoints require the authenticated session. Uploads also require the CSRF session token and strict Host/Origin checks. Uploads stream into unique per-thread private directories under `.data/files`, with a 50 MiB limit, temporary files and atomic completion; failed streams remove their partial files. Names are rendered as text, downloads use attachment disposition plus nosniff, and transfer endpoints never execute files.

Project downloads are confined to the conversation's actual working directory; uploads to its upload root. Absolute/parent traversal paths, out-of-root symlinks, non-regular files and cross-thread attachments are rejected. Target checks and final O_NOFOLLOW reduce accidental escapes, but are not a sandbox against a concurrently malicious local full-access process. Full-access agents already have host privileges. A remote login can read project files: this is a single-owner deployment, not multi-user isolation.

Codex receives attachments as local paths retained in conversation metadata. Uploaded contents are task data, not authorization for additional actions. Do not publish uploads, workspaces or session records.
