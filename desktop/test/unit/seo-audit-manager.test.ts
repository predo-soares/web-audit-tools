import { describe, expect, it, vi } from 'vitest'
import { AuditManager } from '../../src/main/seo/audit-manager'
import type { AuditPort } from '../../src/main/seo/audit-service'
import {
  SEO_RULE_CATALOG_VERSION,
  UNAVAILABLE_DELIVERED_EVIDENCE,
  type AuditJobState,
  type RenderedAuditSnapshot
} from '../../src/shared/seo-audit'
import type { PaneId } from '../../src/shared/pane-types'
import { unavailableIndexability } from '../../src/main/seo/indexability'
import { unavailableSocialSharing } from '../../src/main/seo/social-sharing'
import { unavailableInternationalization } from '../../src/main/seo/internationalization'
import { SEO_RULES, titlePresenceRule } from '../../src/main/seo/rules'

/**
 * A controllable extraction: each call returns a promise the test resolves by
 * hand, so cancellation and navigation races can be driven deterministically.
 */
function deferredExtract(): {
  extract: (paneId: PaneId) => Promise<RenderedAuditSnapshot>
  resolveLatest: (snapshot?: RenderedAuditSnapshot) => void
  rejectLatest: (error?: unknown) => void
  calls: PaneId[]
} {
  const calls: PaneId[] = []
  let resolve!: (snapshot: RenderedAuditSnapshot) => void
  let reject!: (error: unknown) => void
  const extract = (paneId: PaneId): Promise<RenderedAuditSnapshot> => {
    calls.push(paneId)
    return new Promise<RenderedAuditSnapshot>((res, rej) => {
      resolve = res
      reject = rej
    })
  }
  return {
    extract,
    resolveLatest: (snapshot = { title: 'ok' }) => resolve(snapshot),
    rejectLatest: (error = new Error('engine boom')) => reject(error),
    calls
  }
}

function makePort(overrides?: Partial<AuditPort>): AuditPort {
  return {
    getActivePaneId: (): PaneId | null => 'iphone',
    getActivePaneUrl: () => 'https://example.com/',
    getLastNavTimestamp: () => 1000,
    extractRendered: () => Promise.resolve({ title: 'ok' }),
    fetchDelivered: () => Promise.resolve(UNAVAILABLE_DELIVERED_EVIDENCE),
    getAccessContext: () => Promise.resolve({ authenticated: false }),
    fetchIndexability: (url) => Promise.resolve(unavailableIndexability(url)),
    fetchSocial: () => Promise.resolve(unavailableSocialSharing()),
    fetchInternational: () => Promise.resolve(unavailableInternationalization()),
    ...overrides
  }
}

const deps = { nowMs: () => 5000, newId: () => 'audit-1' }

