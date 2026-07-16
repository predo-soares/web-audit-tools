import { cn } from '@renderer/lib/utils'
import { TONE_SHAPE, TONE_STROKE } from '../lib/scoring'

export function ScoreLegend(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-white/45">
      {(
        [
          ['fail', '0–49'],
          ['average', '50–89'],
          ['pass', '90–100']
        ] as const
      ).map(([tone, label]) => (
        <span key={tone} className="inline-flex items-center gap-1.5">
          <span
            className={cn('size-2.5', TONE_SHAPE[tone])}
            style={{ backgroundColor: TONE_STROKE[tone] }}
          />
          {label}
        </span>
      ))}
    </div>
  )
}
