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

import type { PaneId } from '../../shared/types'
import type { DevContext } from '../../shared/dev-context'
import type { RuntimeEvidenceSnapshot } from '../../shared/runtime-evidence'
import type { AuditJobState, AuditRunResult, IndexingIntent } from '../../shared/seo-audit'

/** Structured outcome of a capture-bundle request over MCP. */
export type CaptureBundleResult =
  { ok: true; pointer: string; warningCount: number } | { ok: false; reason: string }

/** A device pane's preset metadata plus its current visibility/active state. */
export interface DeviceInfo {
  id: PaneId
  name: string
  width: number
  height: number
  deviceScaleFactor: number
  touch: boolean
  /** Whether the pane is currently shown on the canvas (not hidden by a solo focus). */
  visible: boolean
  /** Whether this is the active pane the toolbar / observed-context reads reflect. */
  active: boolean
}

/** Outcome of a device-visibility change over MCP. */
export type SetVisibleDevicesResult = { ok: true } | { ok: false; reason: 'unsupported-subset' }

/** Outcome of a pane screenshot request over MCP. */
export type PaneScreenshotResult = { ok: true; png: Buffer } | { ok: false; reason: 'no-url' }

/** The active pane's observed context: runtime evidence + metadata + dev context. */
export interface ObservedContext {
  device: { id: PaneId; name: string }
  url: string | null
  title: string
  lastNavTimestamp: number | null
  /** Same runtime-evidence snapshot the diagnostics drawer reads. */
  evidence: RuntimeEvidenceSnapshot
  /** Present only when at least one pane is on a localhost URL; otherwise null. */
  devContext: DevContext | null
}

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

  /** The available device presets with current visibility and which is active. */
  listDevices(): DeviceInfo[]

  /**
   * Make the active pane the given device — the pane subsequent observed-context
   * and screenshot reads reflect.
   */
  setActivePane(device: PaneId): void

  /**
   * Set which device panes are visible on the canvas. The main-process primitive
   * supports showing every pane or soloing a single one, so a partial subset
   * (more than one but not all) is reported as `unsupported-subset`.
   */
  setVisibleDevices(devices: PaneId[]): SetVisibleDevicesResult

  /**
   * Capture the active pane (`device === null`) or a named device as a PNG,
   * reusing the existing screenshot capture. Returns `no-url` when the target
   * pane has no committed URL.
   */
  screenshot(device: PaneId | null): Promise<PaneScreenshotResult>

  /** The active pane's current observed context (runtime evidence + metadata + dev context). */
  getObservedContext(): ObservedContext

  /** Reload every pane so a change can be verified without human intervention. */
  reload(): Promise<void>

  /** Run a Page SEO audit on the active pane, awaiting completion. */
  runAudit(indexingIntent: IndexingIntent): Promise<AuditRunResult>

  /** The most recent Page SEO audit job state (result, staleness, phase). */
  getAudit(): AuditJobState
}
