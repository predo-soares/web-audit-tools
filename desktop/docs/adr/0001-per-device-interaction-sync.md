# Per-device interaction sync (link membership)

Interaction sync was a single global boolean (`syncEnabled`): input on the active pane mirrored to all other panes, or to none. We replaced it with per-device **link membership** — `pane-manager` holds a `linkedPanes: Set<PaneId>` and a broadcast occurs only when both the source pane and the target pane are linked. An unlinked pane is fully detached: it neither sends nor receives mirrored input.

We chose this over the simpler global flag because auditing often needs one device driven independently (e.g. filling a form on Desktop) while the others stay linked, which the global toggle cannot express.

## Consequences

- The sync IPC contract changed from `sync:set-enabled(bool)` / `sync:get-enabled` to `sync:set-pane-linked(paneId, linked)` / `sync:get-linked-panes(): PaneId[]`. The old `set-sync-enabled` PanelAction was removed.
- The link toggle now lives per device (in the device-pane header) and only shows on the active pane, so link state for a non-active device is not glanceable without activating it. Accepted for now; a passive indicator (e.g. the pane status dot) could reflect it later if needed.
