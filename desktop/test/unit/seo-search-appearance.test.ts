import { describe, expect, it } from 'vitest'
import { resolveSearchAppearance } from '../../src/main/seo/search-appearance'
import {
  canonicalRule,
  descriptionPresenceRule,
  metadataDeclarationsRule,
  searchSnippetLengthRule
} from '../../src/main/seo/rules'
import type {
  DeliveredEvidence,
  RenderedAuditSnapshot,
  SearchAppearanceResult
} from '../../src/shared/seo-audit'
import { unavailableIndexability } from '../../src/main/seo/indexability'
import { unavailableSocialSharing } from '../../src/main/seo/social-sharing'

function delivered(overrides: Partial<DeliveredEvidence> = {}): DeliveredEvidence {
  return {
    available: true,
    unavailableReason: null,
    finalUrl: 'https://example.test/page',
    status: 200,
    redirects: [],
    headers: {},
    documentTitle: 'Delivered title',
    descriptions: ['Delivered description'],
    canonicals: ['/delivered'],
    favicons: ['/delivered.ico'],
    truncated: false,
    ...overrides
  }
}

function rendered(overrides: Partial<RenderedAuditSnapshot> = {}): RenderedAuditSnapshot {
  return {
    title: 'Rendered title',
    descriptions: ['Rendered description'],
    canonicals: ['/rendered'],
    favicons: ['/rendered.ico'],
    titleWidthPx: 210,
    descriptionWidthsPx: [420],
    ...overrides
  }
}

function context(searchAppearance: SearchAppearanceResult) {
  return {
    rendered: rendered(),
    delivered: delivered(),
    accessContext: { authenticated: false },
    indexingIntent: 'indexable' as const,
    searchAppearance,
    indexability: unavailableIndexability('https://example.test/page'),
    socialSharing: unavailableSocialSharing()
  }
}

describe('resolveSearchAppearance', () => {
  it('preserves every declaration and explicitly prefers the first rendered value', () => {
    const result = resolveSearchAppearance(
      {
        delivered: delivered({ descriptions: ['Delivered first', 'Delivered second'] }),
        rendered: rendered({ descriptions: ['Rendered first', 'Rendered second'] }),
        accessContext: { authenticated: false }
      },
      'https://example.test/page'
    )

    expect(result.declared.filter((item) => item.kind === 'description')).toEqual([
      expect.objectContaining({ origin: 'delivered', order: 0, value: 'Delivered first' }),
      expect.objectContaining({ origin: 'delivered', order: 1, value: 'Delivered second' }),
      expect.objectContaining({ origin: 'rendered', order: 0, value: 'Rendered first' }),
      expect.objectContaining({ origin: 'rendered', order: 1, value: 'Rendered second' })
    ])
    expect(result.resolved.description).toMatchObject({
      value: 'Rendered first',
      origin: 'rendered'
    })
    expect(result.resolved.description.reason).toContain('first non-empty rendered')
  })

  it('resolves relative canonical and favicon URLs against the audited page', () => {
    const result = resolveSearchAppearance(
      { delivered: delivered(), rendered: rendered(), accessContext: { authenticated: false } },
      'https://example.test/section/page'
    )
    expect(result.resolved.canonical.value).toBe('https://example.test/rendered')
    expect(result.resolved.favicon.value).toBe('https://example.test/rendered.ico')
  })

  it('retains browser width and character measurements for the selected values', () => {
    const result = resolveSearchAppearance(
      { delivered: delivered(), rendered: rendered(), accessContext: { authenticated: false } },
      'https://example.test/page'
    )
    expect(result.measurements).toEqual({
      titleCharacters: 'Rendered title'.length,
      titleWidthPx: 210,
      descriptionCharacters: 'Rendered description'.length,
      descriptionWidthPx: 420
    })
  })
})

describe('search appearance rules', () => {
  it('reports missing descriptions with a stable rule id and remediation', () => {
    const searchAppearance = resolveSearchAppearance(
      {
        delivered: delivered({ descriptions: [] }),
        rendered: rendered({ descriptions: [], descriptionWidthsPx: [] }),
        accessContext: { authenticated: false }
      },
      'https://example.test/page'
    )
    const finding = descriptionPresenceRule.evaluate(context(searchAppearance))
    expect(finding.ruleId).toBe('search-appearance/description-present')
    expect(finding.outcome).toBe('warning')
    expect(finding.remediation).not.toBeNull()
  })

  it('reports duplicate and delivered-vs-rendered declarations without collapsing them', () => {
    const searchAppearance = resolveSearchAppearance(
      {
        delivered: delivered({ descriptions: ['One', 'Two'] }),
        rendered: rendered({ descriptions: ['Three'] }),
        accessContext: { authenticated: false }
      },
      'https://example.test/page'
    )
    const finding = metadataDeclarationsRule.evaluate(context(searchAppearance))
    expect(finding.outcome).toBe('warning')
    expect(finding.evidence.detail).toContain('2 declarations conflict')
    expect(finding.evidence.detail).toContain('differs between delivered and rendered')
  })

  it('treats likely truncation as an Opportunity, never an Error', () => {
    const searchAppearance = resolveSearchAppearance(
      {
        delivered: delivered(),
        rendered: rendered({ titleWidthPx: 900, descriptionWidthsPx: [1200] }),
        accessContext: { authenticated: false }
      },
      'https://example.test/page'
    )
    const finding = searchSnippetLengthRule.evaluate(context(searchAppearance))
    expect(finding.outcome).toBe('opportunity')
    expect(finding.evidence.detail).toContain('900px')
    expect(finding.evidence.detail).toContain('1200px')
  })

  it('reports malformed canonical values as an Error', () => {
    const searchAppearance = resolveSearchAppearance(
      {
        delivered: delivered({ canonicals: [] }),
        rendered: rendered({ canonicals: ['://bad'] }),
        accessContext: { authenticated: false }
      },
      'not a url'
    )
    expect(canonicalRule.evaluate(context(searchAppearance)).outcome).toBe('error')
  })
})
