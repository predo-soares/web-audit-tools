import type { PaneId } from './types'
import type { LighthouseLabSpecSnapshot } from './lighthouse-lab'

export type { LighthouseLabSpecSnapshot } from './lighthouse-lab'
export {
  DEFAULT_LIGHTHOUSE_LAB_SELECTION,
  LIGHTHOUSE_DESKTOP_DEVICES,
  LIGHTHOUSE_MOBILE_DEVICES,
  LIGHTHOUSE_NETWORK_PRESETS,
  buildLabSpecSnapshot,
  resolveLighthouseDevice,
  resolveLighthouseNetwork,
  type LighthouseLabSelection,
  type LighthouseNetworkId,
  type LighthouseMobileDeviceId,
  type LighthouseDesktopDeviceId
} from './lighthouse-lab'

export type LighthouseProfile = 'mobile' | 'desktop'
export type LighthouseProgressPhase = 'launching' | 'loading' | 'auditing' | 'projecting' | 'cleanup'

export const LIGHTHOUSE_PROFILES: LighthouseProfile[] = ['mobile', 'desktop']

export const LIGHTHOUSE_PROGRESS_PHASES: LighthouseProgressPhase[] = [
  'launching',
  'loading',
  'auditing',
  'projecting',
  'cleanup'
]

export const LIGHTHOUSE_PROGRESS_STEP_LABEL: Record<LighthouseProgressPhase, string> = {
  launching: 'Launch',
  loading: 'Load',
  auditing: 'Audit',
  projecting: 'Prepare',
  cleanup: 'Cleanup'
}

export const LIGHTHOUSE_CORE_METRIC_IDS = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index'
] as const

export type LighthouseCoreMetricId = (typeof LIGHTHOUSE_CORE_METRIC_IDS)[number]

export interface LighthouseProgress {
  runId: number
  profile: LighthouseProfile
  phase: LighthouseProgressPhase
  label: string
}

export interface LighthouseCategory {
  id: string
  title: string
  score: number | null
  auditIds: string[]
}

export interface LighthouseAuditDetail {
  id: string
  title: string
  description: string
  score: number | null
  scoreDisplayMode: string
  displayValue: string | null
  numericValue: number | null
  numericUnit: string | null
  groupId: string | null
}

export interface LighthouseAuditGroupMeta {
  title: string
  description: string
}

export interface LighthouseAssessmentResult {
  id: string
  paneId: PaneId
  lighthouseVersion: string
  configuration: 'navigation-default'
  deviceMode: LighthouseProfile
  startedAt: number
  completedAt: number
  requestedUrl: string
  finalUrl: string
  /** @deprecated Page SEO compatibility; removed with the presentation migration. */
  targetUrl: string
  /** @deprecated Page SEO compatibility; Lighthouse no longer links to an audit. */
  pageAuditId: null
  shareSession: boolean
  distinctLoad: true
  stale: boolean
  categories: LighthouseCategory[]
  /** @deprecated Page SEO compatibility; prefer categories. */
  scores: Record<string, number | null>
  audits: Record<string, LighthouseAuditDetail>
  auditGroups: Record<string, LighthouseAuditGroupMeta>
  opportunityIds: string[]
  diagnosticIds: string[]
  screenshotDataUrl: string | null
  retainedAuditCount: number
  totalAuditCount: number
  truncatedAuditCount: number
  labSpec: LighthouseLabSpecSnapshot
}

export type LighthouseResultsByProfile = Record<
  LighthouseProfile,
  LighthouseAssessmentResult | null
>

export const EMPTY_LIGHTHOUSE_RESULTS: LighthouseResultsByProfile = {
  mobile: null,
  desktop: null
}

export type LighthouseAssessmentState =
  | {
      phase: 'idle'
      results: LighthouseResultsByProfile
      error: null
      progress: null
    }
  | {
      phase: 'running'
      results: LighthouseResultsByProfile
      error: null
      activeProfile: LighthouseProfile
      paneId: PaneId
      targetUrl: string
      progress: LighthouseProgress
    }
  | {
      phase: 'completed' | 'cancelled'
      results: LighthouseResultsByProfile
      error: null
      progress: null
    }
  | {
      phase: 'failed'
      results: LighthouseResultsByProfile
      error: string
      progress: null
    }

const MAX_TEXT = 2000
const MAX_AUDITS = 250
const MAX_SCREENSHOT_DATA_URL = 2_000_000
const OPPORTUNITY_GROUPS = new Set(['load-opportunities', 'budgets'])
const DIAGNOSTIC_GROUPS = new Set(['diagnostics'])

