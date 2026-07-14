import {
  SEO_RULE_CATALOG_VERSION,
  isAuditableUrl,
  type AuditAccessContext,
  type AuditResult,
  type AuditRunResult,
  type DeliveredEvidence,
  type Finding,
  type IndexabilityResult,
  type IndexingIntent,
  type InternationalizationResult,
  type RenderedAuditSnapshot,
  type SocialSharingResult
} from '../../shared/seo-audit'
import { sanitizeUrl } from '../../shared/seo-sanitize'
import type { PaneId } from '../../shared/types'
import { SEO_RULES, type Rule } from './rules'
import { resolveSearchAppearance } from './search-appearance'
import { analyzeStructuredData } from './structured-data'

/** The three evidence origins an audit gathers for a single navigation. */
export interface AuditEvidence {
  rendered: RenderedAuditSnapshot
  delivered: DeliveredEvidence
  accessContext: AuditAccessContext
  indexability: IndexabilityResult
  socialSharing: SocialSharingResult
  internationalization: InternationalizationResult
}

/**
 * Evaluate every rule against the gathered evidence. A rule that throws becomes
 * an Unable-to-verify finding rather than failing the whole audit or its
 * unrelated siblings.
 */
export function evaluateFindings(
  evidence: AuditEvidence,
  indexingIntent: IndexingIntent,
  searchAppearance: AuditResult['searchAppearance'],
  structuredData: AuditResult['structuredData'],
  documentStructure: AuditResult['documentStructure'],
  links: AuditResult['links'],
  imagesMedia: AuditResult['imagesMedia'],
  internationalization: AuditResult['internationalization']
): Finding[] {
  return SEO_RULES.map((rule) => {
    try {
      return rule.evaluate({
        rendered: evidence.rendered,
        delivered: evidence.delivered,
        accessContext: evidence.accessContext,
        indexingIntent,
        searchAppearance,
        indexability: evidence.indexability,
        socialSharing: evidence.socialSharing,
        structuredData,
        documentStructure,
        links,
        imagesMedia,
        internationalization
      })
    } catch (error) {
      return unableToVerifyFinding(rule, error)
    }
  })
}

/**
 * Gather delivered evidence and access context in parallel. Neither throws — a
 * blocked or timed-out delivered fetch resolves to unavailable evidence — so
 * only a rendered-evidence failure is treated as an engine failure.
 */
export function gatherReferencedEvidence(
  port: AuditPort,
  url: string
): Promise<[DeliveredEvidence, AuditAccessContext]> {
  return Promise.all([port.fetchDelivered(url), port.getAccessContext(url)])
}

/** Assemble a stable, sanitized {@link AuditResult} from gathered evidence. */
export function buildAuditResult(
  deps: AuditDeps,
  input: {
    paneId: PaneId
    url: string
    navigationTimestamp: number | null
    startedAt: number
    indexingIntent: IndexingIntent
    evidence: AuditEvidence
  }
): AuditResult {
  const searchAppearance = resolveSearchAppearance(input.evidence, input.url)
  const structuredData = analyzeStructuredData(input.evidence.rendered.structuredSources ?? [])
  const documentStructure = input.evidence.rendered.documentStructure ?? {
    language: { lang: null, xmlLang: null },
    headings: [],
    landmarks: [],
    visibleTextCharacters: 0,
    repeatedText: []
  }
  const links = input.evidence.rendered.links ?? []
  const imagesMedia = input.evidence.rendered.imagesMedia ?? { images: [], media: [] }
  const internationalization = input.evidence.internationalization
  return {
    id: deps.newId(),
    paneId: input.paneId,
    url: sanitizeUrl(input.url),
    navigationTimestamp: input.navigationTimestamp,
    startedAt: input.startedAt,
    completedAt: deps.nowMs(),
    ruleCatalogVersion: SEO_RULE_CATALOG_VERSION,
    indexingIntent: input.indexingIntent,
    accessContext: input.evidence.accessContext,
    rendered: input.evidence.rendered,
    delivered: input.evidence.delivered,
    searchAppearance,
    indexability: input.evidence.indexability,
    socialSharing: input.evidence.socialSharing,
    structuredData,
    documentStructure,
    links,
    imagesMedia,
    internationalization,
    findings: evaluateFindings(
      input.evidence,
      input.indexingIntent,
      searchAppearance,
      structuredData,
      documentStructure,
      links,
      imagesMedia,
      internationalization
    )
  }
}

