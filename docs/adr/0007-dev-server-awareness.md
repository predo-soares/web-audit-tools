# Dev-server awareness: git metadata in the capture bundle

When a pane navigates to a localhost URL (`localhost` or `127.0.0.1`), the app resolves git metadata (`repoPath`, `branch`, `commit`) by walking up from `process.cwd()` to the nearest `.git` directory. This happens at navigation time, is cached per-pane in the main process, and surfaces as an app-level block in the capture bundle (present only when ≥1 pane is localhost). Partial resolution is intentional — `branch` is `null` on detached HEAD, `commit` is `null` on an empty repo — because `repoPath` alone is already high-value agent context.

## Considered options

- **User-configured repo path** — accurate but requires manual setup; rejected in favour of zero-config.
- **Per-pane bundle metadata** — redundant when all localhost panes share one repo; rejected in favour of a single app-level block.
- **Resolve at bundle-creation time** — adds latency to a user-initiated action and can't feed the sidebar badge; rejected in favour of navigation-time resolution.
