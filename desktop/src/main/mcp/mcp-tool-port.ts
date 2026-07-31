/**
 * The narrow capability surface the MCP tool layer depends on.
 *
 * The tool layer (`registerMcpTools`) depends only on this interface, never on
 * the concrete managers. It is *composed* in `index.ts` from the existing
 * managers and ports (`PaneManager`, `captureSnapshot`, …) — it exposes exactly
 * what the tools need and nothing more, mirroring the `SnapshotPort` /
 * `AuditPort` convention. No new pane-access mechanism is introduced here.
 *
 * Grows one method per issue as tools are added; keep it thin.
 */

/** Structured outcome of a capture-bundle request over MCP. */
export type CaptureBundleResult =
  { ok: true; pointer: string; warningCount: number } | { ok: false; reason: string }

export interface McpToolPort {
  /**
   * Load a URL across every device pane, routed through the same navigation the
   * URL bar uses (identical linked-device / active-pane semantics).
   */
  navigateAll(url: string): Promise<void>

  /**
   * Produce a capture bundle via the existing snapshot pipeline and return a
   * pointer to the written `context.md`. The bundle format is unchanged.
   */
  captureBundle(): Promise<CaptureBundleResult>
}
