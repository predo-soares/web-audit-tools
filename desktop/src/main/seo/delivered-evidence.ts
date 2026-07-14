import type { DeliveredEvidence } from '../../shared/seo-audit'
import {
  DEFAULT_FETCH_BUDGET,
  extractDeliveredSearchMetadata,
  extractDeliveredTitle,
  fetchWithBudget,
  type FetchBudget,
  type FetchTransport
} from './referenced-fetch'

/**
 * Capture Delivered evidence for `url` via a bounded fetch. Never throws: a
 * blocked, timed-out, oversized, or failed fetch resolves to an unavailable
 * {@link DeliveredEvidence} so dependent checks report Unable to verify instead
 * of failing the audit.
 *
 * `requestHeaders` (e.g. a Cookie header for session parity, a User-Agent) are
 * sent with the request but never stored in the returned evidence.
 */
export async function captureDeliveredEvidence(
  url: string,
  transport: FetchTransport,
  requestHeaders: Record<string, string> = {},
  budget: FetchBudget = DEFAULT_FETCH_BUDGET
): Promise<DeliveredEvidence> {
  const outcome = await fetchWithBudget(url, transport, budget, requestHeaders)

  if (!outcome.ok) {
    return {
      available: false,
      unavailableReason: outcome.reason,
      finalUrl: null,
      status: null,
      redirects: outcome.redirects,
      headers: {},
      documentTitle: null,
      truncated: false
    }
  }

  const metadata = extractDeliveredSearchMetadata(outcome.body)

  return {
    available: true,
    unavailableReason: null,
    finalUrl: outcome.finalUrl,
    status: outcome.status,
    redirects: outcome.redirects,
    headers: outcome.headers,
    documentTitle: extractDeliveredTitle(outcome.body),
    descriptions: metadata.descriptions,
    canonicals: metadata.canonicals,
    favicons: metadata.favicons,
    robots: metadata.robots,
    sitemapLinks: metadata.sitemapLinks,
    social: metadata.social,
    truncated: outcome.truncated
  }
}
