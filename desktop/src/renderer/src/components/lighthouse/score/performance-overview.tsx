import type {
  LighthouseAssessmentResult,
  LighthouseAuditDetail,
  LighthouseCoreMetricId
} from '../../../../../shared/lighthouse'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@renderer/components/ui/accordion'
import { cn } from '@renderer/lib/utils'
import { formatScore, scoreTone, TONE_STROKE, TONE_TEXT } from '../lib/scoring'
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

const BOX = 280
const CENTER = BOX / 2
const RADIUS = 102
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const SEGMENT = CIRCUMFERENCE * 0.15

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
    <Accordion defaultValue={['performance']} className="mt-6 border-t border-white/10 pt-2">
      <AccordionItem value="performance" className="border-0">
        <AccordionTrigger className="items-center px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/55">
            Performance overview
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div
            className={cn(
              'grid items-center gap-6 pt-2',
              result.screenshotDataUrl && 'sm:grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)]'
            )}
          >
            <div className="flex flex-col items-center">
              <div
                data-testid="lighthouse-performance-overview"
                tabIndex={0}
                aria-label="Performance score. Hover or focus to inspect metric scores."
                className="group/performance relative size-[280px] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
              >
                <svg
                  viewBox={`0 0 ${BOX} ${BOX}`}
                  className="absolute inset-0 size-full"
                  aria-hidden
                >
                  {METRIC_RING.map(({ id, angle }) => {
                    const metric = metricAt(result, id)
                    const value = metric?.score == null ? 0 : Math.max(0, Math.min(1, metric.score))
                    const tone = scoreTone(metric?.score ?? null)
                    const startAngle = angle - 27
                    return (
                      <g key={id}>
                        <circle
                          cx={CENTER}
                          cy={CENTER}
                          r={RADIUS}
                          fill="none"
                          stroke="rgba(255,255,255,0.09)"
                          strokeWidth="8"
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
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${SEGMENT * value} ${CIRCUMFERENCE - SEGMENT * value}`}
                          transform={`rotate(${startAngle} ${CENTER} ${CENTER})`}
                          className="opacity-0 transition-opacity duration-200 group-hover/performance:opacity-100 group-focus/performance:opacity-100 motion-reduce:duration-0"
                        />
                      </g>
                    )
                  })}
                </svg>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center">
                    <ScoreGauge category={performance} size="lg" centered />
                    <p className="-mt-1 text-sm font-medium text-white/70">Performance</p>
                  </div>
                </div>

                {METRIC_RING.map(({ id, label, angle }) => {
                  const metric = metricAt(result, id)
                  const radians = (angle * Math.PI) / 180
                  const labelRadius = 130
                  const x = CENTER + Math.cos(radians) * labelRadius
                  const y = CENTER + Math.sin(radians) * labelRadius
                  const tone = scoreTone(metric?.score ?? null)
                  return (
                    <span
                      key={id}
                      data-testid="lighthouse-performance-subgauge"
                      data-metric-id={id}
                      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center opacity-0 transition-opacity duration-200 group-hover/performance:opacity-100 group-focus/performance:opacity-100 motion-reduce:duration-0"
                      style={{ left: x, top: y }}
                    >
                      <span className="text-[10px] font-medium text-white/55">{label}</span>
                      <span
                        className={cn('text-[10px] font-semibold tabular-nums', TONE_TEXT[tone])}
                      >
                        {formatScore(metric?.score ?? null)}
                      </span>
                    </span>
                  )
                })}
              </div>
              <p className="mt-1 text-[10px] text-white/35">
                Hover or focus to inspect metric scoring
              </p>
            </div>

            {result.screenshotDataUrl ? (
              <div className="flex min-h-64 items-center justify-center border-white/10 sm:border-l sm:pl-6">
                <div className="flex justify-center rounded-md border border-white/10 bg-white p-1.5 shadow-xl">
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

          <div className="mt-5">
            <ScoreLegend />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
