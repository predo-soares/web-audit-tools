import type { PaneId } from './types'
import { isLocalhostUrl } from './dev-context'

// Bump when the set of rules, their identity, or their outcome semantics
// change. An Audit result records the version that produced it so later rule
// changes never obscure how an existing result was reached (see CONTEXT.md,
// "Rule catalog"). Format: <catalog date>.<revision>.
export const SEO_RULE_CATALOG_VERSION = '2026-07-14.1'
export const SEARCH_ENHANCEMENT_PROFILE_VERSION = 'google-search-gallery-2026-07-13'

// Width of the docked SEO panel. Fixed for now — unlike the diagnostics drawer
// the SEO panel is not user-resizable yet.
export const SEO_PANEL_WIDTH_PX = 380

/**
 * The user's declared expectation for how the audited page should be treated.
 * It changes how discoverability evidence is interpreted without removing any
 * check (see CONTEXT.md, "Indexing intent").
 */
export type IndexingIntent = 'indexable' | 'non-indexable' | 'local-private'

/**
 * The conclusion vocabulary shared by every finding. There is deliberately no
 * numeric score — the product reports outcomes, not a proprietary grade.
 */
export type FindingOutcome = 'error' | 'warning' | 'opportunity' | 'passed' | 'unable-to-verify'

/**
 * Where a finding's evidence came from. Delivered evidence is the pre-render
 * response; rendered evidence is the executed DOM. Kept distinct so an audit
 * can expose crawler-visible discrepancies (see CONTEXT.md). Issue 01 produces
 * only rendered evidence; delivered arrives in a later slice.
 */
export type EvidenceOrigin = 'delivered' | 'rendered'

/**
 * The nine decided primary audit categories. Overview is not a category.
 */
export type AuditCategory =
  | 'search-appearance'
  | 'indexability'
  | 'social-sharing'
  | 'structured-data'
  | 'document-structure'
  | 'links'
  | 'images-media'
  | 'internationalization'
  | 'web-performance'

export interface FindingEvidence {
  origin: EvidenceOrigin
  /** Human-readable, already-sanitized description of the observed value. */
  detail: string
}

/**
 * One evidence-backed conclusion within an audit result (see CONTEXT.md,
 * "Finding"). Remediation is present only when action is useful.
 */
export interface Finding {
  ruleId: string
  category: AuditCategory
  outcome: FindingOutcome
  /** Short conclusion, e.g. "Page has a usable title". */
  summary: string
  /** Why it matters, framework-neutral. */
  impact: string
  /** Framework-neutral fix, or null when nothing to do (e.g. a Passed finding). */
  remediation: string | null
  evidence: FindingEvidence
}

/**
 * The findings and supporting evidence produced by one completed Page SEO audit
 * for a particular active-pane navigation (see CONTEXT.md, "Audit result").
 */
export interface AuditResult {
  id: string
  paneId: PaneId
  /** Committed active-pane URL the audit describes. */
  url: string
  /** When the pane last navigated to `url`, or null when unknown. */
  navigationTimestamp: number | null
  startedAt: number
  completedAt: number
  ruleCatalogVersion: string
  indexingIntent: IndexingIntent
  /** Whether the page was observed through an authenticated pane session. */
  accessContext: AuditAccessContext
  /** Rendered evidence the findings were computed from. */
  rendered: RenderedAuditSnapshot
  /** Delivered (pre-render) evidence; may be unavailable. */
  delivered: DeliveredEvidence
  /** Declared and explicitly resolved metadata used by Search appearance. */
  searchAppearance: SearchAppearanceResult
  /** Bounded page, robots, canonical, and sitemap evidence used by Indexability. */
  indexability: IndexabilityResult
  socialSharing: SocialSharingResult
  structuredData: StructuredDataResult
  documentStructure: DocumentStructureEvidence
  links: LinkEvidence[]
  imagesMedia: ImagesMediaEvidence
  findings: Finding[]
}

export interface ImageEvidence {
  sourceIndex: number
  src: string | null
  currentSrc: string | null
  alt: string | null
  role: string | null
  visible: boolean
  complete: boolean
  intrinsicWidth: number
  intrinsicHeight: number
  renderedWidth: number
  renderedHeight: number
  widthAttribute: number | null
  heightAttribute: number | null
  srcset: string
  sizes: string
  pictureSources: { srcset: string; sizes: string; media: string; type: string }[]
  loading: string
  decoding: string
}

export interface MediaEvidence {
  sourceIndex: number
  kind: 'video' | 'audio'
  src: string | null
  currentSrc: string | null
  poster: string | null
  sources: { src: string; type: string; media: string }[]
  tracks: { kind: string; srclang: string; label: string }[]
  controls: boolean
  autoplay: boolean
  muted: boolean
  preload: string
  visible: boolean
}

export interface ImagesMediaEvidence {
  images: ImageEvidence[]
  media: MediaEvidence[]
}

export type LinkKind =
  | 'internal'
  | 'external'
  | 'fragment'
  | 'email'
  | 'telephone'
  | 'download'
  | 'javascript'
  | 'other-scheme'
  | 'missing-destination'

