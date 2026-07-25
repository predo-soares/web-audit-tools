# 0006 — PanelManager with N lazy WebContentsView overlays

Date: 2026-07-08
Status: accepted

## Context

ADR 0003 introduced a single `WebContentsView` overlay (`PopoverManager`) for toolbar UI that must paint above device panes. Product direction now generalizes this into a **Panel** primitive — native translucent surfaces for all shell UI above panes (toolbar popovers today; sidebar in a follow-up).

Design review established:

1. A single `WebContentsView` cannot host multiple non-overlapping panels (e.g. left sidebar + right sidebar) while keeping device panes clickable in the center — one rectangular bounds intercepts pointer events in the gap (Electron click-through #49039).
2. NSPanel/NSPopover with React content still requires a `BrowserWindow` renderer per panel (~30–60 MB each) — no meaningful memory savings vs `WebContentsView`.
3. Sidebar in the shell DOM requires `setPanesVisible(false)` during width animation because pane bounds lag layout.

## Decision

Replace `PopoverManager` with **`PanelManager`**:

- **One `WebContentsView` per visible panel**, created lazily, destroyed (or pooled) on close.
- **Tight bounds** per panel so device panes remain interactive outside panel regions.
- **Same overlay bundle** (`overlay.html`) loaded in each view; panel content via registry keyed by `panelId`.
- **Shell API:** unified `usePanel(panelId, { mode, open, ... })` replacing `useNativePopover`.
- **Panel modes:** `anchored` (popover placement + dismiss), `docked` (fixed edge,
  bounds animation in main — sidebar, Phase 2), and `modal` (full-window bounds
  with a blocking backdrop).
- **Modal bounds exception:** anchored and docked panels keep tight bounds so the
  device canvas remains interactive around them. A modal intentionally covers the
  full content bounds because blocking interaction with every underlying panel and
  device pane is part of its contract.
- **Default chrome:** translucent glass matching canvas (`glass-canvas-panel`).
- **Phase 1 scope:** migrate toolbar zoom/theme; architecture supports docked sidebar in Phase 2.
- **Data (Phase 2 sidebar):** panel overlay reads projects/history from main process directly, not shell payload snapshots.

## Alternatives considered

- **Single WebContentsView, multiple panels in one React tree** — rejected. Minimal bounding rectangle blocks pane interaction between panels.
- **Single WebContentsView, one panel at a time** — rejected. Cannot show sidebar + popover simultaneously.
- **NSPanel + BrowserWindow (`electron-mac-popover`)** — rejected. Same renderer memory, native-addon cost, macOS-only (ADR 0003 rationale stands).
- **NSPanel + pure AppKit UI** — rejected. Abandons React panel views.
- **Sidebar stays in DOM; Panel for popovers only** — deferred as Phase 1; full Panel unification in Phase 2.
- **Shell pushes data snapshots via `usePanel` payload** — rejected for sidebar (Phase 2). Main process already owns stores.

## Consequences

- Memory scales with **open** panels (~30–60 MB each), not registered panel types. Typical peak: sidebar + one popover ≈ +60–100 MB vs one overlay today.
- `PanelManager` complexity increases vs single-view `PopoverManager` (per-panel view map, z-order for multiple views).
- Modal panels add one deliberate full-window input-interception case; opening one
  dismisses anchored popovers while preserving docked-panel state underneath.
- IPC surface grows (`panel:*` replaces `popover:*`); shell and overlay preloads rename accordingly.
- Phase 2 sidebar migration removes `setPanesVisible` hack and sidebar DOM from shell renderer.
- ADR 0003 remains historically accurate; this ADR supersedes it for overlay architecture going forward.
