# Contributing to Skyrail

[简体中文](CONTRIBUTING.zh-CN.md) · [Setup and local testing](docs/GETTING-STARTED.md)

Skyrail is an early macOS project. English and Chinese issues and PRs are welcome. Check existing issues first; discuss large architecture or protocol changes before implementing them.

## Local development

Use Node.js 22.12+ (22 in CI). JavaScript tests, frontend builds and the UI do not need GUI permissions. Real chat needs an authenticated Codex CLI. Native features need macOS 14+ and Xcode Command Line Tools.

```sh
npm ci
npm run doctor
npm run dev
```

Use `CODEX_BIN` when Codex is not on PATH. Build the native adapter with `npm run setup:mac` only when testing native features. Ad-hoc signing means rebuilding may invalidate system permission grants. Linux checks cannot establish Mac behavior.

## Before submitting

```sh
npm test
npm run build
npm run setup:mac  # on macOS, after Swift changes
```

Add focused regression coverage for input, authorization, control ownership and session migration changes. UI changes should include relevant dimensions and screenshots with synthetic content. Distinguish touch simulation from actual phone testing. Model smoke scripts use the user's account and do not run in CI; see the setup guide.

Keep English and Chinese user guides aligned when changing setup, permissions, limits or workflows. State the concrete problem, resulting behavior, validation and remaining limits in the PR. Do not commit `.data/`, `workspaces/`, credentials, cookies, conversations, tunnel tokens or personal desktop screenshots.

## Design and implementation

- Follow [design guidance](docs/DESIGN.md) and [.impeccable.md](.impeccable.md).
- Keep video streaming separate from model observation. Configured FPS is not measured performance.
- Enforce thread/app/epoch/client ownership at dispatch; never work around a rejected input gate.
- Unknown write outcomes must not be retried automatically. Release input on failure, cancellation and disconnect.
- Retain third-party attribution and licenses.

## Protected main

Push a feature branch and open a PR. Main requires a PR, passing Linux/macOS checks on an up-to-date branch, and resolved review threads; force pushes and deletion are blocked. The single-maintainer setup requires zero approving reviews so the owner can merge their own PR after checks. There is no bypass list. CODEOWNERS identifies maintenance responsibility; it does not grant write access. Recheck the rules when adding maintainers or renaming CI jobs. See [maintainer notes](docs/MAINTAINERS.md).

Contributions are offered under MIT with the contributor's authority to do so. Support is best effort without an SLA.
