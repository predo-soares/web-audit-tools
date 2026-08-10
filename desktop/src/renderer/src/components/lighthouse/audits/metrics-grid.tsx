import type {
  LighthouseAssessmentResult,
  LighthouseAuditDetail
} from '../../../../../shared/lighthouse'
import { LIGHTHOUSE_CORE_METRIC_IDS } from '../../../../../shared/lighthouse'
import { cn } from '@renderer/lib/utils'
import { formatScore, scoreTone, TONE_SHAPE, TONE_STROKE, TONE_TEXT } from '../lib/scoring'
import { EASE_OUT } from '../lib/styles'

export function MetricsGrid({ result }: { result: LighthouseAssessmentResult }): React.JSX.Element {
  const metrics = LIGHTHOUSE_CORE_METRIC_IDS.map((id) => result.audits[id]).filter(
    (audit): audit is LighthouseAuditDetail => Boolean(audit)
  )

  if (metrics.length === 0) return <></>

  return (
    <section className=" border-t border-white/10 pt-5 px-5">

      <div className="grid gap-3 sm:grid-cols-2">
        {metrics.map((metric, index) => {
          const tone = scoreTone(metric.score)
          return (
            <div
              key={metric.id}
              data-testid="lighthouse-metric"
              data-metric-id={metric.id}
              style={{ animationDelay: `${index * 50}ms` }}
              className={cn(
                'flex items-start gap-3 rounded-lg  px-3 py-3',
                'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2',
                'motion-safe:duration-200',
                EASE_OUT
              )}
            >
              <span
                className={cn('mt-1 size-2.5 shrink-0', TONE_SHAPE[tone])}
                style={{ backgroundColor: TONE_STROKE[tone] }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/80">{metric.title}</p>
                <p className={cn('mt-0.5 text-3xl font-normal tabular-nums', TONE_TEXT[tone])}>
                  {metric.displayValue ?? formatScore(metric.score)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
