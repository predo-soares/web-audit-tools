import type { LighthouseProfile, LighthouseProgressPhase } from '../../../../shared/lighthouse'
import { LIGHTHOUSE_PROFILES, LIGHTHOUSE_PROGRESS_PHASES } from '../../../../shared/lighthouse'
import { cn } from '@renderer/lib/utils'
import { EASE_OUT } from './lib/styles'

export function ProgressBar({
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
  const status = `${label}. ${profile === 'mobile' ? 'Mobile' : 'Desktop'} profile, ${Math.round(overall)}% complete.`

  return (
    <div
      role="status"
      data-testid="lighthouse-progress"
      aria-label={status}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/30 backdrop-blur-md"
    >
      <div
        aria-label={status}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={overall}
        className="h-1 w-full bg-white/10"
        role="progressbar"
      >
        <div
          className={cn(
            'h-full rounded-r-full bg-white transition-[width] duration-250',
            EASE_OUT,
            'motion-reduce:duration-0'
          )}
          style={{ width: `${overall}%` }}
        />
      </div>
      <span className="sr-only">{status}</span>
    </div>
  )
}
