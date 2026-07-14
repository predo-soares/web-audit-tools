import type {
  DeliveredEvidence,
  IndexabilityResult,
  RenderedAuditSnapshot,
  ResourceVerification,
  RobotsEvidence
} from '../../shared/seo-audit'
import { sanitizeUrl } from '../../shared/seo-sanitize'
import {
  fetchWithBudget,
  type FetchBudget,
  type FetchOutcome,
  type FetchTransport
} from './referenced-fetch'

const CONTROL_BUDGET: FetchBudget = { maxRedirects: 5, maxBytes: 512_000, timeoutMs: 8_000 }
const TARGET_CAP = 10

export async function verifyIndexability(
  url: string,
  rendered: RenderedAuditSnapshot,
  delivered: DeliveredEvidence,
  transport: FetchTransport,
  requestHeaders: Record<string, string> = {},
  userAgent = '*'
): Promise<IndexabilityResult> {
  const canonicalUrl = firstNonEmpty(rendered.canonicals) ?? firstNonEmpty(delivered.canonicals)
  const canonicalTarget = canonicalUrl ? absoluteUrl(canonicalUrl, url) : null
  const robotsUrl = originControlUrl(url, '/robots.txt')

  const canonicalPromise = canonicalTarget
    ? fetchWithBudget(canonicalTarget, transport, CONTROL_BUDGET, requestHeaders)
    : Promise.resolve(null)
  const robotsPromise = robotsUrl
    ? fetchWithBudget(robotsUrl, transport, CONTROL_BUDGET, { 'User-Agent': userAgent })
    : Promise.resolve(null)

  const [canonicalOutcome, robotsOutcome] = await Promise.all([canonicalPromise, robotsPromise])
  const robotsTxt = buildRobotsEvidence(url, robotsUrl, robotsOutcome, userAgent)
  const declaredSitemaps = unique([
    ...(rendered.sitemapLinks ?? []),
    ...(delivered.sitemapLinks ?? []),
    ...robotsTxt.declaredSitemaps
  ])
    .map((value) => absoluteUrl(value, url))
    .filter((value): value is string => value !== null)
    .slice(0, TARGET_CAP)

  const sitemapOutcomes = await Promise.all(
    declaredSitemaps.map((target) =>
      fetchWithBudget(target, transport, { ...CONTROL_BUDGET, maxBytes: 64_000 }, requestHeaders)
    )
  )

  return {
    metaRobots: [
      ...(delivered.robots ?? []).map((value, order) => ({
        value,
        origin: 'delivered' as const,
        order
      })),
      ...(rendered.robots ?? []).map((value, order) => ({
        value,
        origin: 'rendered' as const,
        order
      }))
    ],
    headerRobots: splitHeaderDirectives(delivered.headers['x-robots-tag']),
    canonical:
      canonicalTarget && canonicalOutcome
        ? toVerification(canonicalTarget, canonicalOutcome)
        : null,
    robotsTxt,
    sitemaps: declaredSitemaps.map((target, index) =>
      toVerification(target, sitemapOutcomes[index])
    )
  }
}

export function unavailableIndexability(url: string, reason = 'not-fetched'): IndexabilityResult {
  const robotsUrl = originControlUrl(url, '/robots.txt') ?? sanitizeUrl(url)
  return {
    metaRobots: [],
    headerRobots: [],
    canonical: null,
    robotsTxt: {
      url: robotsUrl,
      available: false,
      unavailableReason: reason,
      status: null,
      finalUrl: null,
      redirects: [],
      truncated: false,
      matchedUserAgent: null,
      allowed: null,
      declaredSitemaps: [],
      ambiguous: false
    },
    sitemaps: []
  }
}

