# 0001 — Electron + WebContentsView + CDP for device panes

Date: 2026-07-06
Status: accepted

## Context

The product must render live, interactive previews of arbitrary URLs across emulated devices. "Emulated device" means true device simulation: userAgent (header **and** `navigator.userAgent`), devicePixelRatio, touch events, mobile viewport-meta handling, and CSS media features (`pointer`, `hover`, resolution). Later phases add page audits (Lighthouse, network capture) and cross-engine checks.

## Decision

Electron shell. One `WebContentsView` per device pane. Emulation via CDP through `webContents.debugger` (`Emulation.setDeviceMetricsOverride` with `mobile: true`, `Emulation.setUserAgentOverride`, `Emulation.setTouchEmulationEnabled`) — pixel-identical to Chrome DevTools device mode. One shared `session` across panes (cookies/cache); `session.webRequest` for header handling so arbitrary sites load. Panes are exposed to the React UI behind an `EngineView` interface (`mount(bounds)` / `navigate(url)` / `setDevice(profile)` / `syncScroll(ratio)`) so future engine backends plug in per-pane.

## Alternatives considered

- **Tauri + single-webview iframe canvas** — rejected. Iframes can't emulate UA/DPR/touch; X-Frame-Options/frame-ancestors block most production sites; JS spoofing cannot fix engine-level behavior (CSS media features, `<meta viewport>`, srcset selection). WKWebView (Tauri on macOS) has no CDP surface; Lighthouse cannot run on WebKit.
- **Native macOS app (WKWebView)** — rejected as primary. Same WebKit emulation ceiling without private SPIs; single-platform; audits still require spawning Chromium.
- **Custom WebKit build (WinCairo/Cocoa ports)** — rejected. No stable third-party embedding API; owning security patching and build infra = becoming a browser vendor. Playwright's WebKit build is the maintained cross-platform distribution; consume it via protocol later instead.
- **agent-browser (Vercel Labs) as rendering surface** — rejected for live panes (JPEG-over-WebSocket ≈ remote desktop). Remains a candidate inside a future audit engine-runner (network/vitals capture, iOS Simulator tier).

## Consequences

- Full-fidelity emulation and a direct path to CDP-based audits (future).
- Chromium-only rendering initially; engine diversity arrives later via the EngineView abstraction (native WKWebView overlay for desktop Safari on macOS; streamed Playwright WebKit/Firefox).
- ~150MB shell + ~100–300MB per pane; mitigations when pane count grows: hibernate offscreen panes, shared session, background throttling.
