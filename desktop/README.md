# Audit Web Tools

Audit Web Tools is a macOS desktop app for previewing and auditing websites across multiple device sizes. It provides synchronized device panes, page SEO and Lighthouse audits, runtime diagnostics, and capture bundles for AI coding agents.

## Supported platform

The current product scope is macOS. The first distribution target is Apple Silicon (`arm64`); Intel and universal builds require an explicit release build and validation before being advertised.

The app loads arbitrary websites, including local development servers. Preview panes share a browser session so authenticated pages can be inspected consistently across devices.

## Privacy at a glance

- History and saved projects are stored locally with Electron Store.
- Browser cookies and cache are stored in the local app session.
- Capture bundles are written to `~/.audit-screens/captures/`.
- No analytics or remote telemetry is configured in the application.
- The local MCP endpoint is enabled when the app starts so configured coding agents can control the running panes. It binds to loopback; see the MCP documentation and [PRIVACY.md](../PRIVACY.md).

See the full [privacy policy](../PRIVACY.md) before distributing the app.

## Install a release

Download the macOS DMG or ZIP from the project's [GitHub releases](https://github.com/predo-soares/audit-screens/releases). Open the DMG, drag Audit Web Tools to Applications, and launch it from there.

Unsigned or locally built artifacts may be blocked by macOS Gatekeeper. Public releases must be Developer ID signed and notarized.

## Development

Requirements: Node.js, pnpm, and macOS for the native app and end-to-end tests.

```bash
pnpm install
pnpm dev
```

Useful checks:

```bash
pnpm typecheck
pnpm test:unit
pnpm test:e2e
pnpm audit:electron
```

## Build installers

```bash
# Unpacked local app
pnpm build:unpack

# Signed and notarized macOS release
pnpm build:mac

# Experimental targets; platform-specific CI and signing are still required
pnpm build:win
pnpm build:linux
```

The macOS build expects a valid Developer ID identity and the configured Apple notarization credentials. See [SUPPORT.md](../SUPPORT.md) for release troubleshooting.

## Agent integration

Audit Web Tools exposes a loopback MCP endpoint at `http://127.0.0.1:4319/mcp`. The checked-in [`.mcp.json`](../.mcp.json) lets supported agents connect when working from this repository. The endpoint can navigate panes, read observed context, run audits, and create capture bundles.

## Project documents

- [Privacy policy](../PRIVACY.md)
- [Support and troubleshooting](../SUPPORT.md)
- [Changelog](../CHANGELOG.md)
- [License](../LICENSE)
- [MCP documentation](src/main/mcp/README.md)
