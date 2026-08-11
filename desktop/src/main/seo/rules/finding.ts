import type { Finding } from '../../../shared/seo-audit'
import type { Rule } from './rule-types'

/**
 * Shared constructor for the common delivered-origin finding shape. Rules with
 * bespoke evidence origins build their `Finding` inline instead.
 */
export function finding(
  rule: Pick<Rule, 'id' | 'category'>,
  outcome: Finding['outcome'],
  summary: string,
  impact: string,
  remediation: string | null,
  detail: string
): Finding {
  return {
    ruleId: rule.id,
    category: rule.category,
    outcome,
    summary,
    impact,
    remediation,
    evidence: { origin: 'delivered', detail }
  }
}
