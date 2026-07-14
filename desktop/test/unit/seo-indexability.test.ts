import { describe, expect, it } from 'vitest'
import { parseRobotsTxt, verifyIndexability } from '../../src/main/seo/indexability'
import {
  indexabilityCanonicalTargetRule,
  indexabilityDirectivesRule,
  indexabilityRobotsTxtRule,
  indexabilitySitemapsRule,
  indexabilityStatusRule
} from '../../src/main/seo/rules'
import { resolveSearchAppearance } from '../../src/main/seo/search-appearance'
import type { DeliveredEvidence, RenderedAuditSnapshot } from '../../src/shared/seo-audit'
import type { FetchTransport, RawResponse } from '../../src/main/seo/referenced-fetch'
import { unavailableSocialSharing } from '../../src/main/seo/social-sharing'

function response(status: number, body = '', location: string | null = null): RawResponse {
  return {
    status,
    headers: [],
    location,
    readBody: () => Promise.resolve({ text: body, truncated: false })
  }
}

function delivered(overrides: Partial<DeliveredEvidence> = {}): DeliveredEvidence {
  return {
    available: true,
    unavailableReason: null,
    finalUrl: 'https://site.test/page',
    status: 200,
    redirects: [],
    headers: {},
    documentTitle: 'Page',
    descriptions: [],
    canonicals: ['/canonical'],
    favicons: [],
    robots: [],
    sitemapLinks: [],
    truncated: false,
    ...overrides
  }
}

function rendered(overrides: Partial<RenderedAuditSnapshot> = {}): RenderedAuditSnapshot {
  return {
    title: 'Page',
    descriptions: [],
    canonicals: ['/canonical'],
    favicons: [],
    robots: [],
    sitemapLinks: [],
    ...overrides
  }
}

describe('parseRobotsTxt', () => {
  it('uses the most specific matching user-agent and longest path rule', () => {
    const parsed = parseRobotsTxt(
      `User-agent: *\nDisallow: /private\nUser-agent: Chrome\nDisallow: /private\nAllow: /private/public\nSitemap: https://site.test/sitemap.xml`,
      'Mozilla Chrome/140',
      '/private/public/page'
    )
    expect(parsed).toMatchObject({ matchedUserAgent: 'chrome', allowed: true })
    expect(parsed.declaredSitemaps).toEqual(['https://site.test/sitemap.xml'])
  })

  it('marks equally specific contradictory rules ambiguous and lets Allow win ties', () => {
    const parsed = parseRobotsTxt('User-agent: *\nDisallow: /x\nAllow: /x', 'AnyBrowser', '/x/page')
    expect(parsed).toMatchObject({ allowed: true, ambiguous: true })
  })
})

describe('verifyIndexability', () => {
  it('fetches only canonical, robots.txt, and declared sitemaps without expanding them', async () => {
    const calls: string[] = []
    const transport: FetchTransport = async (url) => {
      calls.push(url)
      if (url.endsWith('/robots.txt')) {
        return response(200, 'User-agent: *\nAllow: /\nSitemap: https://site.test/from-robots.xml')
      }
      return response(200, '<urlset><url><loc>https://site.test/ordinary</loc></url></urlset>')
    }
    const result = await verifyIndexability(
      'https://site.test/page',
      rendered({ sitemapLinks: ['/from-html.xml'] }),
      delivered(),
      transport,
      {},
      'Chrome'
    )
    expect(calls).toEqual([
      'https://site.test/canonical',
      'https://site.test/robots.txt',
      'https://site.test/from-html.xml',
      'https://site.test/from-robots.xml'
    ])
    expect(calls).not.toContain('https://site.test/ordinary')
    expect(result.robotsTxt.allowed).toBe(true)
    expect(result.sitemaps).toHaveLength(2)
  })

  it('reports bounded target failures as unavailable evidence', async () => {
    const transport: FetchTransport = async (url) => {
      if (url.endsWith('/robots.txt')) throw new Error('blocked')
      return response(404)
    }
    const result = await verifyIndexability(
      'https://site.test/page',
      rendered({ sitemapLinks: ['/map.xml'] }),
      delivered(),
      transport
    )
    expect(result.robotsTxt).toMatchObject({ available: false, allowed: null })
    expect(result.canonical).toMatchObject({ available: true, status: 404 })
    expect(result.sitemaps[0]).toMatchObject({ available: true, status: 404 })
  })
})

describe('indexability rules', () => {
  async function context(
    options: {
      intent?: 'indexable' | 'non-indexable' | 'local-private'
      metaRobots?: string[]
      headerRobots?: string
      robotsBody?: string
      canonicalStatus?: number
      sitemapStatus?: number
      authenticated?: boolean
    } = {}
  ) {
    const d = delivered({
      headers: options.headerRobots ? { 'x-robots-tag': options.headerRobots } : {},
      robots: options.metaRobots ?? [],
      sitemapLinks: ['/sitemap.xml']
    })
    const r = rendered({ robots: options.metaRobots ?? [], sitemapLinks: ['/sitemap.xml'] })
    const transport: FetchTransport = async (url) => {
      if (url.endsWith('/robots.txt'))
        return response(200, options.robotsBody ?? 'User-agent: *\nAllow: /')
      if (url.endsWith('/canonical')) return response(options.canonicalStatus ?? 200)
      return response(options.sitemapStatus ?? 200)
    }
    const indexability = await verifyIndexability('https://site.test/page', r, d, transport)
    const searchAppearance = resolveSearchAppearance(
      {
        rendered: r,
        delivered: d,
        accessContext: { authenticated: options.authenticated ?? false }
      },
      'https://site.test/page'
    )
    return {
      rendered: r,
      delivered: d,
      accessContext: { authenticated: options.authenticated ?? false },
      indexingIntent: options.intent ?? ('indexable' as const),
      searchAppearance,
      indexability,
      socialSharing: unavailableSocialSharing()
    }
  }

  it('treats noindex according to declared intent and flags contradictions', async () => {
    expect(
      indexabilityDirectivesRule.evaluate(await context({ metaRobots: ['noindex'] })).outcome
    ).toBe('error')
    expect(
      indexabilityDirectivesRule.evaluate(
        await context({ intent: 'non-indexable', metaRobots: ['noindex'] })
      ).outcome
    ).toBe('passed')
    expect(
      indexabilityDirectivesRule.evaluate(await context({ intent: 'local-private' })).outcome
    ).toBe('opportunity')
    expect(
      indexabilityDirectivesRule.evaluate(
        await context({ metaRobots: ['noindex'], headerRobots: 'index' })
      ).summary
    ).toBe('Robots directives conflict')
  })

  it('evaluates status, canonical, robots access, and sitemap reachability', async () => {
    const ctx = await context({
      canonicalStatus: 404,
      robotsBody: 'User-agent: *\nDisallow: /page',
      sitemapStatus: 404
    })
    expect(indexabilityStatusRule.evaluate(ctx).outcome).toBe('passed')
    expect(indexabilityCanonicalTargetRule.evaluate(ctx).outcome).toBe('error')
    expect(indexabilityRobotsTxtRule.evaluate(ctx).outcome).toBe('error')
    expect(indexabilitySitemapsRule.evaluate(ctx).outcome).toBe('warning')
  })

  it('qualifies authenticated robots conclusions', async () => {
    const finding = indexabilityRobotsTxtRule.evaluate(await context({ authenticated: true }))
    expect(finding.impact).toContain('does not prove public crawler access')
  })
})
