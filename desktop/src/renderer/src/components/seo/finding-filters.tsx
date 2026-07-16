import { CATEGORY_LABEL, OUTCOME_LABEL, type AuditResult } from '../../../../shared/seo-audit'
import { auditMarkdown } from '../../../../shared/seo-markdown'
import { cn } from '@renderer/lib/utils'
import type { SeoAuditPresentation } from '@renderer/hooks/use-seo-audit-presentation'
import { PRESSABLE, SUBLABEL, CARD } from './lib/styles'
import { CATEGORIES, OUTCOME_CLASS, OUTCOMES } from './lib/finding-format'

export function FindingFilters({
  result,
  findingOutcome,
  setFindingOutcome,
  findingCategory,
  setFindingCategory,
  copyMarkdown
}: {
  result: AuditResult
  findingOutcome: SeoAuditPresentation['findingOutcome']
  setFindingOutcome: SeoAuditPresentation['setFindingOutcome']
  findingCategory: SeoAuditPresentation['findingCategory']
  setFindingCategory: SeoAuditPresentation['setFindingCategory']
  copyMarkdown: SeoAuditPresentation['copyMarkdown']
}): React.JSX.Element {
  return (
    <div data-testid="seo-overview" className={cn(CARD, 'px-5 py-4')}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className={cn('mb-1.5', SUBLABEL)}>Filter by outcome</p>
          <div className="grid grid-cols-2 gap-1.5">
            {OUTCOMES.map((outcome) => (
              <button
                type="button"
                key={outcome}
                data-testid="seo-outcome-filter"
                data-outcome={outcome}
                aria-pressed={findingOutcome === outcome}
                onClick={() => setFindingOutcome(findingOutcome === outcome ? null : outcome)}
                className={cn(
                  'rounded-lg border px-1.5 py-1 text-[10px] transition-colors',
                  PRESSABLE,
                  findingOutcome === outcome
                    ? cn('border-transparent', OUTCOME_CLASS[outcome])
                    : 'border-white/10 bg-white/[0.03] text-white/45 hover:text-white/80'
                )}
              >
                {OUTCOME_LABEL[outcome]}{' '}
                {result.findings.filter((item) => item.outcome === outcome).length}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={cn('mb-1.5', SUBLABEL)}>Filter by category</p>
          <div className="space-y-0.5">
            {CATEGORIES.map((category) => (
              <div
                key={category}
                data-testid="seo-category-row"
                className="flex items-center gap-1"
              >
                <button
                  type="button"
                  aria-pressed={findingCategory === category}
                  onClick={() => setFindingCategory(findingCategory === category ? null : category)}
                  className={cn(
                    'min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left text-[11px] transition-colors',
                    findingCategory === category
                      ? 'bg-sky-400/10 text-sky-300'
                      : 'text-white/45 hover:text-white/80'
                  )}
                >
                  {CATEGORY_LABEL[category]}{' '}
                  <span className="text-white/30">
                    · {result.findings.filter((item) => item.category === category).length}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Copy ${CATEGORY_LABEL[category]} findings`}
                  onClick={() =>
                    copyMarkdown(auditMarkdown(result, { category }), CATEGORY_LABEL[category])
                  }
                  className="px-1 text-[10px] text-sky-400 transition-colors hover:text-sky-300"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
