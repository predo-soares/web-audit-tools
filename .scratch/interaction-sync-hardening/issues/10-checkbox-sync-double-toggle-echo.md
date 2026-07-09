# 10 — Fix checkbox/radio sync double-toggle from preload echo

Status: done

## Parent

`.scratch/interaction-sync-hardening/PRD.md` (decision record: `docs/adr/0005-semantic-interaction-sync.md`)

## What to build

When a checkbox or radio is synced via `element.click()` inside the CDP expression, the preload's capture listener in the target pane fires synchronously and re-sends `pane:click` before `syntheticClickExpiry` is consumed. This causes the toggle to flip twice — returning to its original state — instead of once. The fix should ensure the expiry entry is in place before `element.click()` executes, or that the preload suppresses the echo via a mechanism that does not depend on IPC round-trip timing.

## Acceptance criteria

- [x] Clicking a checkbox in iphone toggles it exactly once in ipad and desktop (checked → checked, not checked → unchecked → checked)
- [x] Clicking a radio button in iphone selects the matching radio in ipad and desktop exactly once with no subsequent deselect
- [x] The echo suppression does not swallow a subsequent real user click on the same element

## Blocked by

None - can start immediately

## Comments

### 2026-07-08

- Implemented replay-side synthetic click reservation in `desktop/src/main/pane-manager.ts` before `resolveClickPoint()` runs, so any target-pane click echo that fires during in-page replay can be consumed immediately instead of rebroadcast.
- Added revocation for unresolved, stale-engine, stale-epoch, link-navigation, and handled-no-echo paths so the reservation does not swallow a later real click.
- Updated checkbox/radio handling in `desktop/src/main/web-contents-view-engine.ts` to apply the target checked state and dispatch `input`/`change` from the click-resolution path without emitting a second target-pane click event.
- Follow-up root cause for intermittent missed checkbox sync: replay was still deriving toggle behavior from the target pane's current checked state. When clicks overlapped or a pane was already one event behind, target-side inversion could miss the source pane's actual post-click state. The click fingerprint now carries `checkedState` for checkbox/radio inputs from `desktop/src/preload/pane-preload.ts`, and toggle replay applies that source state directly.
- Regression found after commit `b3819c4`: checkbox/radio clicks were fully unsynced because the injected CDP expression still contained TypeScript-only syntax, `(element as HTMLAnchorElement).href`, which made every `resolveClickPoint()` evaluation throw `SyntaxError: Unexpected identifier 'as'` before replay could run.
- Fixed the injected expression to use plain browser JavaScript (`element.href`) and changed checkbox/radio capture to send `checkedState` after the default click state settles, rather than reading it during capture.
- Added unit coverage in `desktop/test/unit/pane-manager.test.ts` for echo during resolution, unresolved-target cleanup, handled replay without a later real-click suppression, and preserving source toggle state across mirrored checkbox clicks.
- Validation passed: `pnpm test:unit -- pane-manager element-fingerprint`, `pnpm run typecheck`, `pnpm run build`, `pnpm exec playwright test test/e2e/sync-trace-diag.spec.ts -g "checkbox/radio"`, and `pnpm exec playwright test test/e2e/interaction.spec.ts -g "checkboxes and radios|duplicate checkboxes"` from `desktop/`.
- Focused e2e note: sandboxed Playwright failed on `listen EPERM: operation not permitted 127.0.0.1:4173`; one escalated run reached the app and showed the previous `element.click()` path still did not converge target toggles. A second escalated diagnostic/focused run was blocked by the approval/usage limit, so final e2e confirmation remains pending.
- Follow-up verification passed from `desktop/`: `pnpm test:unit -- pane-manager element-mirror` and escalated `pnpm exec playwright test test/e2e/interaction.spec.ts -g "checkboxes and radios|duplicate checkboxes|Nth duplicate button"`. The focused checkbox/radio and duplicate toggle e2es now pass, so this issue is closed.
