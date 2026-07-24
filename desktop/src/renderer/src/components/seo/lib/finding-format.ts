import {
  CATEGORY_LABEL,
  INDEXING_INTENT_LABEL,
  OUTCOME_LABEL,
  type AuditCategory,
  type FindingOutcome,
  type IndexingIntent
} from '../../../../../shared/seo-audit'

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as AuditCategory[]
export const OUTCOMES = Object.keys(OUTCOME_LABEL) as FindingOutcome[]

// Actionable outcomes surface first and are always shown; the rest are collapsed
// behind toggles so the findings list leads with what needs attention.
export const PRIMARY_OUTCOMES: FindingOutcome[] = ['error', 'warning', 'opportunity']
export const SECONDARY_OUTCOMES: FindingOutcome[] = ['passed', 'unable-to-verify']

export const OUTCOME_ORDER: Record<FindingOutcome, number> = {
  error: 0,
  warning: 1,
  opportunity: 2,
  passed: 3,
  'unable-to-verify': 4
}

export const OUTCOME_CLASS: Record<FindingOutcome, string> = {
  error: 'bg-destructive/15 text-destructive',
  warning: 'bg-amber-500/15 text-amber-500',
  opportunity: 'bg-sky-500/15 text-sky-500',
  passed: 'bg-emerald-500/15 text-emerald-500',
  'unable-to-verify': 'bg-white/10 text-white/55'
}

export const INTENT_OPTIONS: { label: string; value: IndexingIntent }[] = (
  ['indexable', 'non-indexable', 'local-private'] as IndexingIntent[]
).map((value) => ({ value, label: INDEXING_INTENT_LABEL[value] }))
