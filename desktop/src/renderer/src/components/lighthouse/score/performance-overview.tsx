import type {
  LighthouseAssessmentResult,
  LighthouseAuditDetail,
  LighthouseCoreMetricId
} from '../../../../../shared/lighthouse'
import { cn } from '@renderer/lib/utils'
import { formatScore, scoreTone, TONE_STROKE, TONE_TEXT } from '../lib/scoring'
import { EASE_OUT } from '../lib/styles'
import { ScoreGauge } from './score-gauge'
import { ScoreLegend } from './score-legend'

const METRIC_RING: Array<{
  id: LighthouseCoreMetricId
  label: string
  angle: number
}> = [
  { id: 'speed-index', label: 'SI', angle: -126 },
  { id: 'first-contentful-paint', label: 'FCP', angle: -54 },
  { id: 'largest-contentful-paint', label: 'LCP', angle: 18 },
  { id: 'total-blocking-time', label: 'TBT', angle: 90 },
  { id: 'cumulative-layout-shift', label: 'CLS', angle: 162 }
]

const BOX = 220
const CENTER = BOX / 2
const GAUGE_SIZE = 280
const RING_STROKE = 5
const MAIN_GAUGE_OUTER_RADIUS = 52
const SUBGAUGE_GAP = 2
const RADIUS = (MAIN_GAUGE_OUTER_RADIUS + SUBGAUGE_GAP) / (GAUGE_SIZE / BOX) + RING_STROKE / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const SEGMENT = CIRCUMFERENCE * 0.15
const STAGGER_STEP_MS = 50
const SUBGAUGE_VISIBILITY = cn(
  'opacity-0 transition-opacity duration-[300ms]',
  EASE_OUT,
  'group-hover/performance:opacity-100 group-focus/performance:opacity-100 motion-reduce:transition-none'
)

function metricAt(
  result: LighthouseAssessmentResult,
  id: LighthouseCoreMetricId
): LighthouseAuditDetail | null {
  return result.audits[id] ?? null
}

export function PerformanceOverview({
  result
}: {
  result: LighthouseAssessmentResult
}): React.JSX.Element {
  const performance = result.categories.find((category) => category.id === 'performance')
  if (!performance) return <></>

  return (
    <section className=" border-t border-white/10 ">
      <div
        className={cn(
          'grid items-center gap-6',
          result.screenshotDataUrl && 'grid-cols-2'
        )}
      >
        <div className="flex flex-col items-center">
          <div
            data-testid="lighthouse-performance-overview"
            tabIndex={0}
            aria-label="Performance score. Hover or focus to inspect metric scores."
            className="group/performance relative size-[280px] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
          >
            <div
              className={cn(
                'pointer-events-none absolute inset-0 z-0 origin-center scale-[0.9] transition-transform duration-[400ms]',
                EASE_OUT,
                'group-hover/performance:scale-100 group-focus/performance:scale-100 motion-reduce:scale-100 motion-reduce:transition-none'
              )}
            >
              <svg viewBox={`0 0 ${BOX} ${BOX}`} className="absolute inset-0 size-full" aria-hidden>
                {METRIC_RING.map(({ id, angle }, index) => {
                  const metric = metricAt(result, id)
                  const value = metric?.score == null ? 0 : Math.max(0, Math.min(1, metric.score))
                  const tone = scoreTone(metric?.score ?? null)
                  const startAngle = angle - 27
                  return (
                    <g
                      key={id}
                      className={SUBGAUGE_VISIBILITY}
                      style={{ transitionDelay: `${index * STAGGER_STEP_MS}ms` }}
                    >
                      <circle
                        cx={CENTER}
                        cy={CENTER}
                        r={RADIUS}
                        fill="none"
                        stroke="rgba(255,255,255,0.09)"
                        strokeWidth={RING_STROKE}
                        strokeLinecap="round"
                        strokeDasharray={`${SEGMENT} ${CIRCUMFERENCE - SEGMENT}`}
                        transform={`rotate(${startAngle} ${CENTER} ${CENTER})`}
                      />
                      <circle
                        cx={CENTER}
                        cy={CENTER}
                        r={RADIUS}
                        fill="none"
                        stroke={TONE_STROKE[tone]}
                        strokeWidth={RING_STROKE}
                        strokeLinecap="round"
                        strokeDasharray={`${SEGMENT * value} ${CIRCUMFERENCE - SEGMENT * value}`}
                        transform={`rotate(${startAngle} ${CENTER} ${CENTER})`}
                      />
                    </g>
                  )
                })}
              </svg>

              {METRIC_RING.map(({ id, label, angle }, index) => {
                const metric = metricAt(result, id)
                const radians = (angle * Math.PI) / 180
                const labelRadius = 96
                const xOffset = Math.cos(radians) * labelRadius
                const yOffset = Math.sin(radians) * labelRadius
                const tone = scoreTone(metric?.score ?? null)
                return (
                  <span
                    key={id}
                    data-testid="lighthouse-performance-subgauge"
                    data-metric-id={id}
                    className={cn(
                      'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center',
                      SUBGAUGE_VISIBILITY
                    )}
                    style={{
                      left: `calc(50% + ${xOffset}px)`,
                      top: `calc(50% + ${yOffset}px)`,
                      transitionDelay: `${index * STAGGER_STEP_MS}ms`
                    }}
                  >
                    <span className="text-[9px] font-normal leading-none text-white/50">
                      {label}
                    </span>
                    <span
                      className={cn(
                        'text-[9px] font-medium leading-none tabular-nums',
                        TONE_TEXT[tone]
                      )}
                    >
                      {formatScore(metric?.score ?? null)}
                    </span>
                  </span>
                )
              })}
            </div>

            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <ScoreGauge category={performance} size="lg" centered hideRingsOnInteraction />
            </div>
          </div>
          <ScoreLegend />
        </div>

        {result.screenshotDataUrl ? (
          <div className="flex h-full min-h-64 py-8 items-center justify-center border-white/10 sm:border-l ">
            <div className="flex justify-center rounded-md border border-white/10 bg-zinc-900 p-1.5 shadow-xl">
              <img
                data-testid="lighthouse-final-screenshot"
                src={result.screenshotDataUrl}
                alt={`Final screenshot of ${result.finalUrl}`}
                className="max-h-64 w-auto max-w-full object-contain"
              />
            </div>
          </div>
        ) : null}
      </div>


    </section>
  )
}
