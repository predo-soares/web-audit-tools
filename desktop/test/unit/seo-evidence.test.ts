import { describe, expect, it } from 'vitest'
import { sanitizeResponseHeaders, sanitizeUrl, REDACTED } from '../../src/shared/seo-sanitize'
import {
  extractDeliveredTitle,
  extractDeliveredSearchMetadata,
  fetchWithBudget,
  type FetchTransport,
  type RawResponse
} from '../../src/main/seo/referenced-fetch'
import { captureDeliveredEvidence } from '../../src/main/seo/delivered-evidence'
import { titleHydrationRule } from '../../src/main/seo/rules'
import {
  UNAVAILABLE_DELIVERED_EVIDENCE,
  type DeliveredEvidence,
  type Finding,
  type RenderedAuditSnapshot
} from '../../src/shared/seo-audit'

const NO_BODY = (): Promise<{ text: string; truncated: boolean }> =>
  Promise.resolve({ text: '', truncated: false })

function response(overrides: Partial<RawResponse> & { status: number }): RawResponse {
  return {
    headers: [],
    location: null,
    readBody: NO_BODY,
    ...overrides
  }
}

/** A transport driven by a scripted map of url -> response. */
function scriptedTransport(script: Record<string, RawResponse>): FetchTransport {
  return (url) => {
    const res = script[url]
    if (!res) return Promise.reject(new Error(`no scripted response for ${url}`))
    return Promise.resolve(res)
  }
}

describe('sanitizeUrl', () => {
  it('redacts sensitive query values but keeps benign ones', () => {
    const out = sanitizeUrl('https://x.test/p?token=abc123&page=2&api_key=zzz&q=hello')
    const url = new URL(out)
    expect(url.searchParams.get('token')).toBe(REDACTED)
    expect(url.searchParams.get('api_key')).toBe(REDACTED)
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('q')).toBe('hello')
  })

  it('leaves URLs without sensitive params unchanged', () => {
    expect(sanitizeUrl('https://x.test/a?page=1')).toBe('https://x.test/a?page=1')
  })

  it('returns non-URL strings unchanged', () => {
    expect(sanitizeUrl('not a url')).toBe('not a url')
  })
})

describe('sanitizeResponseHeaders', () => {
  it('drops credential-bearing headers and lower-cases names', () => {
    const headers = sanitizeResponseHeaders([
      ['Content-Type', 'text/html'],
      ['Set-Cookie', 'session=secret'],
      ['Authorization', 'Bearer xyz'],
      ['X-Robots-Tag', 'noindex']
    ])
    expect(headers).toEqual({ 'content-type': 'text/html', 'x-robots-tag': 'noindex' })
    expect(headers['set-cookie']).toBeUndefined()
    expect(headers['authorization']).toBeUndefined()
  })
})

describe('extractDeliveredTitle', () => {
  it('reads the title element from raw HTML', () => {
    expect(extractDeliveredTitle('<html><head><title>Hi &amp; Bye</title></head></html>')).toBe(
      'Hi & Bye'
    )
  })

  it('returns null when there is no title', () => {
    expect(extractDeliveredTitle('<html><body>no head</body></html>')).toBeNull()
  })
})

describe('extractDeliveredSearchMetadata', () => {
  it('preserves duplicate descriptions, canonicals, and favicons in document order', () => {
    const metadata = extractDeliveredSearchMetadata(`
      <meta name="description" content="First &amp; best">
      <meta content='Second' NAME='DESCRIPTION'>
      <link rel="canonical" href="/one">
      <link href="/two" rel="canonical alternate">
      <link rel="shortcut icon" href="/favicon.ico">
    `)
    expect(metadata).toEqual({
      descriptions: ['First & best', 'Second'],
      canonicals: ['/one', '/two'],
      favicons: ['/favicon.ico'],
      robots: [],
      sitemapLinks: []
    })
  })
})

