# Support and troubleshooting

## Getting help

Search existing issues or open a new one at <https://github.com/predo-soares/audit-screens/issues>. Include the Audit Web Tools version, macOS version, Mac architecture, reproduction steps, and relevant log excerpts. Remove URLs, cookies, tokens, and private page content before sharing diagnostics.

## Local development

Install dependencies with `pnpm install`, then run `pnpm dev`. Before opening an issue, run:

```bash
pnpm typecheck
pnpm test:unit
pnpm audit:electron
```

The end-to-end suite starts local fixture servers and launches Electron. It needs permission to bind loopback ports and to run a GUI application.

## macOS packaging

`pnpm build:mac` requires:

1. A valid Developer ID Application certificate matching the identity in `desktop/electron-builder.yml`.
2. Hardened runtime-compatible entitlements.
3. Apple notarization credentials or an approved keychain profile.
4. A clean macOS build environment with network access to Apple's notarization service.

If electron-builder reports that signing was skipped, inspect the installed identities:

```bash
security find-identity -v -p codesigning
```

An ad-hoc signature is suitable for local testing but is not a public release signature.

## MCP connectivity

The local MCP endpoint is available at `http://127.0.0.1:4319/mcp` while the app is running. If it is unavailable, check the Settings view, confirm that another process is not using port `4319`, and restart Audit Web Tools. Do not expose the endpoint through a network proxy.

## Reporting security issues

Do not publish credentials, private URLs, or exploit details in a public issue. Contact the maintainer privately through the GitHub repository's available security-reporting channel.
