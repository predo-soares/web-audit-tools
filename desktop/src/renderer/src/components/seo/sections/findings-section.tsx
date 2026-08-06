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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { CopyButton } from '../copy-button'
import { SECTION_TITLE } from '../lib/styles'
import { CATEGORIES, OUTCOMES, OUTCOME_CLASS, OUTCOME_ORDER } from '../lib/finding-format'

const CLEAR_FILTER_VALUE = '__clear_filter__'

export function FindingsSection({
  result,
  findingCategories,
  findingOutcomes,
  setFindingCategories,
  setFindingOutcomes,
  copyMarkdown
}: {
  result: AuditResult
  findingCategories: AuditCategory[]
  findingOutcomes: FindingOutcome[]
  setFindingCategories: SeoAuditPresentation['setFindingCategories']
  setFindingOutcomes: SeoAuditPresentation['setFindingOutcomes']
  copyMarkdown: SeoAuditPresentation['copyMarkdown']
}): React.JSX.Element {
  const inCategories = result.findings.filter(
    (finding) => findingCategories.length === 0 || findingCategories.includes(finding.category)
  )
  const visible = inCategories
    .filter((finding) => findingOutcomes.length === 0 || findingOutcomes.includes(finding.outcome))
    .sort((a, b) => OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome])

  const outcomeCount = (outcome: FindingOutcome): number =>
    inCategories.filter((finding) => finding.outcome === outcome).length
  const categoryCount = (category: AuditCategory): number =>
    result.findings.filter((finding) => finding.category === category).length

  return (
    <section
      data-testid="seo-result"
      className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className={SECTION_TITLE}>Findings</h2>
          <span
            className="text-[11px] text-white/45"
            aria-label={`${result.findings.length} findings`}
          >
            {result.findings.length}
          </span>
        </div>

        <div
          data-testid="seo-overview"
          className="ml-auto flex flex-wrap items-center justify-end gap-1.5"
        >
          <Select
            multiple
            value={findingOutcomes}
            onValueChange={(value) => {
              const selected = value as string[]
              setFindingOutcomes(
                selected.includes(CLEAR_FILTER_VALUE) ? [] : (selected as FindingOutcome[])
              )
            }}
          >
            <SelectTrigger
              size="sm"
              data-testid="seo-outcome-filter"
              aria-label="Filter findings by status"
              className={cn(
                'h-7 border-white/10 bg-white/[0.03] text-xs',
                findingOutcomes.length > 0 && 'border-white/20 bg-white/10'
              )}
            >
              <SelectValue>
                {(value) => {
                  const selected = Array.isArray(value) ? (value as FindingOutcome[]) : []
                  if (selected.length === 0) return 'Status'
                  if (selected.length === 1) return OUTCOME_LABEL[selected[0]]
                  return `${selected.length} selected`
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false} className="min-w-48">
              {OUTCOMES.map((outcome) => (
                <SelectItem
                  key={outcome}
                  value={outcome}
                  data-testid="seo-outcome-option"
                  data-outcome={outcome}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn('size-2 shrink-0 rounded-full', OUTCOME_CLASS[outcome])} />
                    <span>{OUTCOME_LABEL[outcome]}</span>
                  </span>
                  <span className="ml-auto text-white/35">{outcomeCount(outcome)}</span>
                </SelectItem>
              ))}
              {findingOutcomes.length > 0 ? (
                <>
                  <SelectSeparator />
                  <SelectItem
                    value={CLEAR_FILTER_VALUE}
                    data-testid="seo-outcome-clear"
                    className="text-white/55"
                  >
                    Clear filter
                  </SelectItem>
                </>
              ) : null}
            </SelectContent>
          </Select>

          <Select
            multiple
            value={findingCategories}
            onValueChange={(value) => {
              const selected = value as string[]
              setFindingCategories(
                selected.includes(CLEAR_FILTER_VALUE) ? [] : (selected as AuditCategory[])
              )
            }}
          >
            <SelectTrigger
              size="sm"
              data-testid="seo-category-filter"
              aria-label="Filter findings by category"
              className={cn(
                'h-7 border-white/10 bg-white/[0.03] text-xs',
                findingCategories.length > 0 && 'border-white/20 bg-white/10'
              )}
            >
              <SelectValue>
                {(value) => {
                  const selected = Array.isArray(value) ? (value as AuditCategory[]) : []
                  if (selected.length === 0) return 'Category'
                  if (selected.length === 1) return CATEGORY_LABEL[selected[0]]
                  return `${selected.length} selected`
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false} className="min-w-56">
              {CATEGORIES.map((category) => (
                <SelectItem
                  key={category}
                  value={category}
                  data-testid="seo-category-option"
                  data-category={category}
                >
                  <span>{CATEGORY_LABEL[category]}</span>
                  <span className="ml-auto text-white/35">{categoryCount(category)}</span>
                </SelectItem>
              ))}
              {findingCategories.length > 0 ? (
                <>
                  <SelectSeparator />
                  <SelectItem
                    value={CLEAR_FILTER_VALUE}
                    data-testid="seo-category-clear"
                    className="text-white/55"
                  >
                    Clear filter
                  </SelectItem>
                </>
              ) : null}
            </SelectContent>
          </Select>
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
                    role="img"
                    aria-label={OUTCOME_LABEL[finding.outcome]}
                    title={OUTCOME_LABEL[finding.outcome]}
                    className={cn('size-2 shrink-0 rounded-full', OUTCOME_CLASS[finding.outcome])}
                  />
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