export interface LinkEvidence {
  sourceIndex: number
  rawHref: string | null
  resolvedHref: string | null
  text: string
  accessibleName: string
  target: string | null
  rel: string[]
  rawRel: string
  visible: boolean
  kind: LinkKind
  fragmentTargetExists: boolean | null
}

export interface DocumentHeadingEvidence {
  level: number
  text: string
  accessibleName: string
  visible: boolean
  sourceIndex: number
}

export interface DocumentLandmarkEvidence {
  role: string
  accessibleName: string
  visible: boolean
  textCharacters: number
  sourceIndex: number
}

export interface DocumentStructureEvidence {
  language: { lang: string | null; xmlLang: string | null }
  headings: DocumentHeadingEvidence[]
  landmarks: DocumentLandmarkEvidence[]
  visibleTextCharacters: number
  repeatedText: { text: string; count: number }[]
}

export type StructuredDataFormat = 'json-ld' | 'microdata' | 'rdfa'

export interface RawStructuredSource {
  format: StructuredDataFormat
  sourceIndex: number
  raw: string
}

export interface StructuredEntity {
  format: StructuredDataFormat
  sourceIndex: number
  path: string
  id: string | null
  types: string[]
  properties: Record<string, unknown>
}

export interface StructuredDataProblem {
  severity: 'error' | 'warning'
  sourceIndex: number
  path: string
  message: string
}

export interface SearchEnhancementAssessment {
  entityPath: string
  type: string
  profileVersion: string
  status: 'eligible' | 'ineligible' | 'unable-to-verify' | 'not-supported'
  missingRequired: string[]
  missingRecommended: string[]
  note: string
}

export interface StructuredDataResult {
  sources: RawStructuredSource[]
  entities: StructuredEntity[]
  problems: StructuredDataProblem[]
  enhancements: SearchEnhancementAssessment[]
}

export interface SocialDeclaration {
  property: string
  value: string
  origin: EvidenceOrigin
  order: number
}

export interface SocialCardMetadata {
  title: ResolvedMetadataValue
  description: ResolvedMetadataValue
  image: ResolvedMetadataValue
  url: ResolvedMetadataValue
  card: ResolvedMetadataValue
}

export interface SocialImageEvidence extends ResourceVerification {
  mediaType: string | null
  byteSize: number | null
  sha256: string | null
  width: number | null
  height: number | null
}

export interface SocialSharingResult {
  declared: SocialDeclaration[]
  resolved: { openGraph: SocialCardMetadata; x: SocialCardMetadata }
  images: SocialImageEvidence[]
}

export interface ResourceVerification {
  url: string
  available: boolean
  unavailableReason: string | null
  status: number | null
  finalUrl: string | null
  redirects: RedirectHop[]
  truncated: boolean
}

export interface RobotsEvidence extends ResourceVerification {
  /** User-agent token/group used when interpreting robots.txt. */
  matchedUserAgent: string | null
  /** Whether the audited path is allowed; null when it could not be determined. */
  allowed: boolean | null
  declaredSitemaps: string[]
  ambiguous: boolean
}

export interface IndexabilityResult {
  metaRobots: { value: string; origin: EvidenceOrigin; order: number }[]
  headerRobots: string[]
  canonical: ResourceVerification | null
  robotsTxt: RobotsEvidence
  sitemaps: ResourceVerification[]
}

export type SearchMetadataKind = 'title' | 'description' | 'canonical' | 'favicon'

/** One metadata declaration, retained even when another declaration wins. */
export interface MetadataDeclaration {
  kind: SearchMetadataKind
  value: string
  origin: EvidenceOrigin
  order: number
  /** Human-readable element/response source, e.g. `<meta name="description">`. */
  source: string
}

export interface ResolvedMetadataValue {
  value: string | null
  origin: EvidenceOrigin | null
  /** The deterministic selection/fallback rule that produced `value`. */
  reason: string
}

export interface SearchAppearanceResult {
  declared: MetadataDeclaration[]
  resolved: {
    title: ResolvedMetadataValue
    description: ResolvedMetadataValue
    canonical: ResolvedMetadataValue
    favicon: ResolvedMetadataValue
  }
  measurements: {
    titleCharacters: number
    titleWidthPx: number | null
    descriptionCharacters: number
    descriptionWidthPx: number | null
  }
}

/**
 * Rendered evidence extracted from the active pane (see CONTEXT.md, "Rendered
 * evidence"). Grows as later categories land; Issue 01 needs only the title.
 */
export interface RenderedAuditSnapshot {
  /**
   * The page's `<title>` text: null when no `<title>` element exists, the raw
   * text (possibly empty/whitespace) otherwise. The rule decides usability.
   */
  title: string | null
  descriptions?: string[]
  canonicals?: string[]
  favicons?: string[]
  /** Browser-measured preview width using the audit's documented preview font. */
  titleWidthPx?: number | null
  descriptionWidthsPx?: number[]
  robots?: string[]
  sitemapLinks?: string[]
  social?: { property: string; value: string }[]
  structuredSources?: RawStructuredSource[]
  documentStructure?: DocumentStructureEvidence
  links?: LinkEvidence[]
  imagesMedia?: ImagesMediaEvidence
}

