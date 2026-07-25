# Lighthouse

The Lighthouse feature runs Google Lighthouse against the currently-loaded page in
an **isolated headless Chrome** and renders a PageSpeed-Insights-style report for
both Mobile and Desktop. It spans all three Electron process layers.

## Layers at a glance

| Layer | Files | Responsibility |
| --- | --- | --- |
| **Shared** | `src/shared/lighthouse.ts`, `src/shared/lighthouse-lab.ts` | Types, lab-spec presets, the pure `projectLighthouseResult` projection, sanitizers. Imported by both main and renderer. |
| **Main** | `src/main/seo/lighthouse-manager.ts`, wired in `src/main/ipc.ts` | Owns the run lifecycle: launches Chrome, runs Lighthouse, drives the state machine, broadcasts state. |
| **Preload** | `src/preload/index.ts`, `src/preload/panel-preload.ts` | Exposes `window.api` methods over IPC. |
| **Renderer** | `src/renderer/src/components/lighthouse/**` | Presentational report. Subscribes to state; sends run/cancel. |

Nothing about the run lives in the renderer — it is a pure view over state pushed
from main. This survives renderer reloads: `getLighthouseState()` re-hydrates.

## Data flow (happy path)

```
App.tsx (workspace === 'lighthouse')
   └─ <LighthouseView>
        │  mount: getNavigationState(), getLighthouseState()
        │  subscribe: onPaneNavigation, onLighthouseState
        │
        │  user clicks "Analyze page"
        ▼
   window.api.runLighthouse(labSelection)
        │  ipcRenderer.invoke('seo-lighthouse:run', labSelection)
        ▼
   ipc.ts handler
        │  reads paneManager.getNavigationState() for the URL + active pane
        │  builds headers (User-Agent), shareSession = false (hard-disabled)
        ▼
   LighthouseManager.run({ url, paneId, shareSession, headers, labSelection })
        │  for profile of ['mobile', 'desktop']:
        │     runner(input, signal, onProgress)   ← runLighthouse()
        │        launching → loading → auditing → projecting → cleanup
        │        launches isolated Chrome (chrome-launcher, --headless=new)
        │        dynamic import('lighthouse'), runs against chrome.port
        │        projectLighthouseResult(run.lhr, …)   ← shared projection
        │     store result under results[profile]
        │  every set() → notify(state)
        ▼
   ipc.ts notify → webContents.send('seo-lighthouse:state', state)
        ▼
   preload onLighthouseState listener → setState in <LighthouseView>
```

Each `set()` in the manager both stores state locally (for `getState()`) and calls
`notify`, so the renderer sees every phase transition.

## Shared layer

### `lighthouse.ts`

- **Profiles**: `LighthouseProfile = 'mobile' | 'desktop'`. A run always does both,
  mobile first (`LIGHTHOUSE_PROFILES`).
- **Progress phases**: `launching → loading → auditing → projecting → cleanup`
  (`LIGHTHOUSE_PROGRESS_PHASES`), each with a short step label.
- **Core metrics**: `LIGHTHOUSE_CORE_METRIC_IDS` — FCP, LCP, TBT, CLS, Speed Index.
  These drive the Metrics grid and are excluded from the performance audit buckets
  to avoid duplication.
- **`LighthouseAssessmentResult`**: the projected, storage-friendly shape of one
  profile's report — categories, `audits` map, `auditGroups`, `opportunityIds`,
  `diagnosticIds`, retained/total/truncated counts, and a `labSpec` snapshot.
  Several fields (`targetUrl`, `pageAuditId`, `scores`) are `@deprecated`
  Page-SEO-compatibility shims kept during the presentation migration.
- **`LighthouseAssessmentState`**: the discriminated union the manager broadcasts —
  `idle | running | completed | cancelled | failed`. `running` additionally carries
  `activeProfile`, `paneId`, `targetUrl`, and a `progress` object.
- **`projectLighthouseResult(rawLhr, input)`**: the one piece of non-trivial pure
  logic. It:
  1. Walks category `auditRefs` to build an ordered id list and a per-audit
     `group` map, appending any ungrouped audits alphabetically.
  2. Derives `opportunityIds` (`load-opportunities`, `budgets` groups) and
     `diagnosticIds` (`diagnostics` group).
  3. Prioritizes opportunities → diagnostics → everything else, then caps at
     `MAX_AUDITS = 250` (`retained`), recording the truncation count.
  4. Copies only retained audits into a flat `audits` map, coercing/normalizing
     each field and running every string through `text()`.
  - **`text()`** truncates to `MAX_TEXT = 2000` and redacts markdown links plus
    `file://` / `/Users/` / `Cookie:` / `Authorization:` fragments. This is why the
    projection is shared: sanitization must happen before the LHR ever leaves main.
