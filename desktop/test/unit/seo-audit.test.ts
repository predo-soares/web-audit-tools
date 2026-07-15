import { describe, expect, it } from 'vitest'
import {
  UNAVAILABLE_DELIVERED_EVIDENCE,
  inferIndexingIntent,
  isAuditableUrl,
  type Finding,
  type RenderedAuditSnapshot
} from '../../src/shared/seo-audit'
import { titlePresenceRule } from '../../src/main/seo/rules'
import { normalizeRenderedSnapshot } from '../../src/main/seo/rendered-extraction'

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
