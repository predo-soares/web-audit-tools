import { describe, expect, it, vi } from 'vitest'
import {
  SEO_RULE_CATALOG_VERSION,
  UNAVAILABLE_DELIVERED_EVIDENCE,
  inferIndexingIntent,
  isAuditableUrl,
  type Finding,
  type RenderedAuditSnapshot
} from '../../src/shared/seo-audit'
import { SEO_RULES, titlePresenceRule } from '../../src/main/seo/rules'
import { normalizeRenderedSnapshot } from '../../src/main/seo/rendered-extraction'
import { runAudit, type AuditPort } from '../../src/main/seo/audit-service'
import { unavailableIndexability } from '../../src/main/seo/indexability'
import type { PaneId } from '../../src/shared/types'

function makePort(overrides?: Partial<AuditPort>): AuditPort {
  return {
    getActivePaneId: (): PaneId | null => 'iphone',
    getActivePaneUrl: () => 'https://example.com/',
    getLastNavTimestamp: () => 1000,
    extractRendered: () => Promise.resolve({ title: 'Example' }),
    fetchDelivered: () => Promise.resolve(UNAVAILABLE_DELIVERED_EVIDENCE),
    getAccessContext: () => Promise.resolve({ authenticated: false }),
    fetchIndexability: (url) => Promise.resolve(unavailableIndexability(url)),
    ...overrides
  }
}

describe('isAuditableUrl', () => {
  it('rejects empty, whitespace, about:blank, and nullish', () => {
    expect(isAuditableUrl(null)).toBe(false)
    expect(isAuditableUrl(undefined)).toBe(false)
    expect(isAuditableUrl('')).toBe(false)
    expect(isAuditableUrl('   ')).toBe(false)
    expect(isAuditableUrl('about:blank')).toBe(false)
  })

  it('accepts a committed page URL', () => {
    expect(isAuditableUrl('https://example.com/')).toBe(true)
    expect(isAuditableUrl('http://localhost:3000')).toBe(true)
  })
})

describe('inferIndexingIntent', () => {
  it('defaults localhost/private hosts to local-private', () => {
    expect(inferIndexingIntent('http://localhost:3000')).toBe('local-private')
    expect(inferIndexingIntent('http://127.0.0.1:5173/x')).toBe('local-private')
    expect(inferIndexingIntent('http://my-app.local/')).toBe('local-private')
  })

  it('defaults public hosts to indexable', () => {
    expect(inferIndexingIntent('https://example.com/')).toBe('indexable')
  })
})

describe('normalizeRenderedSnapshot', () => {
  it('preserves a string title', () => {
    expect(normalizeRenderedSnapshot({ title: 'Hi' })).toMatchObject({ title: 'Hi' })
    expect(normalizeRenderedSnapshot({ title: '' })).toMatchObject({ title: '' })
  })

  it('coerces missing/garbage payloads to a null title', () => {
    expect(normalizeRenderedSnapshot(undefined)).toMatchObject({ title: null })
    expect(normalizeRenderedSnapshot(null)).toMatchObject({ title: null })
    expect(normalizeRenderedSnapshot({})).toMatchObject({ title: null })
    expect(normalizeRenderedSnapshot({ title: 42 })).toMatchObject({ title: null })
  })
})

describe('titlePresenceRule', () => {
  const evaluate = (title: string | null): Finding =>
    titlePresenceRule.evaluate({
      rendered: { title } as RenderedAuditSnapshot,
      delivered: UNAVAILABLE_DELIVERED_EVIDENCE,
      accessContext: { authenticated: false },
      indexingIntent: 'indexable'
    })

  it('reports an Error when no <title> element exists', () => {
    const finding = evaluate(null)
    expect(finding.outcome).toBe('error')
    expect(finding.summary).toBe('Page has no title')
    expect(finding.remediation).not.toBeNull()
    expect(finding.evidence.origin).toBe('rendered')
  })

  it('reports an Error for an empty title', () => {
    const finding = evaluate('')
    expect(finding.outcome).toBe('error')
    expect(finding.summary).toBe('Page title is empty')
  })

  it('reports an Error for a whitespace-only title and says so', () => {
    const finding = evaluate('   ')
    expect(finding.outcome).toBe('error')
    expect(finding.evidence.detail).toContain('whitespace')
  })

  it('passes for a usable title and echoes it in evidence with no remediation', () => {
    const finding = evaluate('  My Page  ')
    expect(finding.outcome).toBe('passed')
    expect(finding.summary).toBe('Page has a usable title')
    expect(finding.evidence.detail).toContain('My Page')
    expect(finding.remediation).toBeNull()
  })

  it('has a stable rule id and category', () => {
    expect(titlePresenceRule.id).toBe('search-appearance/title-present')
    expect(titlePresenceRule.category).toBe('search-appearance')
  })
})

describe('runAudit', () => {
  const deps = { nowMs: () => 5000, newId: () => 'audit-fixed' }

  it('returns no-url when there is no committed page', async () => {
    expect(
      await runAudit(
        makePort({ getActivePaneUrl: () => null }),
        { indexingIntent: 'indexable' },
        deps
      )
    ).toEqual({
      ok: false,
      reason: 'no-url'
    })
    expect(
      await runAudit(
        makePort({ getActivePaneUrl: () => 'about:blank' }),
        { indexingIntent: 'indexable' },
        deps
      )
    ).toEqual({ ok: false, reason: 'no-url' })
  })

  it('does not gather evidence when there is no URL', async () => {
    const extractRendered = vi.fn().mockResolvedValue({ title: 'x' })
    await runAudit(
      makePort({ getActivePaneUrl: () => null, extractRendered }),
      { indexingIntent: 'indexable' },
      deps
    )
    expect(extractRendered).not.toHaveBeenCalled()
  })

  it('produces a stable, versioned result bound to the active pane and navigation', async () => {
    const run = await runAudit(makePort(), { indexingIntent: 'indexable' }, deps)
    expect(run.ok).toBe(true)
    if (!run.ok) return
    expect(run.result).toMatchObject({
      id: 'audit-fixed',
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
    await runAudit(
      makePort({ getActivePaneId: () => 'ipad', extractRendered }),
      { indexingIntent: 'indexable' },
      deps
    )
    expect(extractRendered).toHaveBeenCalledWith('ipad')
  })

  it('falls back to the desktop pane when no pane is active', async () => {
    const extractRendered = vi.fn().mockResolvedValue({ title: 'Example' })
    const run = await runAudit(
      makePort({ getActivePaneId: () => null, extractRendered }),
      { indexingIntent: 'indexable' },
      deps
    )
    expect(run.ok && run.result.paneId).toBe('desktop')
    expect(extractRendered).toHaveBeenCalledWith('desktop')
  })

  it('carries the chosen indexing intent into the result', async () => {
    const run = await runAudit(makePort(), { indexingIntent: 'local-private' }, deps)
    expect(run.ok && run.result.indexingIntent).toBe('local-private')
  })

  it('surfaces a missing-title Error through the title rule', async () => {
    const run = await runAudit(
      makePort({ extractRendered: () => Promise.resolve({ title: null }) }),
      { indexingIntent: 'indexable' },
      deps
    )
    expect(run.ok).toBe(true)
    if (!run.ok) return
    const titleFinding = run.result.findings.find((f) => f.ruleId === titlePresenceRule.id)
    expect(titleFinding?.outcome).toBe('error')
  })
})