/** One hop in a redirect chain leading to the delivered document. */
export interface RedirectHop {
  from: string
  to: string
  status: number
}

/**
 * Delivered evidence: the page as supplied before client-side rendering (see
 * CONTEXT.md, "Delivered evidence"). Captured via a bounded fetch of the
 * committed URL, so it can be unavailable (blocked / timed out / too large),
 * in which case dependent checks report Unable to verify. All URLs and headers
 * are already sanitized (see {@link import('./seo-sanitize')}).
 */
export interface DeliveredEvidence {
  available: boolean
  /** Why delivered evidence is unavailable, when `available` is false. */
  unavailableReason: string | null
  /** Final response URL after redirects (sanitized). */
  finalUrl: string | null
  status: number | null
  redirects: RedirectHop[]
  /** Sanitized response headers of the final document response. */
  headers: Record<string, string>
  /** `<title>` parsed from the delivered HTML, when present. */
  documentTitle: string | null
  descriptions?: string[]
  canonicals?: string[]
  favicons?: string[]
  robots?: string[]
  sitemapLinks?: string[]
  social?: { property: string; value: string }[]
  /** Whether the delivered body was truncated at the byte budget. */
  truncated: boolean
}

/**
 * Whether the audit observed the page through an authenticated or
 * unauthenticated pane session (see CONTEXT.md, "Audit access context").
 * Qualifies crawler-oriented conclusions.
 */
export interface AuditAccessContext {
  authenticated: boolean
}

export const UNAVAILABLE_DELIVERED_EVIDENCE: DeliveredEvidence = {
  available: false,
  unavailableReason: 'not-fetched',
  finalUrl: null,
  status: null,
  redirects: [],
  headers: {},
  documentTitle: null,
  truncated: false
}

export type AuditRunFailureReason = 'no-url' | 'busy' | 'cancelled' | 'failed'

export type AuditRunResult =
  { ok: true; result: AuditResult } | { ok: false; reason: AuditRunFailureReason }

/**
 * The lifecycle phase of the single app-wide audit job.
 * - `idle`: no audit has run (or the last was cleared).
 * - `running`: an audit is in flight against `running.paneId`.
 * - `completed`: `result` holds a finished audit.
 * - `cancelled`: a run was explicitly cancelled or interrupted by navigation;
 *   no fabricated result is produced, though a prior `result` stays inspectable.
 * - `failed`: an unexpected engine failure; `result` may hold a partial
 *   (incomplete) audit when some evidence was still trustworthy.
 */
export type AuditPhase = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed'

/**
 * The full observable state of the one app-wide Page SEO audit job. Broadcast
 * to the SEO panel so closing and reopening the panel restores progress rather
 * than cancelling or duplicating the job.
 */
export interface AuditJobState {
  phase: AuditPhase
  /** Present only while `phase === 'running'`. */
  running: { paneId: PaneId; url: string; startedAt: number } | null
  /** Last completed or partial result; inspectable until an audit replaces it. */
  result: AuditResult | null
  /** Whether `result` no longer describes its pane's current document. */
  stale: boolean
  /** Whether `result` is a partial result from an interrupted or failed run. */
  incomplete: boolean
}

export const IDLE_AUDIT_STATE: AuditJobState = {
  phase: 'idle',
  running: null,
  result: null,
  stale: false,
  incomplete: false
}

export const OUTCOME_LABEL: Record<FindingOutcome, string> = {
  error: 'Error',
  warning: 'Warning',
  opportunity: 'Opportunity',
  passed: 'Passed',
  'unable-to-verify': 'Unable to verify'
}

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  'search-appearance': 'Search appearance',
  indexability: 'Indexability',
  'social-sharing': 'Social sharing',
  'structured-data': 'Structured data',
  'document-structure': 'Document structure',
  links: 'Links',
  'images-media': 'Images & media',
  internationalization: 'Internationalization',
  'web-performance': 'Web performance'
}

export const INDEXING_INTENT_LABEL: Record<IndexingIntent, string> = {
  indexable: 'Indexable',
  'non-indexable': 'Non-indexable',
  'local-private': 'Local / private'
}

/**
 * Whether a URL is a committed page worth auditing (not empty, not about:blank).
 */
export function isAuditableUrl(url: string | null | undefined): url is string {
  if (!url) return false
  const trimmed = url.trim()
  return trimmed.length > 0 && trimmed !== 'about:blank'
}

/**
 * Environment-aware default indexing intent. A localhost/private page is
 * assumed to be a local/private environment; everything else defaults to
 * indexable. The user can override before running the audit.
 */
export function inferIndexingIntent(url: string): IndexingIntent {
  return isLocalhostUrl(url) ? 'local-private' : 'indexable'
}
