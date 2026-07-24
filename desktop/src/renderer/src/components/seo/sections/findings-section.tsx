import { useState } from 'react'

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
import { CopyButton } from '../copy-button'
import { CARD, EASE_OUT, SECTION_TITLE } from '../lib/styles'
import {
  OUTCOME_CLASS,
  OUTCOME_ORDER,
  PRIMARY_OUTCOMES,
  SECONDARY_OUTCOMES
} from '../lib/finding-format'

export function FindingsSection({
  result,
  findingCategory,
  findingOutcome,
  copyMarkdown
}: {
  result: AuditResult
  findingCategory: AuditCategory | null
  findingOutcome: FindingOutcome | null
  copyMarkdown: SeoAuditPresentation['copyMarkdown']
}): React.JSX.Element {
  // Which collapsed outcomes the user has revealed. The explicit outcome filter
  // (findingOutcome) still wins when set, so these toggles only matter otherwise.
  const [revealed, setRevealed] = useState<Set<FindingOutcome>>(new Set())

  const inCategory = result.findings.filter(
    (finding) => !findingCategory || finding.category === findingCategory
  )

  const activeOutcomes: ReadonlySet<FindingOutcome> = findingOutcome
    ? new Set([findingOutcome])
    : new Set([...PRIMARY_OUTCOMES, ...revealed])

  const visible = inCategory
    .filter((finding) => activeOutcomes.has(finding.outcome))
    .sort((a, b) => OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome])

  // Only offer a toggle for a secondary outcome that actually has findings, and
  // only while no explicit outcome filter is overriding the view.
  const toggles = findingOutcome
    ? []
    : SECONDARY_OUTCOMES.map((outcome) => ({
        outcome,
        count: inCategory.filter((finding) => finding.outcome === outcome).length
      })).filter((entry) => entry.count > 0)

  return (
    <section data-testid="seo-result">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className={SECTION_TITLE}>Findings</h2>
        {toggles.length > 0 ? (
          <div className="ml-auto flex flex-wrap gap-1.5">
            {toggles.map(({ outcome, count }) => {
              const on = revealed.has(outcome)
              return (
                <button
                  key={outcome}
                  type="button"
                  data-testid="seo-outcome-toggle"
                  data-outcome={outcome}
                  aria-pressed={on}
                  onClick={() =>
                    setRevealed((prev) => {
                      const next = new Set(prev)
                      if (next.has(outcome)) next.delete(outcome)
                      else next.add(outcome)
                      return next
                    })
                  }
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                    on
                      ? 'border-transparent bg-white/10 text-white/90'
                      : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white/90'
                  )}
                >
                  {on ? 'Hide' : 'Show'} {OUTCOME_LABEL[outcome].toLowerCase()} · {count}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
      <ul className="space-y-2">
        {visible.map((finding, index) => (
          <li
            key={finding.ruleId}
            data-testid="seo-finding"
            data-outcome={finding.outcome}
            data-rule-id={finding.ruleId}
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            className={cn(
              CARD,
              'p-4',
              'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2',
              'motion-safe:duration-200',
              EASE_OUT
            )}
          >
            <div className="flex items-center gap-2">
              <span
                data-testid="seo-finding-outcome"
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  OUTCOME_CLASS[finding.outcome]
                )}
              >
                {OUTCOME_LABEL[finding.outcome]}
              </span>
              <span className="text-xs text-white/55">{CATEGORY_LABEL[finding.category]}</span>
              <code data-testid="seo-finding-rule-id" className="ml-auto text-[10px] text-white/55">
                {finding.ruleId}
              </code>
              <CopyButton
                label={`Copy ${finding.ruleId} finding`}
                onCopy={() => copyMarkdown(auditMarkdown(result, { finding }), finding.ruleId)}
              />
            </div>
            <p data-testid="seo-finding-summary" className="mt-2 text-sm text-white/90">
              {finding.summary}
            </p>
            <p className="mt-1 text-xs text-white/55">{finding.impact}</p>
            <p data-testid="seo-finding-evidence" className="mt-2 text-xs text-white/75">
              <span className="text-white/55">
                {finding.evidence.origin === 'delivered' ? 'Delivered' : 'Rendered'}:{' '}
              </span>
              {finding.evidence.detail}
            </p>
            {finding.remediation ? (
              <p data-testid="seo-finding-remediation" className="mt-1.5 text-xs text-sky-400">
                {finding.remediation}
              </p>
            ) : null}
          </li>
        ))}
        {visible.length === 0 ? (
          <li className="rounded-xl border border-white/10 bg-black/55 p-5 text-sm text-white/55 backdrop-blur-md">
            {!findingCategory && !findingOutcome && toggles.length > 0
              ? 'Nothing needs attention. Use the toggles above to review passed and unverifiable checks.'
              : 'No findings match the current filters.'}
          </li>
        ) : null}
      </ul>
    </section>
  )
}
