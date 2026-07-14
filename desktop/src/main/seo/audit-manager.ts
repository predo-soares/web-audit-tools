import {
  IDLE_AUDIT_STATE,
  isAuditableUrl,
  type AuditJobState,
  type AuditRunResult,
  type IndexingIntent
} from '../../shared/seo-audit'
import type { PaneId } from '../../shared/types'
import {
  buildAuditResult,
  gatherReferencedEvidence,
  type AuditDeps,
  type AuditPort
} from './audit-service'

const defaultDeps: AuditDeps = {
  nowMs: () => Date.now(),
  newId: () => `audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Owns the single app-wide Page SEO audit job and its observable state.
 *
 * Invariants:
 * - At most one job runs at a time; a new run while one is active is rejected
 *   (`busy`) — jobs are never queued.
 * - A job is bound to the pane navigation that started it via a monotonic
 *   token. Any document change on that pane (reload/navigate/destroy) bumps the
 *   token, so an in-flight run can never attribute findings to a new document.
 * - Cancellation and navigation interruption never fabricate a completed
 *   result; a previously completed result stays inspectable but is marked stale.
 *
 * State lives here in the main process, not the panel renderer, so closing and
 * reopening the SEO panel neither cancels nor duplicates the running job.
 */
export class AuditManager {
  private state: AuditJobState = IDLE_AUDIT_STATE
  private token = 0
  private readonly listeners = new Set<(state: AuditJobState) => void>()

  constructor(
    private readonly port: AuditPort,
    private readonly deps: AuditDeps = defaultDeps
  ) {}

  getState(): AuditJobState {
    return this.state
  }

  subscribe(listener: (state: AuditJobState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async run(options: { indexingIntent: IndexingIntent }): Promise<AuditRunResult> {
    if (this.state.phase === 'running') {
      // Explicit cancel-and-replace only: never queue or silently supersede.
      return { ok: false, reason: 'busy' }
    }

    const url = this.port.getActivePaneUrl()
    if (!isAuditableUrl(url)) {
      return { ok: false, reason: 'no-url' }
    }

    const paneId = this.port.getActivePaneId() ?? 'desktop'
    const runToken = ++this.token
    const startedAt = this.deps.nowMs()

    this.setState({
      ...this.state,
      phase: 'running',
      running: { paneId, url, startedAt }
    })

    let rendered
    try {
      rendered = await this.port.extractRendered(paneId)
    } catch {
      if (runToken !== this.token) {
        // The pane changed under us; the interruption already set state.
        return { ok: false, reason: 'cancelled' }
      }
      // No trustworthy evidence was gathered, so no partial result is possible.
      this.setState({ ...this.state, phase: 'failed', running: null, incomplete: true })
      return { ok: false, reason: 'failed' }
    }

    if (runToken !== this.token) {
      return { ok: false, reason: 'cancelled' }
    }

    // Delivered evidence and access context never throw; a blocked or timed-out
    // fetch resolves to unavailable evidence handled by the rules.
    const [delivered, accessContext] = await gatherReferencedEvidence(this.port, url)

    if (runToken !== this.token) {
      // The pane navigated while delivered evidence was in flight.
      return { ok: false, reason: 'cancelled' }
    }

    const indexability = await this.port.fetchIndexability(url, rendered, delivered)

    if (runToken !== this.token) {
      // The pane navigated while bounded discovery controls were in flight.
      return { ok: false, reason: 'cancelled' }
    }

    const socialSharing = await this.port.fetchSocial(url, rendered, delivered)

    if (runToken !== this.token) {
      return { ok: false, reason: 'cancelled' }
    }
    const internationalization = await this.port.fetchInternational(url, rendered, delivered)
    if (runToken !== this.token) return { ok: false, reason: 'cancelled' }

    const result = buildAuditResult(this.deps, {
      paneId,
      url,
      navigationTimestamp: this.port.getLastNavTimestamp(paneId),
      startedAt,
      indexingIntent: options.indexingIntent,
      evidence: {
        rendered,
        delivered,
        accessContext,
        indexability,
        socialSharing,
        internationalization
      }
    })

    this.setState({
      phase: 'completed',
      running: null,
      result,
      stale: false,
      incomplete: false
    })
    return { ok: true, result }
  }

  /** Explicitly cancel a running audit. No-op when nothing is running. */
  cancel(): void {
    if (this.state.phase !== 'running') return
    this.token++
    this.setState({ ...this.state, phase: 'cancelled', running: null })
  }

  /**
   * A pane's document is changing (reload, navigation, or destruction). Cancel a
   * job bound to that pane before its findings can describe the new document,
   * and mark a completed result for that pane stale.
   */
  handlePaneDocumentChange(paneId: PaneId): void {
    let next = this.state
    if (next.running?.paneId === paneId) {
      this.token++
      next = { ...next, phase: 'cancelled', running: null }
    }
    if (next.result && next.result.paneId === paneId && !next.stale) {
      next = { ...next, stale: true }
    }
    if (next !== this.state) this.setState(next)
  }

  private setState(state: AuditJobState): void {
    this.state = state
    for (const listener of this.listeners) listener(state)
  }
}