function unableToVerifyFinding(rule: Rule, error: unknown): Finding {
  return {
    ruleId: rule.id,
    category: rule.category,
    outcome: 'unable-to-verify',
    summary: 'Check could not be evaluated',
    impact: 'This check hit an unexpected error, so its result is unknown for this page.',
    remediation: null,
    evidence: {
      origin: 'rendered',
      detail: `The check failed to run: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * The app surface the audit reads. Kept as a narrow port (like
 * {@link import('../services/snapshot-service').SnapshotPort}) so the service is
 * exercised without a running PaneManager.
 */
export interface AuditPort {
  getActivePaneId(): PaneId | null
  getActivePaneUrl(): string | null
  getLastNavTimestamp(paneId: PaneId): number | null
  /** Extract rendered evidence from the pane without mutating or reloading it. */
  extractRendered(paneId: PaneId): Promise<RenderedAuditSnapshot>
  /** Bounded fetch of delivered (pre-render) evidence. Must not throw. */
  fetchDelivered(url: string): Promise<DeliveredEvidence>
  /** Whether the pane session is authenticated for `url`. Must not throw. */
  getAccessContext(url: string): Promise<AuditAccessContext>
  /** Bounded verification of canonical, robots.txt, and declared sitemaps. */
  fetchIndexability(
    url: string,
    rendered: RenderedAuditSnapshot,
    delivered: DeliveredEvidence
  ): Promise<IndexabilityResult>
  fetchSocial(
    url: string,
    rendered: RenderedAuditSnapshot,
    delivered: DeliveredEvidence
  ): Promise<SocialSharingResult>
  fetchInternational(
    url: string,
    rendered: RenderedAuditSnapshot
  ): Promise<InternationalizationResult>
}

export interface AuditDeps {
  nowMs(): number
  newId(): string
}

export interface AuditOptions {
  indexingIntent: IndexingIntent
}

const defaultDeps: AuditDeps = {
  nowMs: () => Date.now(),
  newId: () => `audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Run a Page SEO audit against the active pane and return a versioned
 * {@link AuditResult}. Returns `{ ok: false, reason: 'no-url' }` when there is
 * no committed page to audit — no evidence is gathered in that case.
 */
export async function runAudit(
  port: AuditPort,
  options: AuditOptions,
  deps: AuditDeps = defaultDeps
): Promise<AuditRunResult> {
  const url = port.getActivePaneUrl()
  if (!isAuditableUrl(url)) {
    return { ok: false, reason: 'no-url' }
  }

  const paneId = port.getActivePaneId() ?? 'desktop'
  const startedAt = deps.nowMs()
  const rendered = await port.extractRendered(paneId)
  const [delivered, accessContext] = await gatherReferencedEvidence(port, url)
  const indexability = await port.fetchIndexability(url, rendered, delivered)
  const socialSharing = await port.fetchSocial(url, rendered, delivered)
  const internationalization = await port.fetchInternational(url, rendered)

  const result = buildAuditResult(deps, {
    paneId,
    url,
    navigationTimestamp: port.getLastNavTimestamp(paneId),
    startedAt,
    indexingIntent: options.indexingIntent,
    evidence: {
      rendered,
      delivered,
      accessContext,
      indexability,
      socialSharing,
      internationalization
    }
  })

  return { ok: true, result }
}