- **Helpers**: `sanitizeLighthouseError`, `markLighthouseResultsStale`,
  `hasAnyLighthouseResult`, `EMPTY_LIGHTHOUSE_RESULTS`.

### `lighthouse-lab.ts`

Defines the emulation presets and the "lab spec" that captions each report.

- **Devices**: mobile (`moto-g-power`, `pixel-7`, `iphone-14`) and desktop
  (`desktop-1350`, `desktop-1920`), each with a `screenEmulation` block.
- **Networks**: `slow-4g`, `fast-4g`, `cable` (all `simulate` with throttling
  numbers), and `none` (`provided`, no throttling). CPU slowdown rides on the
  network preset's `cpuSlowdownMultiplier`.
- **`LighthouseLabSelection`**: the user's four choices (mobile/desktop device +
  network). `DEFAULT_LIGHTHOUSE_LAB_SELECTION` mirrors PSI defaults: mobile =
  Moto G Power on Slow 4G, desktop = 1350×940 unthrottled.
- **`resolveLighthouseDevice` / `resolveLighthouseNetwork`**: profile + selection →
  preset, with safe fallbacks.
- **`buildLabSpecSnapshot`**: freezes device/network/CPU/browser/version/timestamp
  into a `LighthouseLabSpecSnapshot` that is embedded in the result and rendered by
  `SpecsBar`.

## Main layer

### `LighthouseManager` (`src/main/seo/lighthouse-manager.ts`)

A state machine that owns one run at a time. Constructed with a `notify` callback
and an injectable `runner` (defaults to `runLighthouse`; tests inject a fake).

- **`run(input)`**: no-ops if already `running`. Assigns a monotonically increasing
  `runId`, creates an `AbortController`, then loops mobile → desktop. Between and
  during profiles it checks `abort.signal.aborted || runId !== this.runId` to bail
  out as `cancelled`, preserving partial results. Transitions to `completed`, or to
  `failed` (with `sanitizeLighthouseError`) on a thrown error that isn't an abort.
- **`cancel()`**: bumps `runId` (invalidates in-flight progress callbacks) and
  aborts the controller.
- **`handlePaneDocumentChange(paneId)`**: wired to `paneManager.onPaneDocumentChange`
  in `ipc.ts`. If a run is active for that pane it cancels; either way it marks
  existing results for that pane **stale** (the "Current/Stale" badge in the UI).
- **`markStale(paneId?)`**: flips `stale: true` on matching results without rerunning.
- **`set(state)`**: single choke point — stores `this.state` and calls `notify`.

### `runLighthouse` (the default runner)