describe('fetchWithBudget', () => {
  it('follows redirects within budget and records the chain', async () => {
    const transport = scriptedTransport({
      'https://x.test/a': response({ status: 301, location: 'https://x.test/b' }),
      'https://x.test/b': response({
        status: 200,
        headers: [['content-type', 'text/html']],
        readBody: () => Promise.resolve({ text: '<title>B</title>', truncated: false })
      })
    })

    const outcome = await fetchWithBudget('https://x.test/a', transport, {
      maxRedirects: 5,
      maxBytes: 1000,
      timeoutMs: 1000
    })

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.finalUrl).toBe('https://x.test/b')
    expect(outcome.status).toBe(200)
    expect(outcome.redirects).toEqual([
      { from: 'https://x.test/a', to: 'https://x.test/b', status: 301 }
    ])
    expect(outcome.body).toContain('<title>B</title>')
  })

  it('fails as too-many-redirects past the budget', async () => {
    const transport: FetchTransport = (url) =>
      Promise.resolve(response({ status: 302, location: `${url}/next` }))
    const outcome = await fetchWithBudget('https://x.test/loop', transport, {
      maxRedirects: 2,
      maxBytes: 1000,
      timeoutMs: 1000
    })
    expect(outcome).toMatchObject({ ok: false, reason: 'too-many-redirects' })
  })

  it('reports a timeout when the transport aborts', async () => {
    const transport: FetchTransport = (_url, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    const outcome = await fetchWithBudget('https://x.test/slow', transport, {
      maxRedirects: 1,
      maxBytes: 1000,
      timeoutMs: 10
    })
    expect(outcome).toMatchObject({ ok: false, reason: 'timeout' })
  })

  it('sanitizes redirect URLs in the recorded chain', async () => {
    const transport = scriptedTransport({
      'https://x.test/a?token=abc': response({
        status: 302,
        location: 'https://x.test/b?token=def'
      }),
      'https://x.test/b?token=def': response({ status: 200 })
    })
    const outcome = await fetchWithBudget('https://x.test/a?token=abc', transport, {
      maxRedirects: 5,
      maxBytes: 1000,
      timeoutMs: 1000
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.redirects[0].from).toContain(REDACTED)
    expect(outcome.redirects[0].to).toContain(REDACTED)
    expect(outcome.finalUrl).toContain(REDACTED)
  })
})

describe('captureDeliveredEvidence', () => {
  it('returns available evidence with the delivered title', async () => {
    const transport = scriptedTransport({
      'https://x.test/': response({
        status: 200,
        headers: [['content-type', 'text/html']],
        readBody: () => Promise.resolve({ text: '<title>Home</title>', truncated: false })
      })
    })
    const evidence = await captureDeliveredEvidence('https://x.test/', transport)
    expect(evidence.available).toBe(true)
    expect(evidence.status).toBe(200)
    expect(evidence.documentTitle).toBe('Home')
  })

  it('returns unavailable evidence on a timeout without throwing', async () => {
    const transport: FetchTransport = (_url, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    const evidence = await captureDeliveredEvidence(
      'https://x.test/',
      transport,
      {},
      {
        maxRedirects: 1,
        maxBytes: 1000,
        timeoutMs: 10
      }
    )
    expect(evidence.available).toBe(false)
    expect(evidence.unavailableReason).toBe('timeout')
  })
})

describe('titleHydrationRule', () => {
  const evaluate = (
    delivered: DeliveredEvidence,
    rendered: RenderedAuditSnapshot,
    authenticated = false
  ): Finding =>
    titleHydrationRule.evaluate({
      rendered,
      delivered,
      accessContext: { authenticated },
      indexingIntent: 'indexable'
    })

  const available = (documentTitle: string | null): DeliveredEvidence => ({
    available: true,
    unavailableReason: null,
    finalUrl: 'https://x.test/',
    status: 200,
    redirects: [],
    headers: {},
    documentTitle,
    truncated: false
  })

  it('is unable to verify when delivered evidence is unavailable', () => {
    const finding = evaluate(UNAVAILABLE_DELIVERED_EVIDENCE, { title: 'Rendered' })
    expect(finding.outcome).toBe('unable-to-verify')
    expect(finding.evidence.origin).toBe('delivered')
  })

  it('warns when delivered and rendered titles differ', () => {
    const finding = evaluate(available('Delivered title'), { title: 'Rendered title' })
    expect(finding.outcome).toBe('warning')
    expect(finding.evidence.detail).toContain('Delivered title')
    expect(finding.evidence.detail).toContain('Rendered title')
  })

  it('notes the authenticated caveat when observed through a session', () => {
    const finding = evaluate(available('A'), { title: 'B' }, true)
    expect(finding.impact.toLowerCase()).toContain('authenticated')
  })

  it('passes when delivered and rendered titles agree', () => {
    const finding = evaluate(available('Same'), { title: 'Same' })
    expect(finding.outcome).toBe('passed')
  })
})
