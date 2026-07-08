# audit-screens

A macOS desktop tool for previewing a website across multiple device viewports simultaneously, with synchronized scrolling. Competes with Sizzy/Responsively. Long-term direction is **agentic-first**: the product will audit pages and package findings (console errors, failed requests, Lighthouse results) into prompts/context for the user's coding agent (Claude Code, Cursor) — see Future features in the PRD; none of that is in the current milestone.

## Ubiquitous language

- **Device pane** — one live browser view emulating a device (viewport, DPR, UA, touch) inside the app window.
- **Device preset** — a named emulation profile (e.g. "iPhone 16 Pro" = 393×852 @3x, touch, mobile UA).
- **Scroll sync** — mirroring vertical scroll position across panes, ratio-based (scrollTop / scrollable height), with echo suppression.
- **EngineView** — the abstraction a pane renders through. First and only backend today: Electron `WebContentsView` (Chromium). Designed so future backends (native WKWebView overlay, streamed Playwright WebKit/Firefox) plug in without rearchitecting.
- **Native popover** — floating UI that must paint above device panes. Rendered in a dedicated overlay view stacked above pane views inside the main window (not DOM/CSS in the shell renderer — device panes are OS-level surfaces that ignore z-index).
- **Popover panel** — the typed content inside a native popover (e.g. zoom picker, theme picker), identified by `panelId`.

## Architecture (decided — see docs/adr/)

Electron + one `WebContentsView` per device pane, emulation driven via CDP (`webContents.debugger`: `Emulation.setDeviceMetricsOverride`, `setUserAgentOverride`, `setTouchEmulationEnabled`). Arbitrary URLs load via `session.webRequest` header handling (X-Frame-Options / frame-ancestors are irrelevant to views, but COOP/COEP and UA-header alignment are handled at session level). Shell UI is React; panes are native views positioned over placeholder divs whose bounds the renderer reports over IPC.

Rejected alternatives and why: ADR 0001.

## Stack

pnpm · electron-vite · TypeScript · React · Tailwind. File conventions: kebab-case files, PascalCase components, `components/ui/` for primitives, `cn()` for class merging.

## Status

Pre-implementation. The MVP is specced in `.scratch/multi-device-preview/PRD.md` with implementation issues alongside it.
