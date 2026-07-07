# Postmortem: webviews not scaling with the infinite canvas

**Date:** 2026-07-07
**Status:** Fixed
**Files involved:** `desktop/src/renderer/src/hooks/use-pane-bounds.ts`, `desktop/src/main/web-contents-view-engine.ts`

## Symptom

Zooming or panning the infinite canvas rescaled the DOM device frames, but the
native `WebContentsView` web content stayed at its last size and position. It
looked like the web content ignored the canvas transform entirely.

## What made this hard

Four different scaling mechanisms were tried and **all appeared to do
nothing**:

1. CDP `Emulation.setDeviceMetricsOverride` with `scale`
2. `webContents.setZoomFactor(zoom)` (browser zoom)
3. Destroying and recreating the `WebContentsView` after scale changes
4. Electron's built-in `webContents.enableDeviceEmulation` with `scale`

Four unrelated APIs failing identically should have been the tell: the problem
was never the scaling mechanism. A common link in the chain was dead.

## Root cause

A stale `requestAnimationFrame` id in `usePaneBounds()`.

The hook batches bounds reports through rAF with a guard:

```ts
const scheduleReport = () => {
  if (frameRef.current !== null) return   // <- the guard
  frameRef.current = requestAnimationFrame(() => {
    frameRef.current = null
    reportBounds()
  })
}
```

A `useEffect` with `[scheduleReport]` deps had this cleanup:

```ts
return () => {
  window.removeEventListener('resize', handleLayoutChange)
  observerRef.current?.disconnect()
  if (frameRef.current !== null) {
    window.cancelAnimationFrame(frameRef.current)
    // BUG: frameRef.current was never reset to null
  }
}
```

The failure sequence, on the **first** zoom (or webview-scale) change:

1. `zoom` changes → `reportBounds` gets a new identity → so does
   `scheduleReport` (both are `useCallback` with `zoom` in deps).
2. The ref callback churn schedules a fresh rAF report (`frameRef = N`).
3. The `useEffect` keyed on `[scheduleReport]` re-runs. Its **cleanup** cancels
   rAF `N` but leaves `frameRef.current === N`.
4. From then on, every `scheduleReport()` call hits the
   `frameRef.current !== null` guard and returns. **Bounds reporting is
   permanently dead** — no more `pane:mount` IPC, ever.

Why it looked so confusing:

- The initial mount worked (no cleanup had run yet), so panes rendered
  correctly at the starting zoom.
- Pan-only changes worked *before* the first zoom, because `pan` is not a dep
  of `reportBounds` — no identity churn, no cleanup, no cancellation.
- Every scaling experiment was tested by moving the zoom/scale sliders, which
  killed the pipeline on the first touch. The engine never received a single
  updated mount, so every mechanism looked broken.

## The fix

Split the cleanup so cancellation only happens on unmount, and reset the ref:

```ts
useEffect(() => {
  const handleLayoutChange = (): void => scheduleReport()
  window.addEventListener('resize', handleLayoutChange)
  return () => window.removeEventListener('resize', handleLayoutChange)
}, [scheduleReport])

// Unmount-only: must not run when scheduleReport changes identity.
useEffect(() => {
  return () => {
    observerRef.current?.disconnect()
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }
}, [])
```

## The scaling architecture that shipped

The renderer owns layout truth; the main process owns native placement:

1. `DevicePane` renders the screen placeholder inside the CSS-transformed
   canvas.
2. `usePaneBounds()` measures it with `getBoundingClientRect()` (which
   includes pan/zoom transforms) and sends a `PaneMount` payload over IPC:
   `screenBounds` (transformed rect), `logicalSize` (unscaled device viewport),
   `cornerRadius`, `zoom`, `webviewScale`.
3. `WebContentsViewEngine.mount()`:
   - `view.setBounds(screenBounds)` — native view follows the transformed rect.
   - `webContents.enableDeviceEmulation({ screenPosition, screenSize:
     logicalSize, viewSize: logicalSize, deviceScaleFactor, scale: zoom *
     webviewScale })` — the page keeps its real device viewport (breakpoints
     stay stable) while the rendered output scales to fit the native bounds.
4. CDP (attached debugger) is used **only** for `Emulation.setUserAgentOverride`
   and `Emulation.setTouchEmulationEnabled`.

### Do not mix the two emulation APIs

`webContents.enableDeviceEmulation` and CDP
`Emulation.setDeviceMetricsOverride` write the same underlying Blink emulation
params — last writer wins. Pick one (we use the Electron API for
metrics/scale; CDP only for UA/touch).

### Fit-to-view behavior

When the native view bounds are smaller than the emulated `viewSize`, Blink
enters "fit to view" mode and auto-fits the content, largely ignoring the
explicit `scale` (the docs' parenthetical "not in fit to view mode" refers to
this). For the canvas use case this is fine: bounds are always
`deviceSize × zoom`, so the auto-fit factor equals the canvas zoom.

## What the probes established (Electron 39.8.10, macOS)

Standalone probe scripts (throwaway, in `/tmp`) verified with screenshots:

- `enableDeviceEmulation` `scale` visually scales a live `WebContentsView`
  (0.5 shrinks, 2 grows) without changing layout metrics.
- It works under the app's exact conditions: `sandbox: true`, session
  partition, attached debugger with UA/touch overrides, navigation after
  emulation was enabled, viewport-meta pages.
- It survives navigation (params persist across `loadURL`).
- `visualViewport.scale` does **not** reflect the emulation scale — don't use
  it to verify scaling; use screenshots or `capturePage`.

## Lessons

- **When several unrelated mechanisms fail identically, stop swapping
  mechanisms and instrument the pipeline.** The bug will be in the shared
  path (here: the renderer→IPC reporting chain), not in each mechanism.
- Silent `void somePromise()` calls and rAF guards are exactly where this
  class of bug hides. The engine now logs CDP failures and debugger detaches.
- Ground truth beats metrics: standalone Electron probe scripts +
  `capturePage()` screenshots settled in minutes what days of in-app tweaking
  could not.
- A diagnostic launcher (`desktop/diag-scale.mjs`, since removed) that drove
  the built app via Playwright-over-CDP and tailed main-process logs was the
  tool that exposed the missing `pane:mount` calls: it launched the built app
  with a remote debugging port, drove the zoom/scale sliders through the real
  UI, and counted `pane:mount` log lines per step.

## Leftover diagnostic scaffolding (remove when done)

- Toolbar **Webview scale** slider + **Recreate** button, `webviewScale` in
  the `PaneMount` payload, and the `pane:recreate-all` IPC path — added as
  probes, not product features. (The `diag-scale.mjs` launcher and the
  `SCALE_DIAG` logging were removed when this was committed.)
