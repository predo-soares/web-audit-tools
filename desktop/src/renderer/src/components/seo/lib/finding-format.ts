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

export const OUTCOME_CLASS: Record<FindingOutcome, string> = {
  error: 'bg-destructive/15 text-destructive',
  warning: 'bg-amber-500/15 text-amber-500',
  opportunity: 'bg-sky-500/15 text-sky-500',
  passed: 'bg-emerald-500/15 text-emerald-500',
  'unable-to-verify': 'bg-white/10 text-white/45'
}

export const INTENT_OPTIONS: { label: string; value: IndexingIntent }[] = (
  ['indexable', 'non-indexable', 'local-private'] as IndexingIntent[]
).map((value) => ({ value, label: INDEXING_INTENT_LABEL[value] }))
