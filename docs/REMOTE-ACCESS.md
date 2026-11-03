**[Skyrail](../README.md) / [Documentation](README.md)**

# Remote access and operation

[简体中文](REMOTE-ACCESS.zh-CN.md)

First complete [local setup](GETTING-STARTED.md). Remote access does not grant missing macOS permissions or make a sleeping Mac available.

## Start the gateway

The local service listens on `127.0.0.1:4317`. In a separate terminal start the password gateway:

```sh
SKYRAIL_REMOTE_HOST=your.domain.example node apps/remote-gateway/server.mjs
```

Use your own HTTPS hostname and tunnel; map it to **127.0.0.1:4318**, never 4317. Tunnel configuration is external to Skyrail. First start generates `.data/remote-access.txt` with restrictive permissions; read it locally, never publish it. The gateway password differs from your Mac account password. Login cookies expire after 24 hours and after a gateway restart. This is a single-user entry point, not tenant or role management.

Test login, chat, file transfer and reconnection from another trusted device before relying on it away from the Mac. Desktop login and real phone keyboard behavior need separate acceptance. Do not expose a development server directly to the internet.

## Optional login background service

On macOS, after building the native helper and configuring the required permissions:

```sh
npm run build
SKYRAIL_REMOTE_HOST=your.domain.example CODEX_BIN=/absolute/path/to/codex npm run service:install
```

Stop your foreground development process first. The installer creates or replaces the two per-user LaunchAgents `local.skyrail.service` and `local.skyrail.gateway`, then restarts them. It runs after your macOS login, not before login or while the machine is off. The service launches through `.data/Skyrail Mac.app` for native permission identity, using a fixed frontend build snapshot. It records the current Node executable; reinstall the service after changing that path. It does not create or change any tunnel.

Logs: `.data/local.skyrail.{service,gateway}.{out,err}.log`. These may contain private information; redact before sharing.

## Update

Keep `.data/` and `workspaces/` private. Back up local state securely before an upgrade. Stop the two jobs using the commands below. In a clean checkout on main, use `git pull --ff-only`, then `npm ci` and `npm run build`. Build native components only when their code changed; their ad-hoc identity may require reauthorization. Run tests and `npm run doctor`, then rerun the installer with your hostname and Codex path. Refresh the browser to load the new build. Do not overwrite a checkout with uncommitted work.

## Stop or remove background startup

```sh
launchctl bootout gui/$(id -u)/local.skyrail.service
launchctl bootout gui/$(id -u)/local.skyrail.gateway
```

A missing job may report that it is not loaded. To prevent startup on next login, remove only these installed plist files:

- `~/Library/LaunchAgents/local.skyrail.service.plist`
- `~/Library/LaunchAgents/local.skyrail.gateway.plist`

Remove your own tunnel route separately if you configured one. Stopping/removing the jobs does not erase conversations, uploads, native Codex history or macOS privacy grants. Keep or remove those separately according to your needs.

## Sleep, lock and control ownership

Active tasks/viewers can keep the system running; capturing apps may light the physical display. `SKYRAIL_DISPLAY_MODE=headless` disables active display wake, requires your own validated display setup, and creates no virtual display. Forced sleep, shutdown and lid restrictions are not bypassed.

Locked sessions pause app capture/input. Complete any desktop authentication yourself using the manual channel. Sending a task parks manual input while keeping the stream; **Take over** restores it, while **Disconnect** ends the connection. Skyrail leases do not isolate other clients or physical input.

See [troubleshooting](../SUPPORT.md), [manual unlock acceptance](REMOTE-UNLOCK.md), and [security boundaries](../SECURITY.md).

---

[Documentation hub](README.md) · [Need help? Troubleshooting →](../SUPPORT.md)
