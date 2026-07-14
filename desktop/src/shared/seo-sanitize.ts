// The privacy boundary for Page SEO audit evidence. Cookies, authorization,
// and sensitive query values must never reach findings, copied Markdown, logs,
// or serialized results — so every URL and header set that enters an audit
// result passes through here first.

/**
 * Response headers that may carry credentials or session material and are
 * dropped from stored evidence entirely.
 */
const SENSITIVE_RESPONSE_HEADERS = new Set([
  'set-cookie',
  'set-cookie2',
  'authorization',
  'proxy-authorization',
  'www-authenticate',
  'proxy-authenticate'
])

/**
 * Query-parameter names whose *values* are redacted wherever a URL is stored.
 * Matched case-insensitively against the whole parameter name and as a
 * substring so `access_token`, `X-Api-Key`, `sig`, etc. are all covered.
 */
const SENSITIVE_QUERY_PATTERNS = [
  'token',
  'secret',
  'password',
  'passwd',
  'pwd',
  'api_key',
  'apikey',
  'api-key',
  'auth',
  'session',
  'sig',
  'signature',
  'key',
  'access_token',
  'refresh_token',
  'id_token',
  'code',
  'credential',
  'otp'
]

export const REDACTED = 'REDACTED'

function isSensitiveQueryParam(name: string): boolean {
  const lower = name.toLowerCase()
  return SENSITIVE_QUERY_PATTERNS.some((pattern) => lower.includes(pattern))
}

/**
 * Return a URL string with the values of sensitive query parameters replaced by
 * `REDACTED`. Non-URL strings are returned unchanged (nothing to redact).
 */
export function sanitizeUrl(rawUrl: string): string {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return rawUrl
  }

  let changed = false
  for (const key of [...url.searchParams.keys()]) {
    if (isSensitiveQueryParam(key)) {
      url.searchParams.set(key, REDACTED)
      changed = true
    }
  }

  if (!changed) return rawUrl
  return url.toString()
}

/**
 * Copy response headers into a plain object, dropping credential-bearing
 * headers entirely. Header names are lower-cased for stable comparison.
 */
export function sanitizeResponseHeaders(
  headers: Iterable<[string, string]> | Record<string, string>
): Record<string, string> {
  const iterable = headers as Iterable<[string, string]>
  const entries: [string, string][] =
    typeof iterable[Symbol.iterator] === 'function'
      ? [...iterable]
      : Object.entries(headers as Record<string, string>)

  const result: Record<string, string> = {}
  for (const [name, value] of entries) {
    const lower = name.toLowerCase()
    if (SENSITIVE_RESPONSE_HEADERS.has(lower)) continue
    result[lower] = value
  }
  return result
}