1. `onProgress('launching')`, dynamic `import('lighthouse')` (kept out of the main
   bundle's startup path).
2. Launches an **isolated** Chrome via `chrome-launcher` with
   `--headless=new --no-first-run --disable-gpu`. Registers `chrome.kill()` on the
   abort signal.
3. Resolves device + network from the selection, runs `lighthouse(url, {...})` with
   `formFactor`, `screenEmulation`, `throttlingMethod`, optional `throttling`, and
   `extraHeaders` only when `shareSession` is true.
4. Parses the host UA into a friendly `browserLabel` ("Headless Chromium …").
5. `projectLighthouseResult(run.lhr, …)` with a generated id and a `labSpec`
   snapshot.
6. `finally`: `onProgress('cleanup')` and `chrome.kill()` (best-effort).

> **Session sharing is hard-disabled.** `ipc.ts` passes `shareSession: false` with a
> comment: cookies can't yet be safely seeded into the isolated Chrome jar. The
> `headers`/`extraHeaders` plumbing exists but only the User-Agent is forwarded.

### IPC wiring (`src/main/ipc.ts`)

| Channel | Direction | Behavior |
| --- | --- | --- |
| `seo-lighthouse:get-state` | invoke | returns `manager.getState()` |
| `seo-lighthouse:run` | invoke | reads current URL/pane from `paneManager`; no-ops if no URL; calls `manager.run(...)` |
| `seo-lighthouse:cancel` | invoke | `manager.cancel()` |
| `seo-lighthouse:state` | send → renderer | pushed on every `notify`, to `BrowserWindow.getAllWindows()[0]` |
| `app:lighthouse-view` | send → renderer | toggles the Lighthouse workspace (from an `enter-lighthouse-view` menu/action) |

## Renderer layer

Entry: `App.tsx` renders `<LighthouseView>` when `workspace === 'lighthouse'`
(toggled by `onEnterLighthouseView`). The folder is a feature module with a barrel
`index.ts` exporting only `LighthouseView`.

### Component tree

```
LighthouseView                     state owner; subscribes to nav + lighthouse state
├─ LabSpecsPicker                  device/network <select>s for mobile & desktop labs
├─ ProfileTabs                     Mobile/Desktop tabs (readiness dot)
├─ ProgressPanel                   phase/profile stepper + progress bar (running only)
└─ ProfileReport                   the report for the viewed profile
   ├─ SpecsBar                     labSpec caption (device, network, CPU, browser…)
   ├─ ScoreGauge ×N                one donut gauge per category (summary row)
   └─ DimensionSection ×N          per-category detail
      ├─ ScoreGauge (lg)           large centered gauge
      ├─ ScoreLegend               0–49 / 50–89 / 90–100 legend
      ├─ MetricsGrid               Core Web Vitals (performance only)
      └─ AuditBucket ×4            failed / manual / passed / notApplicable
         └─ AuditRow               expandable audit (title, value, description)
```

### State handling in `LighthouseView`

- Local UI state: `url`, `title`, `viewProfile`, `labSelection`, and the mirrored
  assessment `state`.
- On mount: fetches nav + lighthouse state, subscribes to `onPaneNavigation` and
  `onLighthouseState`; unsubscribes on unmount.
- When a run is `running`, `viewProfile` auto-follows `state.activeProfile` so the
  user watches the profile currently being audited.
- `auditable = isAuditableUrl(url)` gates the Analyze button and swaps in guidance
  copy for non-HTTP(S) pages. `result = state.results[viewProfile]` is what renders.

### `lib/` helpers

- **`scoring.ts`**: `scoreTone(score)` → `pass ≥ 0.9 | average ≥ 0.5 | fail | none`,
  plus `TONE_STROKE/TEXT/SHAPE` (Lighthouse's green/amber/red, with a distinct shape
  per tone for color-blind support) and `formatScore` (0–100 or `—`).
- **`audits.ts`**: `classifyAudit` maps an audit's `scoreDisplayMode`/`score` into a
  bucket; `BUCKET_META` gives labels + default-open state; `groupByAuditGroup`
  clusters audits by `groupId` using `auditGroups` metadata (with a humanized
  fallback). `CORE_METRIC_SET` excludes CWV metrics from performance buckets.
- **`styles.ts`**: shared Tailwind easing/press/chevron class strings so motion is
  identical across subcomponents.

### Notable rendering details

- **ScoreGauge** is a hand-rolled SVG donut (`strokeDasharray` animated) — no chart
  lib. Two sizes (`md` summary, `lg` section header).
- **AuditBucket** renders the `failed` bucket expanded and un-collapsed; the other
  three buckets are collapsible accordions (`manual`/`passed`/`notApplicable`).
- **DimensionSection** shows per-category blurbs (`CATEGORY_BLURB`) and only renders
  `MetricsGrid` for the `performance` category.
- Motion respects `prefers-reduced-motion` throughout (`motion-safe:` / `motion-reduce:`).

## Tests

| File | Covers |
| --- | --- |
| `test/unit/lighthouse-projection.test.ts` | projection prioritizes opportunities/diagnostics; sensitive text is sanitized |
| `test/unit/lighthouse-lab.test.ts` | PSI-like defaults resolve; lab snapshot is built correctly |
| `test/unit/seo-lighthouse-manager.test.ts` | runs mobile→desktop; cancel keeps partial results; staleness marking (all + pane-scoped) |

The manager tests inject a fake `runner`, so the state machine is verified without
launching Chrome. The projection and lab logic are pure and tested directly.

## Key design decisions

1. **Isolated Chrome per run** — audits a clean profile, never the user's live
   browsing session (also why session sharing is currently disabled).
2. **Projection in shared, run in main** — the raw LHR is large and can contain
   sensitive strings; `projectLighthouseResult` trims to ≤250 audits and redacts
   before anything crosses to the renderer.
3. **State lives in main** — the renderer is a pure view; reloads and late mounts
   re-hydrate via `getLighthouseState()`.
4. **Both profiles every run** — mobile then desktop, sequentially, with partial
   results retained on cancel.
