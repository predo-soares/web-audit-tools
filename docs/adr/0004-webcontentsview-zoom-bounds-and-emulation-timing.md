# 0004 — WebContentsView zoom bounds and device-emulation timing

Date: 2026-07-07
Status: accepted

## Context

Device pane `WebContentsView` instances appeared at the wrong width on first launch. The content rendered as if the canvas zoom were 1× rather than the default 0.75×, leaving the pane either clipped or showing the unscaled site in a too-wide native frame. Manually zooming in and then back out to the same value fixed the layout, implying the second `mountPane` IPC call worked while the first one did not.

Two independent problems combined to produce this bug:

**1. CSS `zoom` and `getBoundingClientRect` width reporting**

The canvas uses a non-standard CSS `zoom` property on the pane wrapper div (`style={{ zoom }}`). The placeholder div measured by `usePaneBounds` has an explicit `width: screenWidth` in style; its parent carries the zoom. `getBoundingClientRect` on the placeholder returns the correct *viewport* `x`/`y` coordinates (they account for the ancestor zoom), but in some Chromium builds the reported `width`/`height` values are the *pre-zoom layout dimensions* — i.e. the raw `screenWidth` (e.g. 393 for iPhone) rather than the visual-viewport size (393 × 0.75 ≈ 295). The previous Codex fix (double `requestAnimationFrame`) correctly identified a timing concern but did not address this because the issue is in what value `getBoundingClientRect` produces on every frame, not when it is read.

**2. `WebContentsViewEngine` initialised with `zoom = 1` instead of `DEFAULT_ZOOM`**

`WebContentsViewEngine` stores the current zoom in `private zoom = 1`. `setDevice()` is called during engine init (before the renderer has loaded and reported its first `mountPane` IPC) and always calls `applyDeviceEmulation()` at its end using `this.zoom`. With `zoom = 1`, `enableDeviceEmulation` is called with `scale: 1`, meaning the 393 px logical viewport is rendered at 100 % scale inside the 295 px native view — correct content width but wrong scale. The page then loads under that emulation.

When `mountPane` IPC subsequently arrives from the renderer, `mount()` sets `this.zoom = 0.75` and calls `applyDeviceEmulation(scale: 0.75)`. In the race where the IPC arrives while the page is still loading (or before the `WebContents` renderer process is fully initialised), `enableDeviceEmulation` can be silently dropped. After `navigate()` resolves, no second call re-applies the emulation, so the page remains at scale 1.

On zoom-in/out, `mount()` is called again with a *different* `zoom` value, satisfying `zoom !== this.zoom`, which unconditionally re-runs `applyDeviceEmulation` — now against a fully loaded `WebContents` that accepts the call.

## Decision

Three targeted fixes, all additive and non-breaking:

**1. Compute native view width/height mathematically (`usePaneBounds`)**

Replace `rect.width` / `rect.height` from `getBoundingClientRect` with `dimensions.screenWidth * zoom` and `dimensions.screenHeight * zoom`. These are the exact dimensions the native view must have to show the full logical viewport at the current canvas zoom, and they are knowable without DOM measurement. `x`/`y` still come from `getBoundingClientRect` — viewport coordinates are correct there.

**2. Initialise engine zoom to `DEFAULT_ZOOM` (`WebContentsViewEngine`)**

Change `private zoom = 1` to `private zoom = DEFAULT_ZOOM`. The renderer always starts at `DEFAULT_ZOOM = 0.75` (no persistence). Initialising the engine to match means `setDevice()` applies `enableDeviceEmulation(scale: 0.75)` from the first call, so even if the renderer's `mountPane` IPC is late, the emulation is already correct.

**3. Re-apply device emulation after every `loadURL` (`WebContentsViewEngine.navigate`)**

Add `this.applyDeviceEmulation()` after `await this.webContents.loadURL(url)`. Once `loadURL` resolves the `WebContents` renderer is fully initialised and guaranteed to accept `enableDeviceEmulation`. This closes the race where an earlier call was silently dropped during page load. The call is idempotent when settings have not changed.

## Alternatives considered

- **Double `requestAnimationFrame` before measuring (Codex fix)** — tried first; did not fix the bug. The timing of the read was not the issue; the value returned by `getBoundingClientRect` was wrong on every frame for the ancestor-CSS-`zoom` case.
- **Use `transform: scale` instead of CSS `zoom`** — would give predictable `getBoundingClientRect` semantics (scale transforms are explicitly excluded from the rect). Rejected: CSS `zoom` affects layout (the element takes up zoomed space), which lets the scroll container compute correct overflow. `transform: scale` does not affect layout; pane placeholders would not push the container to the right width, breaking horizontal scroll and alignment.
- **Listen to `did-finish-load` to re-apply emulation** — equivalent to fix 3 but always attached as an event listener rather than called inline after `loadURL`. Rejected in favour of the inline call: attaching a persistent listener fires on every in-page navigation (SPA route changes), whereas the current approach only re-applies after explicit programmatic navigations originating from the app.
- **Re-apply mount after `doNavigateAll` in `PaneManager`** — would work for the initial navigation but requires exposing `applyDeviceEmulation` or adding a dedicated public method on `WebContentsViewEngine`, and still leaves the race open for subsequent navigations.

## Consequences

- `usePaneBounds` no longer depends on `getBoundingClientRect` reporting zoomed width/height, which removes a subtle Chromium-version sensitivity.
- `WebContentsViewEngine.navigate` now makes one extra synchronous `enableDeviceEmulation` call per navigation. The call is effectively a no-op when settings are unchanged; no visible effect.
- `DEFAULT_ZOOM` is now imported by the main process from `shared/mockup-layout`. If that constant is ever made user-configurable and persisted, the engine initialisation value will need to come from persisted settings instead.
