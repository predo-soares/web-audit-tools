import type { LighthouseAssessmentResult } from '../../../../shared/lighthouse'
import { cn } from '@renderer/lib/utils'
import { DimensionSection } from './dimension-section'
import { ScoreGauge } from './score/score-gauge'
import { SpecsBar } from './specs-bar'
import { EASE_OUT } from './lib/styles'

export function ProfileReport({
  result
}: {
  result: LighthouseAssessmentResult
}): React.JSX.Element {
  return (
    <div data-testid="lighthouse-result" className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <p className="text-xs text-white/40">Lab data · {result.deviceMode}</p>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            result.stale ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
          )}
        >
          {result.stale ? 'Stale' : 'Current'}
        </span>
      </div>

      <SpecsBar spec={result.labSpec} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            <ScoreGauge category={category} />
          </a>
        ))}
      </section>

      {result.categories.map((category) => (
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
