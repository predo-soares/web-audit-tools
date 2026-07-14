import {
  SEO_RULE_CATALOG_VERSION,
  isAuditableUrl,
  type AuditResult,
  type AuditRunResult,
  type Finding,
  type IndexingIntent,
  type RenderedAuditSnapshot
} from '../../shared/seo-audit'
import type { PaneId } from '../../shared/types'
import { SEO_RULES, type Rule } from './rules'

/**
 * Evaluate every rule against the gathered evidence. A rule that throws becomes
 * an Unable-to-verify finding rather than failing the whole audit or its
 * unrelated siblings.
 */
export function evaluateFindings(
  rendered: RenderedAuditSnapshot,
  indexingIntent: IndexingIntent
): Finding[] {
  return SEO_RULES.map((rule) => {
    try {
      return rule.evaluate({ rendered, indexingIntent })
    } catch (error) {
      return unableToVerifyFinding(rule, error)
    }
  })
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

  const findings = evaluateFindings(rendered, options.indexingIntent)

  const result: AuditResult = {
    id: deps.newId(),
    paneId,
    url,
    navigationTimestamp: port.getLastNavTimestamp(paneId),
    startedAt,
    completedAt: deps.nowMs(),
    ruleCatalogVersion: SEO_RULE_CATALOG_VERSION,
    indexingIntent: options.indexingIntent,
    findings
  }

  return { ok: true, result }
}
