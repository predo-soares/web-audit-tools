import { LaptopIcon, SmartPhone01Icon } from '@hugeicons/core-free-icons'
import type { LighthouseProfile } from '../../../../shared/lighthouse'
import { LIGHTHOUSE_PROFILES } from '../../../../shared/lighthouse'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/lib/utils'
import { EASE_OUT, PRESSABLE } from './lib/styles'

export function ProfileTabs({
  viewProfile,
  isProfileReady,
  onSelect
}: {
  viewProfile: LighthouseProfile
  isProfileReady: (profile: LighthouseProfile) => boolean
  onSelect: (profile: LighthouseProfile) => void
}): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Device profile"
      className="flex items-center justify-center gap-1 border-b border-white/10"
    >
      {LIGHTHOUSE_PROFILES.map((profile) => {
        const selected = viewProfile === profile
        const ready = isProfileReady(profile)
        return (
          <button
            key={profile}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`lighthouse-tab-${profile}`}
            onClick={() => onSelect(profile)}
            className={cn(
              'relative flex items-center gap-2 rounded-md px-5 py-3 text-sm font-medium outline-none',
              'transition-[color,transform] duration-150',
              EASE_OUT,
              PRESSABLE,
              selected
                ? 'text-sky-300'
                : 'text-white/45 [@media(hover:hover)_and_(pointer:fine)]:hover:text-white/70',
              'focus-visible:ring-2 focus-visible:ring-sky-400/30'
            )}
          >
            <Icon
              icon={profile === 'mobile' ? SmartPhone01Icon : LaptopIcon}
              size={16}
              className={selected ? 'text-sky-300' : 'text-white/35'}
            />
            <span className="capitalize">{profile}</span>
            {ready ? (
              <span className="size-1.5 rounded-full bg-emerald-400/80" aria-hidden />
            ) : null}
            <span
              className={cn(
                'pointer-events-none absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-sky-400',
                'transition-[opacity,transform] duration-200',
                EASE_OUT,
                'motion-reduce:transition-none',
                selected ? 'scale-x-100 opacity-100' : 'scale-x-75 opacity-0'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
