import type { LighthouseCategory } from '../../../../../shared/lighthouse'
import { cn } from '@renderer/lib/utils'
import { formatScore, scoreTone, TONE_STROKE, TONE_TEXT } from '../lib/scoring'
import { EASE_OUT } from '../lib/styles'

export function ScoreGauge({
  category,
  size = 'md',
  centered = false
}: {
  category: LighthouseCategory
  size?: 'sm' | 'md' | 'lg'
  centered?: boolean
}): React.JSX.Element {
  const tone = scoreTone(category.score)
  const value = category.score == null ? 0 : Math.max(0, Math.min(1, category.score))
  const large = size === 'lg'
  const small = size === 'sm'
  const box = large ? 120 : small ? 68 : 88
  const radius = large ? 48 : small ? 27 : 36
  const stroke = large ? 8 : small ? 5 : 6
  const circumference = 2 * Math.PI * radius
  const dash = circumference * value

  return (
    <article
      data-testid="lighthouse-score"
      className={cn(
        'flex flex-col items-center gap-2',
        !large &&
          !centered &&
          cn(
            'rounded-xl ',
            small ? 'px-2 py-3' : ''
          )
      )}
    >
      <div className="relative" style={{ width: box, height: box }}>
        <svg viewBox={`0 0 ${box} ${box}`} className="size-full -rotate-90" aria-hidden>
          <circle
            cx={box / 2}
            cy={box / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          <circle
            cx={box / 2}
            cy={box / 2}
            r={radius}
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className={cn(
              'transition-[stroke-dasharray] duration-300',
              EASE_OUT,
              'motion-reduce:duration-0'
            )}
          />
        </svg>
        <strong
          className={cn(
            'absolute inset-0 flex items-center justify-center font-semibold tabular-nums',
            large ? 'text-4xl' : small ? 'text-xl' : 'text-2xl',
            TONE_TEXT[tone]
          )}
        >
          {formatScore(category.score)}
        </strong>
      </div>
      {!centered ? (
        <span
          className={cn(
            'text-center text-white/55',
            large ? 'text-sm' : small ? 'text-[11px]' : 'text-xs'
          )}
        >
          {category.title}
        </span>
      ) : null}
    </article>
  )
}
