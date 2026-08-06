import { describe, expect, it } from 'vitest'
import { resolveSocialSharing } from '../../src/main/seo/social-sharing'
import {
  socialDeclarationsRule,
  socialImagesRule,
  socialMetadataRule
} from '../../src/main/seo/rules'
import { unavailableIndexability } from '../../src/main/seo/indexability'
import { resolveSearchAppearance } from '../../src/main/seo/search-appearance'
import type { DeliveredEvidence, RenderedAuditSnapshot } from '../../src/shared/seo-audit'
import type { FetchTransport, RawResponse } from '../../src/main/seo/referenced-fetch'

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function response(
  status: number,
  bytes = png(1200, 630),
  options: { type?: string; location?: string } = {}
): RawResponse {
  return {
    status,
    headers: [['content-type', options.type ?? 'image/png']],
    location: options.location ?? null,
    readBody: () => Promise.resolve({ text: '', truncated: false }),
    readBytes: () => Promise.resolve({ bytes, truncated: false })
  }
}

function delivered(social: { property: string; value: string }[]): DeliveredEvidence {
  return {
    available: true,
    unavailableReason: null,
    finalUrl: 'https://site.test/page',
    status: 200,
    redirects: [],
    headers: {},
    documentTitle: 'Page title',
    descriptions: ['Page description'],
    canonicals: [],
    favicons: [],
    robots: [],
    sitemapLinks: [],
    social,
    truncated: false
  }
}

function rendered(social: { property: string; value: string }[]): RenderedAuditSnapshot {
  return {
    title: 'Page title',
    descriptions: ['Page description'],
    canonicals: [],
    favicons: [],
    social
  }
}

describe('resolveSocialSharing', () => {
  it('preserves duplicates and explains X fallbacks through Open Graph', async () => {
    const d = delivered([
      { property: 'og:title', value: 'Delivered OG' },
      { property: 'og:image', value: '/first.png' },
      { property: 'og:image', value: '/second.png' }
    ])
    const r = rendered([
      { property: 'og:title', value: 'Rendered OG' },
      { property: 'og:description', value: 'Rendered description' },
      { property: 'og:image', value: '/first.png' }
    ])
    const transport: FetchTransport = async () => response(200)
    const result = await resolveSocialSharing('https://site.test/page', r, d, transport)
    expect(result.declared.filter((item) => item.property === 'og:image')).toHaveLength(3)
    expect(result.resolved.openGraph.title.value).toBe('Rendered OG')
    expect(result.resolved.x.title.value).toBe('Rendered OG')
    expect(result.resolved.x.title.reason).toContain('fell back to og:title')
    expect(result.images.map((item) => item.url)).toEqual([
      'https://site.test/first.png',
      'https://site.test/second.png'
    ])
  })

  it('records redirects, dimensions, type, byte size, and hash without retaining bytes', async () => {
    const d = delivered([{ property: 'og:image', value: '/redirect.png' }])
    const calls: string[] = []
    const transport: FetchTransport = async (url) => {
      calls.push(url)
      return url.endsWith('/redirect.png')
        ? response(302, new Uint8Array(), { location: '/final.png' })
        : response(200, png(1200, 630))
    }
    const result = await resolveSocialSharing('https://site.test/page', rendered([]), d, transport)
    expect(calls).toEqual(['https://site.test/redirect.png', 'https://site.test/final.png'])
    expect(result.images[0]).toMatchObject({ status: 200, width: 1200, height: 630, byteSize: 24 })
    expect(result.images[0].sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(result.images[0]).not.toHaveProperty('bytes')
  })
})

describe('social sharing rules', () => {
  async function context(
    social: { property: string; value: string }[],
    transport: FetchTransport = async () => response(200)
  ): Promise<{
    rendered: RenderedAuditSnapshot
    delivered: DeliveredEvidence
    accessContext: { authenticated: false }
    indexingIntent: 'indexable'
    searchAppearance: ReturnType<typeof resolveSearchAppearance>
    indexability: ReturnType<typeof unavailableIndexability>
    socialSharing: ReturnType<typeof resolveSocialSharing>
  }> {
    const d = delivered(social)
    const r = rendered(social)
    const socialSharing = await resolveSocialSharing('https://site.test/page', r, d, transport)
    return {
      rendered: r,
      delivered: d,
      accessContext: { authenticated: false },
      indexingIntent: 'indexable' as const,
      searchAppearance: resolveSearchAppearance(
        { rendered: r, delivered: d, accessContext: { authenticated: false } },
        'https://site.test/page'
      ),
      indexability: unavailableIndexability('https://site.test/page'),
      socialSharing
    }
  }

  it('reports complete metadata and a usable inspected image', async () => {
    const ctx = await context([
      { property: 'og:title', value: 'Title' },
      { property: 'og:description', value: 'Description' },
      { property: 'og:image', value: '/card.png' }
    ])
    expect(socialMetadataRule.evaluate(ctx).outcome).toBe('passed')
    expect(socialImagesRule.evaluate(ctx).outcome).toBe('passed')
  })

  it('warns for conflicting declarations and unsupported or inaccessible images', async () => {
    const ctx = await context(
      [
        { property: 'og:title', value: 'One' },
        { property: 'og:title', value: 'Two' },
        { property: 'og:image', value: '/card.txt' }
      ],
      async () => response(404, new TextEncoder().encode('not image'), { type: 'text/plain' })
    )
    expect(socialDeclarationsRule.evaluate(ctx).outcome).toBe('warning')
    expect(socialImagesRule.evaluate(ctx).outcome).toBe('warning')
  })
})