function text(value: unknown): string {
  return String(value ?? '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/(?:file:\/\/|\/Users\/|Cookie:|Authorization:)[^\s]*/gi, '[redacted]')
    .slice(0, MAX_TEXT)
}

export function sanitizeLighthouseError(error: unknown): string {
  return text(error instanceof Error ? error.message : error) || 'Lighthouse failed'
}

export function markLighthouseResultsStale(
  results: LighthouseResultsByProfile,
  paneId?: PaneId
): LighthouseResultsByProfile {
  const next = { ...results }
  for (const profile of LIGHTHOUSE_PROFILES) {
    const result = next[profile]
    if (!result) continue
    if (paneId != null && result.paneId !== paneId) continue
    next[profile] = { ...result, stale: true }
  }
  return next
}

export function hasAnyLighthouseResult(results: LighthouseResultsByProfile): boolean {
  return LIGHTHOUSE_PROFILES.some((profile) => results[profile] != null)
}

interface LhrLike {
  lighthouseVersion?: string
  finalDisplayedUrl?: string
  categoryGroups?: Record<string, { title?: string; description?: string }>
  categories?: Record<
    string,
    { title?: string; score?: number | null; auditRefs?: Array<{ id: string; group?: string }> }
  >
  audits?: Record<string, Record<string, unknown>>
}

function lighthouseScreenshotDataUrl(lhr: LhrLike): string | null {
  const audit = lhr.audits?.['final-screenshot']
  const details = audit?.details
  if (!details || typeof details !== 'object') return null
  const data = (details as Record<string, unknown>).data
  if (typeof data !== 'string' || data.length > MAX_SCREENSHOT_DATA_URL) return null
  if (!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(data)) return null
  return data
}

export function projectLighthouseResult(
  rawLhr: unknown,
  input: {
    id: string
    paneId: PaneId
    profile: LighthouseProfile
    requestedUrl: string
    shareSession: boolean
    startedAt: number
    completedAt: number
    labSpec: LighthouseLabSpecSnapshot
  }
): LighthouseAssessmentResult {
  const lhr = rawLhr as LhrLike
  const categoryEntries = Object.entries(lhr.categories ?? {})
  const groups = new Map<string, string | null>()
  const orderedIds: string[] = []
  for (const [, category] of categoryEntries) {
    for (const ref of category.auditRefs ?? []) {
      if (!groups.has(ref.id)) orderedIds.push(ref.id)
      groups.set(ref.id, ref.group ?? groups.get(ref.id) ?? null)
    }
  }
  for (const id of Object.keys(lhr.audits ?? {}).sort()) if (!groups.has(id)) orderedIds.push(id)

  const opportunityIds = orderedIds.filter((id) => OPPORTUNITY_GROUPS.has(groups.get(id) ?? ''))
  const diagnosticIds = orderedIds.filter((id) => DIAGNOSTIC_GROUPS.has(groups.get(id) ?? ''))
  const priority = [...new Set([...opportunityIds, ...diagnosticIds, ...orderedIds])]
  const retained = priority.slice(0, MAX_AUDITS)
  const retainedSet = new Set(retained)
  const audits: Record<string, LighthouseAuditDetail> = {}
  for (const id of retained) {
    const audit = lhr.audits?.[id] ?? {}
    audits[id] = {
      id,
      title: text(audit.title || id),
      description: text(audit.description),
      score: typeof audit.score === 'number' ? audit.score : null,
      scoreDisplayMode: text(audit.scoreDisplayMode || 'numeric'),
      displayValue: audit.displayValue == null ? null : text(audit.displayValue),
      numericValue: typeof audit.numericValue === 'number' ? audit.numericValue : null,
      numericUnit: audit.numericUnit == null ? null : text(audit.numericUnit),
      groupId: groups.get(id) ?? null
    }
  }
  const auditGroups: Record<string, LighthouseAuditGroupMeta> = {}
  for (const [id, group] of Object.entries(lhr.categoryGroups ?? {})) {
    auditGroups[id] = {
      title: text(group.title || id),
      description: text(group.description)
    }
  }
  return {
    id: input.id,
    paneId: input.paneId,
    lighthouseVersion: text(lhr.lighthouseVersion || 'unknown'),
    configuration: 'navigation-default',
    deviceMode: input.profile,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    requestedUrl: input.requestedUrl,
    finalUrl: text(lhr.finalDisplayedUrl || input.requestedUrl),
    targetUrl: text(lhr.finalDisplayedUrl || input.requestedUrl),
    pageAuditId: null,
    shareSession: input.shareSession,
    distinctLoad: true,
    stale: false,
    categories: categoryEntries.map(([id, category]) => ({
      id,
      title: text(category.title || id),
      score: typeof category.score === 'number' ? category.score : null,
      auditIds: (category.auditRefs ?? []).map((ref) => ref.id).filter((id) => retainedSet.has(id))
    })),
    scores: Object.fromEntries(
      categoryEntries.map(([id, category]) => [
        id,
        typeof category.score === 'number' ? category.score : null
      ])
    ),
    audits,
    auditGroups,
    opportunityIds: opportunityIds.filter((id) => retainedSet.has(id)),
    diagnosticIds: diagnosticIds.filter((id) => retainedSet.has(id)),
    screenshotDataUrl: lighthouseScreenshotDataUrl(lhr),
    retainedAuditCount: retained.length,
    totalAuditCount: priority.length,
    truncatedAuditCount: Math.max(0, priority.length - retained.length),
    labSpec: {
      ...input.labSpec,
      lighthouseVersion: text(lhr.lighthouseVersion || input.labSpec.lighthouseVersion),
      completedAt: input.completedAt
    }
  }
}
