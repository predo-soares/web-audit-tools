import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'

import {
  CATEGORY_LABEL,
  OUTCOME_LABEL,
  type AuditCategory,
  type AuditResult,
  type FindingOutcome
} from '../../../../../shared/seo-audit'
import { auditMarkdown } from '../../../../../shared/seo-markdown'
import { cn } from '@renderer/lib/utils'
import type { SeoAuditPresentation } from '@renderer/hooks/use-seo-audit-presentation'
import { Icon } from '@renderer/components/ui/icon'
import { Accordion, AccordionContent, AccordionItem } from '@renderer/components/ui/accordion'
import { CopyButton } from '../copy-button'
import { SECTION_TITLE } from '../lib/styles'
import { CATEGORIES, OUTCOMES, OUTCOME_CLASS, OUTCOME_ORDER } from '../lib/finding-format'

const chipClass = (active: boolean): string =>
  cn(
    'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    active
      ? 'border-transparent bg-white/15 text-white'
      : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white/90'
  )

export function FindingsSection({
  result,
  findingCategory,
  findingOutcome,
  setFindingCategory,
  setFindingOutcome,
  copyMarkdown
}: {
  result: AuditResult
  findingCategory: AuditCategory | null
  findingOutcome: FindingOutcome | null
  setFindingCategory: SeoAuditPresentation['setFindingCategory']
  setFindingOutcome: SeoAuditPresentation['setFindingOutcome']
  copyMarkdown: SeoAuditPresentation['copyMarkdown']
}): React.JSX.Element {
  const inCategory = result.findings.filter(
    (finding) => !findingCategory || finding.category === findingCategory
  )
  const visible = inCategory
    .filter((finding) => !findingOutcome || finding.outcome === findingOutcome)
    .sort((a, b) => OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome])

  const outcomeCount = (outcome: FindingOutcome): number =>
    inCategory.filter((finding) => finding.outcome === outcome).length
  const categoryCount = (category: AuditCategory): number =>
    result.findings.filter((finding) => finding.category === category).length

  return (
    <section
      data-testid="seo-result"
      className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={SECTION_TITLE}>Findings</h2>
        <span className="text-[11px] text-white/45">{result.findings.length} findings</span>
      </div>

      <div data-testid="seo-overview" className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {OUTCOMES.map((outcome) => (
            <button
              key={outcome}
              type="button"
              data-testid="seo-outcome-filter"
              data-outcome={outcome}
              aria-pressed={findingOutcome === outcome}
              onClick={() => setFindingOutcome(findingOutcome === outcome ? null : outcome)}
              className={chipClass(findingOutcome === outcome)}
            >
              {OUTCOME_LABEL[outcome]} · {outcomeCount(outcome)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              data-testid="seo-category-row"
              aria-pressed={findingCategory === category}
              onClick={() => setFindingCategory(findingCategory === category ? null : category)}
              className={chipClass(findingCategory === category)}
            >
              {CATEGORY_LABEL[category]} · {categoryCount(category)}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-white/55">
          No findings match the current filters.
        </p>
      ) : (
        <Accordion className="divide-y divide-white/5 border-t border-white/5">
          {visible.map((finding) => (
            <AccordionItem
              key={finding.ruleId}
              value={finding.ruleId}
              data-testid="seo-finding"
              data-outcome={finding.outcome}
              data-rule-id={finding.ruleId}
            >
              <AccordionPrimitive.Header className="flex items-center gap-2">
                <AccordionPrimitive.Trigger className="group/finding flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                  <Icon
                    icon={ArrowDown01Icon}
                    className="size-3.5 shrink-0 text-white/40 transition-transform group-aria-expanded/finding:rotate-180"
                  />
                  <span
                    data-testid="seo-finding-outcome"
                    className={cn(
                      'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      OUTCOME_CLASS[finding.outcome]
                    )}
                  >
                    {OUTCOME_LABEL[finding.outcome]}
                  </span>
                  <span
                    data-testid="seo-finding-summary"
                    className="min-w-0 flex-1 truncate text-sm text-white/90"
                  >
                    {finding.summary}
                  </span>
                  <span className="sr-only">{CATEGORY_LABEL[finding.category]}</span>
                </AccordionPrimitive.Trigger>
                <CopyButton
                  label={`Copy ${finding.ruleId} finding`}
                  onCopy={() => copyMarkdown(auditMarkdown(result, { finding }), finding.ruleId)}
                />
              </AccordionPrimitive.Header>
              <AccordionContent>
                <div className="flex flex-col gap-1.5 pl-[1.375rem] text-xs">
                  <p className="text-white/55">{finding.impact}</p>
                  <p data-testid="seo-finding-evidence" className="text-white/75">
                    <span className="text-white/55">
                      {finding.evidence.origin === 'delivered' ? 'Delivered' : 'Rendered'}:{' '}
                    </span>
                    {finding.evidence.detail}
                  </p>
                  <code data-testid="seo-finding-rule-id" className="text-[10px] text-white/45">
                    {finding.ruleId}
                  </code>
                  {finding.remediation ? (
                    <p data-testid="seo-finding-remediation" className="text-sky-400">
                      {finding.remediation}
                    </p>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </section>
  )
}
