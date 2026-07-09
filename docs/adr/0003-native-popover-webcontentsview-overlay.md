# 0003 — Native popover via WebContentsView overlay

Date: 2026-07-07
Status: superseded by [0006](./0006-panel-manager-native-overlay.md)

## Context

The shell UI (React in the main window's `webContents`) sits **below** device panes in the paint stack. Each pane is a `WebContentsView` — an OS-level surface that ignores CSS `z-index`. DOM popovers (including shadcn/Radix/Floating UI) render inside the shell renderer and can be obscured by pane views whenever a popover extends over the canvas or panes are visible beneath it.

The toolbar already uses a hand-rolled DOM popover for zoom and theme pickers. That works only because pane views are clipped below the toolbar (`canvasTop`). Any future floating UI anchored over the canvas — or toolbar panels that visually overlap pane areas — needs a native-layer solution.

## Decision

Introduce **Native popover**: a persistent `WebContentsView` overlay, added last to the main window's `contentView` so it stacks above device pane views. A `PopoverManager` in the main process owns its lifecycle, bounds, and show/hide.

- **Content**: same electron-vite React bundle, dedicated overlay entry (`overlay.html`); panel components live in `components/popover/panels/` with a registry keyed by `panelId`.
- **Shell API**: `useNativePopover()` hook — `open({ panelId, anchorEl, placement?, payload? })`; non-modal dismiss (Escape, trigger toggle, click outside shell).
- **Placement**: shell sends anchor rect; overlay measures content and reports size; main positions with caller-preferred side + auto-flip fallback.
- **Actions**: overlay → main → destination (theme → `PaneManager`; zoom → forward to shell renderer).
- **Preload**: dedicated `popover-preload.ts` with minimal surface (`onShow`, `reportSize`, `sendAction`).
- **v1 scope**: full infrastructure + migrate toolbar zoom/theme panels; remove the existing DOM popover.

## Alternatives considered

- **DOM / shadcn Popover (status quo)** — rejected. Cannot paint above `WebContentsView` child views; clipping workarounds don't generalize to canvas-anchored UI.
- **Child `BrowserWindow` (frameless, parented)** — rejected for v1. Viable pattern (VS Code, Slack) but adds focus management, coordinate translation across windows, and macOS window chrome edge cases. Better fit for menus that escape window bounds; our popovers are anchored inside the main window.
- **`electron-mac-popover` (NSPopover wrapper)** — rejected. macOS-only native module wrapping a separate `BrowserWindow` in `NSPopover`; great native feel for macOS menus, but adds native-addon build/publish complexity and doesn't help if we ever ship cross-platform. Electron upstream PR #37423 was closed in favor of this module — same trade-offs.
- **`electron-overlay-window`** — rejected. Attaches a `BrowserWindow` overlay to an **external** app by window title (game HUD use case); Windows/Linux only, not macOS, not in-window stacking.
- **`@loc/electron-window`** — rejected for v1. React-portal child `BrowserWindow` manager with pooling; solves child-window ergonomics, not the in-window `WebContentsView`-above-`WebContentsView` stacking problem. Could complement a child-window approach later.
- **Electron click-through regions on overlay (`app-region`-style pass-through)** — not available. Upstream issue #49039 is open; no stable API to keep a full-window transparent dismiss layer while passing clicks to pane views below. Non-modal dismiss therefore stays shell-scoped (no "click pane to close" in v1).
- **Hide or lower pane views while popover is open** — rejected. Breaks non-modal preview interaction and causes visible flicker on large pane counts.

## Consequences

- One extra `WebContentsView` + `webContents` process at idle (~tens of MB); mitigated by a single persistent instance and small overlay bundle.
- Panel UI is duplicated across two renderer contexts (shell + overlay); shared components and tokens keep visual parity; state snapshots sent on open, actions routed through main.
- Z-order among child views relies on add order (overlay added after panes). Re-add-to-top may be needed if pane recreation ever covers the overlay — Electron has no first-class `setTopChildView` yet (issue #42061, partially addressed by re-add behavior).
- macOS-only MVP aligns with ADR 0002; a future cross-platform path likely revisits child `BrowserWindow` or platform-specific modules (`electron-mac-popover` on macOS, framed popup on others).
