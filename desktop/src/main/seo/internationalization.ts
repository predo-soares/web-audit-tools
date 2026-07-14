import type {
  AlternateTargetEvidence,
  InternationalizationResult,
  RenderedAuditSnapshot
} from '../../shared/seo-audit'
import { sanitizeUrl } from '../../shared/seo-sanitize'
import { fetchWithBudget, type FetchOutcome, type FetchTransport } from './referenced-fetch'

const BUDGET = { maxRedirects: 5, maxBytes: 512_000, timeoutMs: 8_000 }
export async function verifyInternationalization(
  url: string,
  rendered: RenderedAuditSnapshot,
  transport: FetchTransport,
  headers: Record<string, string> = {}
): Promise<InternationalizationResult> {
  const declarations = rendered.hreflang ?? []
  const unique = [
    ...new Set(
      declarations.map((item) => item.resolvedHref).filter((item): item is string => Boolean(item))
    )
  ].slice(0, 10)
  const outcomes = await Promise.all(
    unique.map((target) => fetchWithBudget(target, transport, BUDGET, headers))
  )
  return {
    declarations,
    localeMetadata: rendered.localeMetadata ?? [],
    targets: unique.map((target, index) =>
      targetEvidence(
        target,
        declarations.find((item) => item.resolvedHref === target)?.hreflang ?? '',
        url,
        outcomes[index]
      )
    )
  }
}
export function unavailableInternationalization(
  rendered: RenderedAuditSnapshot = { title: null }
): InternationalizationResult {
  return {
    declarations: rendered.hreflang ?? [],
    localeMetadata: rendered.localeMetadata ?? [],
    targets: []
  }
}
function targetEvidence(
  target: string,
  hreflang: string,
  auditedUrl: string,
  outcome: FetchOutcome
): AlternateTargetEvidence {
  if (!outcome.ok)
    return {
      url: sanitizeUrl(target),
      hreflang,
      available: false,
      unavailableReason: outcome.reason,
      status: null,
      finalUrl: null,
      redirects: outcome.redirects,
      truncated: false,
      reciprocal: null,
      targetLanguage: null,
      targetCanonical: null
    }
  const links = outcome.body.match(/<link\b[^>]*>/gi) ?? []
  const reciprocal = links.some((tag) => {
    if (!/rel\s*=\s*["'][^"']*alternate/i.test(tag)) return false
    const href = tag.match(/href\s*=\s*["']([^"']+)/i)?.[1]
    if (!href) return false
    try {
      return new URL(href, outcome.finalUrl).href === new URL(auditedUrl).href
    } catch {
      return false
    }
  })
  return {
    url: sanitizeUrl(target),
    hreflang,
    available: true,
    unavailableReason: null,
    status: outcome.status,
    finalUrl: sanitizeUrl(outcome.finalUrl),
    redirects: outcome.redirects,
    truncated: outcome.truncated,
    reciprocal,
    targetLanguage: outcome.body.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)/i)?.[1] ?? null,
    targetCanonical:
      links
        .find((tag) => /rel\s*=\s*["'][^"']*canonical/i.test(tag))
        ?.match(/href\s*=\s*["']([^"']+)/i)?.[1] ?? null
  }
}
