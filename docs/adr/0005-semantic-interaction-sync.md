# 0005 — Semantic interaction sync (strict, no coordinate fallback)

Date: 2026-07-08
Status: accepted (amended 2026-07-16 — see "Amendment: clickable ancestor")

## Context

Click mirroring across device panes was coordinate-mapped: the source preload reported normalized `clientX/clientY` ratios and every target pane injected a native click at the same *relative position*. On responsive sites the same position holds different elements per breakpoint, so mirrored clicks routinely hit the wrong thing — the opposite of what an audit tool should do.

The hard problem is element identity across independently rendered DOMs: at different breakpoints the "same" control can move, restructure, or not exist at all (mobile hamburger vs desktop inline nav).

## Decision

Replace coordinate mapping with **semantic interaction sync**:

1. **Element fingerprint, layered by stability.** The source pane fingerprints the clicked element's *interactive ancestor* (nearest self-or-ancestor `a`/`button`/form control/interactive ARIA role/tabbable — clicking an icon inside a button means the button): id → test id (`data-testid`/`name`) → accessible name + role/tag → visible text + tag → structural path as last-resort tiebreaker. Targets resolve layers in order and require a unique hit; identical candidates (e.g. 20 "Add to cart" buttons) are disambiguated by index-among-matches.
2. **Strict — no fallback.** If a target pane has no confident match (not found, ambiguous, or occluded), that pane does nothing. A missing match is honest: the element may genuinely not exist at that breakpoint. No coordinate fallback ever — it would reintroduce exactly the garbage clicks this replaces.
3. **Trusted native input at the resolved element's center.** Targets resolve the fingerprint, `scrollIntoView({block:'center', behavior:'instant'})` under the existing `__suppressScrollReport` flag if needed, hit-test the center with `elementFromPoint` (occluded → no-op), then inject `sendInputEvent` mouseDown/mouseUp. This preserves the full trusted event sequence, the mouse→touch conversion on touch panes, and the existing synthetic-click echo suppression. Not `element.click()`: `isTrusted: false`, no pointer/focus sequence, bypasses touch emulation.
4. **Inputs are value-synced, not keystroke-mirrored.** Text entry mirrors resulting field state (`input`/`change` → native value setter + dispatched events, debounced), so panes converge even when per-keystroke behavior diverges (IME, masks, paste, autofill). Checkboxes/radios are excluded — their mirrored trusted click already toggles them. `<select>` mirrors the chosen option. Form `submit` is mirrored via `requestSubmit()` so type-then-Enter flows don't desync.

## Scope (v1 explicit no-s)

Hover (incoherent across touch/non-touch panes), drag/swipe, keyboard navigation, context menus, file inputs (unsettable for security reasons), and iframes (preload is top-frame only) are all out. The strict no-op rule makes unsupported interactions degrade gracefully.

Match failures are recorded in a structured debug log (fingerprint, pane, reason: not-found / ambiguous / occluded) — no UI in v1. A per-pane indicator would require the native-popover overlay machinery (ADR 0003); the log is also raw material for future agent-facing audit findings. Interaction sync stays under the single existing sync toggle.

## Amendment: clickable ancestor (2026-07-16)

The original "interactive ancestor" was limited to semantic elements (`a`/`button`/form control/interactive ARIA role/tabbable). This silently dropped a whole class of real interactions: clicking a modal's **backdrop** to dismiss it, or a "clickable card" / custom control built from a plain `<div>`. The clicked element had no interactive ancestor, so it produced no fingerprint and mirrored nothing — the panes visibly disagreed (modal open in one, closed in another).

The definition is widened from "interactive ancestor" to **clickable ancestor**: in addition to the semantic set, an element counts as clickable when it carries an inline `onclick`, a dialog/backdrop affordance (`[role="dialog"]`, `[aria-modal="true"]`), or a computed `cursor: pointer`. Because `cursor` inherits, only the element that *originates* the pointer cursor (its parent is not also `pointer`) is treated as clickable — otherwise every descendant of a button would become its own candidate. The clickable predicate is one shared definition in the element mirror (`isClickable` / `findClickableAncestor` / `collectClickableCandidates`), used identically by capture and resolution so index-among-matches stays aligned.

Everything else is unchanged: the same stability-layered fingerprint identifies the element (backdrops usually resolve via the structural-path tiebreaker), and resolution stays **strict** — no unique match is still an honest no-op, never a coordinate fallback. The one mechanism difference is dispatch: a widened, non-semantic clickable (a `<div>`) is activated with a suppressed synthetic `element.click()` rather than trusted native input at its center. Its center is typically occluded (a modal covers its backdrop's midpoint) so coordinate dispatch + hit-test would reject it, and a trusted event sequence buys nothing for a div with a JS handler. Trusted native input is retained for genuine semantic controls, where focus/pointer/touch semantics matter.

Detecting handlers attached via `addEventListener` on an element with no `onclick` attribute, no pointer cursor, and no dialog affordance remains out of scope — undetectable from the DOM, so those stay honest no-ops.

## Alternatives considered

- **Keep coordinate mapping** — wrong element on any layout divergence; rejected as the motivating problem.
- **Semantic with coordinate fallback on no-match** — silently reintroduces wrong-element clicks precisely in the cases where matching fails; strict no-op is more honest for an audit tool.
- **Structural CSS path as primary identity** — brittle across breakpoints and fails *silently onto the wrong element*; demoted to last-resort tiebreaker.
- **Accessibility-tree matching via CDP** — heaviest option; the AX name is essentially what the accessible-name fingerprint layer already provides.
- **Keystroke mirroring for inputs** — trusted but divergent: one rejected character desyncs panes permanently; breaks under IME/masks/paste.
