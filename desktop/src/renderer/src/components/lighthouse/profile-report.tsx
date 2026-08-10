import type { LighthouseAssessmentResult } from '../../../../shared/lighthouse'
import { cn } from '@renderer/lib/utils'
import { DimensionSection } from './dimension-section'
import { DimensionAudits } from './audits/dimension-audits'
import { MetricsGrid } from './audits/metrics-grid'
import { ScoreGauge } from './score/score-gauge'
import { PerformanceOverview } from './score/performance-overview'
import { EASE_OUT } from './lib/styles'

export function ProfileReport({
  result
}: {
  result: LighthouseAssessmentResult
}): React.JSX.Element {
  const performance = result.categories.find((category) => category.id === 'performance')
  return (
    <div data-testid="lighthouse-result" className="space-y-4">
      <section
        data-testid="lighthouse-result-summary"
        className="rounded-xl border border-white/10 bg-black/40   backdrop-blur-md"
      >

        <div className="flex justify-center gap-8 py-5">
          {result.categories.map((category, index) => (
            <a
              key={category.id}
              href={`#lighthouse-dimension-${category.id}`}
              style={{ animationDelay: `${index * 40}ms` }}
              className={cn(
                'block rounded-xl outline-none',
                'transition-transform duration-[160ms]',
                EASE_OUT,
                '[@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]',
                'active:scale-[0.97] motion-reduce:active:scale-100',
                'focus-visible:ring-2 focus-visible:ring-sky-400/50',
                'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95',
                'motion-safe:duration-200'
              )}
            >
              <ScoreGauge category={category} size="sm" />
            </a>
          ))}
        </div>

        <PerformanceOverview result={result} />
        <MetricsGrid result={result} />

        {performance ? (
          <div id="lighthouse-dimension-performance" className="mt-10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/55 px-6 py-3">
              Performance insights
            </h3>
            <div className="">
              <DimensionAudits category={performance} result={result} />
            </div>
          </div>
        ) : null}
      </section>

      {result.categories
        .filter((category) => category.id !== 'performance')
        .map((category) => (
          <DimensionSection key={category.id} category={category} result={result} />
        ))}

      {result.truncatedAuditCount > 0 ? (
        <p className="text-xs text-amber-400/90">
          {result.truncatedAuditCount} audits omitted to keep the report focused.
        </p>
      ) : null}
    </div>
  )
}
