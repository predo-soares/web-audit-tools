# 0002 — electron-vite toolchain, macOS-first, any-URL scope

Date: 2026-07-06
Status: accepted

## Decisions

1. **Toolchain**: electron-vite (main/preload/renderer split, renderer HMR) + TypeScript + React + Tailwind, pnpm. electron-builder for packaging when distribution starts. Electron Forge rejected (heavier config indirection, Vite plugin maturity); manual esbuild rejected (plumbing over product).
2. **Platform**: macOS only for the MVP. Cross-platform later is packaging/CI work, not rearchitecting; the future WKWebView desktop-Safari pane is macOS-only anyway.
3. **URL scope**: arbitrary URLs from day one (not just localhost). Session-level header handling ships in the MVP.

## Consequences

- No Windows/Linux CI, signing, or platform-quirk work until after MVP.
- Renderer follows the user's frontend conventions: kebab-case files, PascalCase components, `components/ui/` primitives, `cn()` utility.
