import type { RedirectHop } from '../../shared/seo-audit'
import { sanitizeResponseHeaders, sanitizeUrl } from '../../shared/seo-sanitize'

/**
 * Explicit budgets for referenced-resource verification (see CONTEXT.md). Every
 * bounded fetch — the delivered document, canonical targets, robots.txt, social
 * images — is capped on redirects, response size, and time so a hostile or slow
 * resource can never hang the audit or exhaust memory. A check that exceeds a
 * budget is reported as Unable to verify, never as a pass or a failure.
 */
export interface FetchBudget {
  maxRedirects: number
  maxBytes: number
  timeoutMs: number
}

export const DEFAULT_FETCH_BUDGET: FetchBudget = {
  maxRedirects: 5,
  maxBytes: 1_500_000,
  timeoutMs: 8_000
}

/** A single request/response with redirects surfaced, not followed. */
export interface RawResponse {
  status: number
  headers: Iterable<[string, string]>
  /** Absolute or relative Location target for a 3xx response, else null. */
  location: string | null
  /** Read the response body up to `maxBytes`, decoded as UTF-8. */
  readBody: (maxBytes: number) => Promise<{ text: string; truncated: boolean }>
}

/** Perform one request without following redirects. Injected for testability. */
export type FetchTransport = (
  url: string,
  signal: AbortSignal,
  headers: Record<string, string>
) => Promise<RawResponse>

export type FetchFailureReason = 'timeout' | 'too-many-redirects' | 'too-large' | 'network'

export type FetchOutcome =
  | {
      ok: true
      finalUrl: string
      status: number
      redirects: RedirectHop[]
      headers: Record<string, string>
      body: string
      truncated: boolean
    }
  | { ok: false; reason: FetchFailureReason; detail: string; redirects: RedirectHop[] }

/**
 * Fetch `url` through `transport`, following redirects up to the budget and
 * capping body size and time. URLs and headers in the outcome are sanitized.
 */
export async function fetchWithBudget(
  url: string,
  transport: FetchTransport,
  budget: FetchBudget = DEFAULT_FETCH_BUDGET,
  extraHeaders: Record<string, string> = {}
): Promise<FetchOutcome> {
  const redirects: RedirectHop[] = []
  let current = url

  // maxRedirects hops + the final response.
  for (let hop = 0; hop <= budget.maxRedirects; hop++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), budget.timeoutMs)
    let response: RawResponse
    try {
      response = await transport(current, controller.signal, extraHeaders)
    } catch (error) {
      clearTimeout(timer)
      if (controller.signal.aborted) {
        return {
          ok: false,
          reason: 'timeout',
          detail: `Timed out after ${budget.timeoutMs}ms`,
          redirects
        }
      }
      return {
        ok: false,
        reason: 'network',
        detail: error instanceof Error ? error.message : String(error),
        redirects
      }
    }
    clearTimeout(timer)

    const isRedirect = response.status >= 300 && response.status < 400 && response.location
    if (isRedirect) {
      let next: string
      try {
        next = new URL(response.location as string, current).toString()
      } catch {
        return { ok: false, reason: 'network', detail: 'Invalid redirect target', redirects }
      }
      redirects.push({
        from: sanitizeUrl(current),
        to: sanitizeUrl(next),
        status: response.status
      })
      current = next
      continue
    }

    let body: { text: string; truncated: boolean }
    try {
      body = await response.readBody(budget.maxBytes)
    } catch (error) {
      return {
        ok: false,
        reason: 'network',
        detail: error instanceof Error ? error.message : String(error),
        redirects
      }
    }

    return {
      ok: true,
      finalUrl: sanitizeUrl(current),
      status: response.status,
      redirects,
      headers: sanitizeResponseHeaders(response.headers),
      body: body.text,
      truncated: body.truncated
    }
  }

  return {
    ok: false,
    reason: 'too-many-redirects',
    detail: `Exceeded ${budget.maxRedirects} redirects`,
    redirects
  }
}

/**
 * A {@link FetchTransport} backed by the global `fetch`. Used in production for
 * bounded verification; unit tests inject a fake transport instead.
 */
export const nodeFetchTransport: FetchTransport = async (url, signal, headers) => {
  const response = await fetch(url, {
    redirect: 'manual',
    signal,
    headers,
    // Never send credentials implicitly; auth parity is applied explicitly via
    // an injected Cookie header when the pane session is authenticated.
    credentials: 'omit'
  })

  return {
    status: response.status,
    headers: response.headers,
    location: response.headers.get('location'),
    readBody: (maxBytes) => readBodyCapped(response, maxBytes)
  }
}

async function readBodyCapped(
  response: Response,
  maxBytes: number
): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) return { text: '', truncated: false }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      const remaining = maxBytes - total
      if (value.byteLength >= remaining) {
        chunks.push(value.subarray(0, remaining))
        total += remaining
        truncated = true
        break
      }
      chunks.push(value)
      total += value.byteLength
    }
  } finally {
    await reader.cancel().catch(() => {})
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { text: new TextDecoder('utf-8').decode(merged), truncated }
}

/** Extract the `<title>` text from delivered HTML without a DOM. */
export function extractDeliveredTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (!match) return null
  return decodeBasicEntities(match[1].trim())
}

export interface DeliveredSearchMetadata {
  descriptions: string[]
  canonicals: string[]
  favicons: string[]
}

/** Extract ordered search-appearance declarations from delivered HTML. */
export function extractDeliveredSearchMetadata(html: string): DeliveredSearchMetadata {
  const descriptions: string[] = []
  const canonicals: string[] = []
  const favicons: string[] = []
  const tags = html.match(/<(?:meta|link)\b[^>]*>/gi) ?? []

  for (const tag of tags) {
    const attrs = parseAttributes(tag)
    if (tag.toLowerCase().startsWith('<meta')) {
      if ((attrs.name ?? '').toLowerCase() === 'description') descriptions.push(attrs.content ?? '')
      continue
    }
    const rel = (attrs.rel ?? '').toLowerCase().split(/\s+/).filter(Boolean)
    if (rel.includes('canonical')) canonicals.push(attrs.href ?? '')
    if (rel.includes('icon') || (rel.includes('shortcut') && rel.includes('icon'))) {
      favicons.push(attrs.href ?? '')
    }
  }

  return { descriptions, canonicals, favicons }
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
  pattern.lastIndex = tag.indexOf(' ') + 1
  for (let match = pattern.exec(tag); match; match = pattern.exec(tag)) {
    attrs[match[1].toLowerCase()] = decodeBasicEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attrs
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
