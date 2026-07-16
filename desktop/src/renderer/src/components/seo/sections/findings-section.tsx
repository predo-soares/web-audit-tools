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
import { CARD, EASE_OUT, SECTION_TITLE } from '../lib/styles'
import { OUTCOME_CLASS } from '../lib/finding-format'

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
  const visible = result.findings.filter(
    (finding) =>
      (!findingCategory || finding.category === findingCategory) &&
      (!findingOutcome || finding.outcome === findingOutcome)
  )

  return (
    <section data-testid="seo-result">
      <h2 className={cn('mb-3', SECTION_TITLE)}>Findings</h2>
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
              'motion-safe:fill-mode-forwards motion-safe:opacity-0 motion-safe:duration-200',
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
              <span className="text-xs text-white/45">{CATEGORY_LABEL[finding.category]}</span>
              <code data-testid="seo-finding-rule-id" className="ml-auto text-[10px] text-white/35">
                {finding.ruleId}
              </code>
              <button
                type="button"
                aria-label={`Copy ${finding.ruleId} finding`}
                onClick={() => copyMarkdown(auditMarkdown(result, { finding }), finding.ruleId)}
                className="text-[10px] text-sky-400 transition-colors hover:text-sky-300"
              >
                Copy
              </button>
            </div>
            <p data-testid="seo-finding-summary" className="mt-2 text-sm text-white/90">
              {finding.summary}
            </p>
            <p className="mt-1 text-xs text-white/45">{finding.impact}</p>
            <p data-testid="seo-finding-evidence" className="mt-2 text-xs text-white/75">
              <span className="text-white/40">
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
          <li className="rounded-xl border border-white/10 bg-black/40 p-5 text-sm text-white/45 backdrop-blur-md">
            No findings match the current filters.
          </li>
        ) : null}
      </ul>
    </section>
  )
}
