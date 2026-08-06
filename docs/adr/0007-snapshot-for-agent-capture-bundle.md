# 0007 — Snapshot for Agent: capture bundle design

Date: 2026-07-09
Status: accepted

## Context

The product direction (decided 2026-07-07) is an Agentic Workbench — a seamless handoff from human observation into a coding agent's working context. The first concrete feature is a one-action snapshot that packages the observed state of the active pane into an agent-readable capture bundle on disk.

Key constraints driving the design:

- Must work with any agent immediately, without MCP setup. Disk files are the universal substrate.
- The main value is eliminating manual copying from DevTools: console errors, network failures, and a screenshot in one action.
- The bundle format is an agent contract — changing it later breaks existing clipboard paths saved by users.

## Decisions

### 1. Active pane only (v1)

The capture bundle snapshots the **active pane only**, not all visible panes. The obvious choice would be all three panes (the multi-device diff is the app's core feature), but capturing all panes introduces complexity around partial failures and bloated context documents before the format is validated with real agents. All-pane capture is deferred to a later stage.

### 2. SnapshotService as a standalone module

Snapshot logic lives in a dedicated `SnapshotService`, not in `PaneManager`. `PaneManager` owns pane lifecycle and sync; mixing in disk I/O and clipboard access would conflate too many responsibilities. `SnapshotService` takes `PaneManager` as a dependency and reads from it.

### 3. Dedicated `ipcMain.handle('snapshot:take')`

The snapshot is not routed through the existing `panel:action` fire-and-forget mechanism. It needs a typed return value so the toolbar panel can drive the toast from the result. The handler is a dedicated `ipcMain.handle`.

Return type:
```ts
type SnapshotResult =
  | { ok: true; warningCount: number }
  | { ok: false; reason: string }
```

`warningCount > 0` means one or more pane captures had issues (e.g. still loading at timeout). `ok: false` means a fundamental failure (disk write error, no URL loaded).

### 4. Soft wait: poll, don't sleep

The 2-second loading timeout polls `isAnyPaneLoading()` at ~100ms intervals and proceeds as soon as all panes are settled. A flat 2-second sleep would add unnecessary latency on already-loaded pages.

### 5. Bundle format

**Directory:** `~/.audit-screens/captures/<ISO-timestamp>/`  
Timestamp uses `-` as separator (colons are invalid in macOS filenames), e.g. `2026-07-09T04-43-00-000Z`.

**Entrypoint:** `context.md` — markdown, agent-readable, no app knowledge required.

**Screenshot filename:** device preset slug (e.g. `iphone-16-pro.png`), no timestamp. The directory already carries the timestamp. Referenced by relative path in `context.md`.

**`context.md` structure:**
```md
# Audit Web Tools Capture
Captured: <ISO timestamp>

## Project Context
Local project: <repo name> (<path>)
Branch: <branch> | Commit: <short sha> | Dirty: <yes/no>

## Active Pane: <Device Preset Name> (<viewport> @<dpr>x, touch/no touch)
URL: <url>
Title: <page title>
Last navigation: <ISO timestamp>
Screenshot: ./<slug>.png

### Console problems (<n>)
[<LEVEL>] <message>
    at <source>:<line>

### Network failures (<n>)
<METHOD> <path> → <status> <text>
```

### 6. Evidence filtering and caps

- **Console:** `isConsoleProblem` levels only (`error`, `warn`, `exception`, `rejection`). Capped at the latest 100 problem entries. Filtering and capping happen in the bundle writer, not in the buffer.
- **Network:** `isNetworkProblem` entries only (HTTP ≥ 400 or load failure). No additional cap — all failures up to the 150 ring-buffer limit are included.

### 7. Local project context

Appended when `isLocalhostUrl(activeUrl)` is true. Resolved from `process.cwd()` via `resolveDevContext`. Includes: repo path, branch, short commit SHA, dirty state (`git status --porcelain`). All three git calls run in parallel. Defaults to `Local project: not detected` if unavailable.

`isLocalhostUrl` must cover: `localhost`, `127.0.0.1`, `[::1]`, and hostnames ending in `.local` (current implementation is missing the last two — tracked as a bug fix).

### 8. Clipboard handoff

On success, copies to clipboard:
```
Read this Audit Web Tools capture and use it to diagnose the issue I am seeing:
~/.audit-screens/captures/<timestamp>/context.md
```

### 9. Toast in toolbar panel

The snapshot button lives in the toolbar panel. The panel `await`s `invoke('snapshot:take')` and renders the toast inline based on the result. No cross-WebContents messaging required.

Toast text:
- `warningCount === 0`: "Snapshot copied for agent"
- `warningCount > 0`: "Snapshot copied with N pane warning(s)"
- `ok: false, reason: 'no-url'`: "Nothing to capture"
- `ok: false` (other): "Snapshot failed"

### 10. Global hotkey

`⌘⇧S` — mnemonic for Snapshot, not already used by the app.

### 11. No-URL guard

If the active pane has no committed URL (`about:blank`), `snapshot:take` returns `{ ok: false, reason: 'no-url' }` immediately. No bundle is written, clipboard is unchanged.

## Consequences

- The bundle format is now a contract. Field names and structure in `context.md` should not change without a migration path.
- `DevContext` gains a `dirty: boolean` field; `resolveDevContext` runs three git subprocess calls in parallel.
- Evidence auto-clear on top-level navigation (PRD requirement) must be wired into `handleNavigation` in `PaneManager` — currently missing.
- All-pane snapshots (the natural v2) are a straightforward extension: iterate panes instead of reading active pane only.
