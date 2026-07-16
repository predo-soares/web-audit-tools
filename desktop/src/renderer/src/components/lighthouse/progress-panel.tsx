import type { LighthouseProfile, LighthouseProgressPhase } from '../../../../shared/lighthouse'
import {
  LIGHTHOUSE_PROFILES,
  LIGHTHOUSE_PROGRESS_PHASES,
  LIGHTHOUSE_PROGRESS_STEP_LABEL
} from '../../../../shared/lighthouse'
import { cn } from '@renderer/lib/utils'
import { EASE_OUT } from './lib/styles'

export function ProgressPanel({
  profile,
  phase,
  label
}: {
  profile: LighthouseProfile
  phase: LighthouseProgressPhase
  label: string
}): React.JSX.Element {
  const currentIndex = LIGHTHOUSE_PROGRESS_PHASES.indexOf(phase)
  const profileIndex = LIGHTHOUSE_PROFILES.indexOf(profile)
  const overall =
    ((profileIndex * LIGHTHOUSE_PROGRESS_PHASES.length + currentIndex + 1) /
      (LIGHTHOUSE_PROFILES.length * LIGHTHOUSE_PROGRESS_PHASES.length)) *
    100

  return (
    <section
      role="status"
      data-testid="lighthouse-progress"
      className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white/90">{label}</p>
          <p className="mt-0.5 text-xs text-white/40">
            {profile === 'mobile' ? 'Mobile' : 'Desktop'} · step {currentIndex + 1} of{' '}
            {LIGHTHOUSE_PROGRESS_PHASES.length} · profile {profileIndex + 1} of{' '}
            {LIGHTHOUSE_PROFILES.length}
          </p>
        </div>
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400/60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-sky-400" />
        </span>
      </div>

      <div className="mb-4 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            'h-full rounded-full bg-sky-400/80 transition-[width] duration-250',
            EASE_OUT,
            'motion-reduce:duration-0'
          )}
          style={{ width: `${overall}%` }}
        />
      </div>

      <div className="mb-3 flex gap-2">
        {LIGHTHOUSE_PROFILES.map((item) => {
          const done = LIGHTHOUSE_PROFILES.indexOf(item) < profileIndex
          const active = item === profile
          return (
            <span
              key={item}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11px] font-medium capitalize',
                'transition-[border-color,background-color,color] duration-200',
                EASE_OUT,
                done && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                active && 'border-sky-400/40 bg-sky-400/10 text-sky-300',
                !done && !active && 'border-white/5 bg-white/[0.03] text-white/30'
              )}
            >
              {item}
            </span>
          )
        })}
      </div>

      <ol className="grid grid-cols-5 gap-2">
        {LIGHTHOUSE_PROGRESS_PHASES.map((step, index) => {
          const done = index < currentIndex
          const active = index === currentIndex
          return (
            <li
              key={step}
              className={cn(
                'rounded-lg border px-2 py-2 text-center',
                'transition-[border-color,background-color,color] duration-200',
                EASE_OUT,
                done && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                active && 'border-sky-400/40 bg-sky-400/10 text-sky-300',
                !done && !active && 'border-white/5 bg-white/[0.03] text-white/30'
              )}
            >
              <span className="block text-[10px] font-medium uppercase tracking-wide">
                {LIGHTHOUSE_PROGRESS_STEP_LABEL[step]}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