describe('AuditManager lifecycle', () => {
  it('starts idle', () => {
    const manager = new AuditManager(makePort(), deps)
    expect(manager.getState()).toMatchObject({ phase: 'idle', result: null })
  })

  it('broadcasts running then completed on a full run', async () => {
    const manager = new AuditManager(makePort(), deps)
    const states: AuditJobState[] = []
    manager.subscribe((s) => states.push(s))

    const run = await manager.run({ indexingIntent: 'indexable' })

    expect(run.ok).toBe(true)
    expect(states.map((s) => s.phase)).toEqual(['running', 'completed'])
    expect(manager.getState().result?.url).toBe('https://example.com/')
  })

  it('produces a stable, versioned result bound to the active pane and navigation', async () => {
    const manager = new AuditManager(makePort(), deps)
    const run = await manager.run({ indexingIntent: 'indexable' })

    expect(run.ok).toBe(true)
    if (!run.ok) return
    expect(run.result).toMatchObject({
      id: 'audit-1',
      paneId: 'iphone',
      url: 'https://example.com/',
      navigationTimestamp: 1000,
      startedAt: 5000,
      completedAt: 5000,
      ruleCatalogVersion: SEO_RULE_CATALOG_VERSION,
      indexingIntent: 'indexable'
    })
    expect(run.result.findings).toHaveLength(SEO_RULES.length)
  })

  it('extracts rendered evidence from the active pane', async () => {
    const extractRendered = vi.fn().mockResolvedValue({ title: 'Example' })
    const manager = new AuditManager(
      makePort({ getActivePaneId: () => 'ipad', extractRendered }),
      deps
    )

    await manager.run({ indexingIntent: 'indexable' })

    expect(extractRendered).toHaveBeenCalledWith('ipad')
  })

  it('falls back to the desktop pane when no pane is active', async () => {
    const extractRendered = vi.fn().mockResolvedValue({ title: 'Example' })
    const manager = new AuditManager(
      makePort({ getActivePaneId: () => null, extractRendered }),
      deps
    )

    const run = await manager.run({ indexingIntent: 'indexable' })

    expect(run.ok && run.result.paneId).toBe('desktop')
    expect(extractRendered).toHaveBeenCalledWith('desktop')
  })

  it('carries the chosen indexing intent into the result', async () => {
    const manager = new AuditManager(makePort(), deps)
    const run = await manager.run({ indexingIntent: 'local-private' })

    expect(run.ok && run.result.indexingIntent).toBe('local-private')
  })

  it('surfaces a missing-title Error through the title rule', async () => {
    const manager = new AuditManager(
      makePort({ extractRendered: () => Promise.resolve({ title: null }) }),
      deps
    )
    const run = await manager.run({ indexingIntent: 'indexable' })

    expect(run.ok).toBe(true)
    if (!run.ok) return
    const titleFinding = run.result.findings.find(
      (finding) => finding.ruleId === titlePresenceRule.id
    )
    expect(titleFinding?.outcome).toBe('error')
  })

  it('returns no-url without touching evidence when nothing is committed', async () => {
    const extractRendered = vi.fn()
    const manager = new AuditManager(
      makePort({ getActivePaneUrl: () => null, extractRendered }),
      deps
    )
    expect(await manager.run({ indexingIntent: 'indexable' })).toEqual({
      ok: false,
      reason: 'no-url'
    })
    expect(extractRendered).not.toHaveBeenCalled()
    expect(manager.getState().phase).toBe('idle')
  })

  it('rejects about:blank without touching evidence', async () => {
    const extractRendered = vi.fn()
    const manager = new AuditManager(
      makePort({ getActivePaneUrl: () => 'about:blank', extractRendered }),
      deps
    )

    expect(await manager.run({ indexingIntent: 'indexable' })).toEqual({
      ok: false,
      reason: 'no-url'
    })
    expect(extractRendered).not.toHaveBeenCalled()
  })

  it('rejects a second run while one is in flight (no queueing)', async () => {
    const d = deferredExtract()
    const manager = new AuditManager(makePort({ extractRendered: d.extract }), deps)

    const first = manager.run({ indexingIntent: 'indexable' })
    const second = await manager.run({ indexingIntent: 'indexable' })

    expect(second).toEqual({ ok: false, reason: 'busy' })
    expect(d.calls).toHaveLength(1)

    d.resolveLatest()
    expect(await first).toMatchObject({ ok: true })
  })

  it('cancels a running audit without fabricating a result', async () => {
    const d = deferredExtract()
    const manager = new AuditManager(makePort({ extractRendered: d.extract }), deps)

    const run = manager.run({ indexingIntent: 'indexable' })
    expect(manager.getState().phase).toBe('running')

    manager.cancel()
    expect(manager.getState()).toMatchObject({ phase: 'cancelled', result: null, running: null })

    // Even if the in-flight extraction later resolves, no result is published.
    d.resolveLatest()
    expect(await run).toEqual({ ok: false, reason: 'cancelled' })
    expect(manager.getState().phase).toBe('cancelled')
    expect(manager.getState().result).toBeNull()
  })

  it('cancel is a no-op when nothing is running', () => {
    const manager = new AuditManager(makePort(), deps)
    manager.cancel()
    expect(manager.getState().phase).toBe('idle')
  })

  it('navigation on the target pane cancels the in-flight audit before findings attribute to the new document', async () => {
    const d = deferredExtract()
    const manager = new AuditManager(makePort({ extractRendered: d.extract }), deps)

    const run = manager.run({ indexingIntent: 'indexable' })
    manager.handlePaneDocumentChange('iphone')
    expect(manager.getState().phase).toBe('cancelled')

    d.resolveLatest({ title: 'the new page' })
    expect(await run).toEqual({ ok: false, reason: 'cancelled' })
    expect(manager.getState().result).toBeNull()
  })

  it('ignores document changes on an unrelated pane', async () => {
    const d = deferredExtract()
    const manager = new AuditManager(makePort({ extractRendered: d.extract }), deps)

    const run = manager.run({ indexingIntent: 'indexable' })
    manager.handlePaneDocumentChange('desktop')
    expect(manager.getState().phase).toBe('running')

    d.resolveLatest()
    expect(await run).toMatchObject({ ok: true })
  })

  it('marks a completed result stale once its pane navigates, keeping it inspectable', async () => {
    const manager = new AuditManager(makePort(), deps)
    await manager.run({ indexingIntent: 'indexable' })
    expect(manager.getState()).toMatchObject({ phase: 'completed', stale: false })

    manager.handlePaneDocumentChange('iphone')
    const state = manager.getState()
    expect(state.stale).toBe(true)
    expect(state.result).not.toBeNull()
  })

  it('does not stale a result when a different pane navigates', async () => {
    const manager = new AuditManager(makePort(), deps)
    await manager.run({ indexingIntent: 'indexable' })
    manager.handlePaneDocumentChange('desktop')
    expect(manager.getState().stale).toBe(false)
  })

  it('fails without a fabricated result when the engine throws', async () => {
    const d = deferredExtract()
    const manager = new AuditManager(makePort({ extractRendered: d.extract }), deps)

    const run = manager.run({ indexingIntent: 'indexable' })
    d.rejectLatest()

    expect(await run).toEqual({ ok: false, reason: 'failed' })
    expect(manager.getState()).toMatchObject({ phase: 'failed', incomplete: true, result: null })
  })

  it('treats an engine failure after navigation as a cancellation, not a failure', async () => {
    const d = deferredExtract()
    const manager = new AuditManager(makePort({ extractRendered: d.extract }), deps)

    const run = manager.run({ indexingIntent: 'indexable' })
    manager.handlePaneDocumentChange('iphone')
    d.rejectLatest()

    expect(await run).toEqual({ ok: false, reason: 'cancelled' })
    expect(manager.getState().phase).toBe('cancelled')
  })
})
