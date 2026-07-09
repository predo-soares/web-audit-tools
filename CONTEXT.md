# audit-screens

A macOS desktop tool for previewing a website across multiple device viewports simultaneously, with synchronized scrolling. Competes with Sizzy/Responsively. Long-term direction is **agentic-first**: the product will audit pages and package findings (console errors, failed requests, Lighthouse results) into prompts/context for the user's coding agent (Claude Code, Cursor) — see Future features in the PRD; none of that is in the current milestone.

## Ubiquitous language

- **Device pane** — one live browser view emulating a device (viewport, DPR, UA, touch) inside the app window.
- **Device preset** — a named emulation profile (e.g. "iPhone 16 Pro" = 393×852 @3x, touch, mobile UA).
- **Scroll sync** — mirroring vertical scroll position across panes, ratio-based (scrollTop / scrollable height), with echo suppression.
- **Interaction sync** — mirroring clicks (and other interactions) across panes by resolving the *same interactive element* in each target pane, not by mapped coordinates. Strict: if no confident match exists in a target pane, that pane does nothing (no coordinate fallback). A missing match is honest — the element may genuinely not exist at that breakpoint.
- **Element fingerprint** — the serialized identity of an interacted element, layered by stability: id → test id (`data-testid`/`name`) → accessible name + role/tag → visible text + tag → structural path as tiebreaker. A target pane resolves layers in order and requires a unique hit; ambiguity among identical candidates is broken by index-among-matches.
- **Value sync** — the input-mirroring half of interaction sync: text-entry state (`input`/`change`) is mirrored as *resulting value*, not keystrokes — panes converge on the same field state even if per-key behavior diverges. Checkboxes/radios are excluded (their trusted mirrored click already toggles them); `<select>` mirrors the chosen option.
- **Element mirror** — the single implementation of interaction sync's element identity: fingerprint building, resolution, and mirror-failure classification live in one self-contained factory (`createElementMirror` in `desktop/src/shared/element-mirror.ts`). Three consumers share the same artifact: the pane preload calls it directly, the engine serializes it with `toString()` into CDP-injected expressions, and unit tests exercise it in happy-dom. Invariant: the factory body must not reference module scope — TypeScript checks it as one unit so the injected copy can never drift.
- **Echo ledger** — the single record of "this pane is about to report an event we caused" (`createEchoLedger` in `desktop/src/main/echo-ledger.ts`). Mirrored clicks and submits are trusted native input, so target panes re-report them; broadcast scrolls likewise come back as scroll reports. Sync paths call `expect(pane, kind)` before applying a mirrored action and `isEcho(pane, kind)` on every incoming event; per-kind semantics (1s TTL for click/submit so a mirrored action that never fired can't swallow a later real one, one-shot flags for scroll) are implementation, not interface.
- **Interactive ancestor** — the nearest self-or-ancestor element that is actually interactive (`a`, `button`, form controls, interactive ARIA roles, tabbable). Interactions are fingerprinted against it, not the raw event target — clicking an icon inside a button means the button.
- **EngineView** — the abstraction a pane renders through. First and only backend today: Electron `WebContentsView` (Chromium). Designed so future backends (native WKWebView overlay, streamed Playwright WebKit/Firefox) plug in without rearchitecting.
- **Panel** — native translucent UI surface (`WebContentsView`) that paints above device panes. Managed by `PanelManager`; one lazy view per visible panel with tight bounds. Default glass styling matches the canvas. Modes: `anchored` (toolbar popovers) or `docked` (sidebar).
- **Panel view** — the React content inside a Panel (e.g. zoom picker, theme picker, sidebar), registered by `panelId`.
- **Active pane** — the device pane the toolbar reflects: last to navigate in-page or last to receive focus. URL bar, title, and favicon track the active pane. Toolbar back/forward operate on its per-pane browser history stack only. When no pane is active yet (e.g. after URL-bar navigation only), **desktop** is the fallback target.
- **Pane navigation** — back/forward within one device pane's Chromium session history (`webContents.goBack()` / `goForward()`). Distinct from **visit history** (sidebar log of committed URLs).
- **Visit history** — sidebar list of URLs the user has loaded (`HistoryStore`). Choosing an entry navigates all panes to that URL; it is not the same as browser back/forward.
- **Agent handoff** — moving what the human is currently observing in the app into a coding agent's working context. The handoff is the agentic product job; multi-device preview is the surface where the observation happens.
- **Observed context** — the current evidence available from the device panes for an agent handoff: visible page state, pane metadata, and runtime signals such as console or network failures.
- **Snapshot** — a user-initiated moment-in-time capture of observed context. A snapshot is one way to perform an agent handoff; live agent access to observed context does not have to create a snapshot.
- **Capture bundle** — a persisted snapshot artifact intended for agent consumption. Its entrypoint is an agent-readable context document, with supporting assets such as pane screenshots and raw evidence files.

## Architecture (decided — see docs/adr/)

Electron + one `WebContentsView` per device pane, emulation driven via CDP (`webContents.debugger`: `Emulation.setDeviceMetricsOverride`, `setUserAgentOverride`, `setTouchEmulationEnabled`). Arbitrary URLs load via `session.webRequest` header handling (X-Frame-Options / frame-ancestors are irrelevant to views, but COOP/COEP and UA-header alignment are handled at session level). Shell UI is React; panes are native views positioned over placeholder divs whose bounds the renderer reports over IPC.

Rejected alternatives and why: ADR 0001.

## Stack

pnpm · electron-vite · TypeScript · React · Tailwind. File conventions: kebab-case files, PascalCase components, `components/ui/` for primitives, `cn()` for class merging.

## Status

MVP built (multi-device preview, scroll sync, history, saved projects). Direction decided 2026-07-07: Agentic Workbench — human→agent handoff. Product artifacts live in `.gstack/`.