function buildRobotsEvidence(
  auditedUrl: string,
  robotsUrl: string | null,
  outcome: FetchOutcome | null,
  userAgent: string
): RobotsEvidence {
  if (!robotsUrl || !outcome) return unavailableIndexability(auditedUrl, 'invalid-origin').robotsTxt
  const verification = toVerification(robotsUrl, outcome)
  if (!outcome.ok || outcome.status >= 400) {
    return {
      ...verification,
      matchedUserAgent: null,
      allowed: outcome.ok && outcome.status === 404 ? true : null,
      declaredSitemaps: [],
      ambiguous: false
    }
  }
  if (outcome.truncated) {
    return {
      ...verification,
      available: false,
      unavailableReason: 'too-large',
      matchedUserAgent: null,
      allowed: null,
      declaredSitemaps: [],
      ambiguous: false
    }
  }
  const parsed = parseRobotsTxt(outcome.body, userAgent, new URL(auditedUrl).pathname)
  return { ...verification, ...parsed }
}

export function parseRobotsTxt(
  body: string,
  userAgent: string,
  pathname: string
): Pick<RobotsEvidence, 'matchedUserAgent' | 'allowed' | 'declaredSitemaps' | 'ambiguous'> {
  const sitemaps: string[] = []
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = []
  let current: (typeof groups)[number] | null = null
  let sawRule = false

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const field = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()
    if (field === 'sitemap') {
      if (value) sitemaps.push(sanitizeUrl(value))
      continue
    }
    if (field === 'user-agent') {
      if (!current || sawRule) {
        current = { agents: [], rules: [] }
        groups.push(current)
        sawRule = false
      }
      current.agents.push(value.toLowerCase())
      continue
    }
    if ((field === 'allow' || field === 'disallow') && current) {
      current.rules.push({ allow: field === 'allow', path: value })
      sawRule = true
    }
  }

  const ua = userAgent.toLowerCase()
  const candidates = groups
    .map((group) => ({
      group,
      agent: group.agents
        .filter((agent) => agent === '*' || ua.includes(agent))
        .sort((a, b) => b.length - a.length)[0]
    }))
    .filter((item): item is { group: (typeof groups)[number]; agent: string } =>
      Boolean(item.agent)
    )
  const specificity = Math.max(
    0,
    ...candidates.map((item) => (item.agent === '*' ? 0 : item.agent.length))
  )
  const selected = candidates.filter(
    (item) => (item.agent === '*' ? 0 : item.agent.length) === specificity
  )
  const rules = selected
    .flatMap((item) => item.group.rules)
    .filter((rule) => rule.path && pathname.startsWith(rule.path))
  const longest = Math.max(0, ...rules.map((rule) => rule.path.length))
  const winners = rules.filter((rule) => rule.path.length === longest)
  return {
    matchedUserAgent: selected[0]?.agent ?? null,
    allowed: winners.length === 0 ? true : winners.some((rule) => rule.allow),
    declaredSitemaps: unique(sitemaps),
    ambiguous: winners.some((rule) => rule.allow) && winners.some((rule) => !rule.allow)
  }
}

function toVerification(url: string, outcome: FetchOutcome): ResourceVerification {
  return outcome.ok
    ? {
        url: sanitizeUrl(url),
        available: true,
        unavailableReason: null,
        status: outcome.status,
        finalUrl: outcome.finalUrl,
        redirects: outcome.redirects,
        truncated: outcome.truncated
      }
    : {
        url: sanitizeUrl(url),
        available: false,
        unavailableReason: outcome.reason,
        status: null,
        finalUrl: null,
        redirects: outcome.redirects,
        truncated: false
      }
}

function firstNonEmpty(values: string[] | undefined): string | null {
  return values?.find((value) => value.trim())?.trim() ?? null
}

function originControlUrl(url: string, path: string): string | null {
  try {
    return new URL(path, new URL(url).origin).toString()
  } catch {
    return null
  }
}

function absoluteUrl(value: string, base: string): string | null {
  try {
    return new URL(value, base).toString()
  } catch {
    return null
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function splitHeaderDirectives(value: string | undefined): string[] {
  return value ? value.split(/\s*,\s*/).filter(Boolean) : []
}
