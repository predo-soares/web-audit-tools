import { buttonVariants } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import type { ThemePopoverPayload } from '../../../../../shared/popover-types'
import type { ThemePreference } from '../../../../../shared/types'
import type { PopoverPanelProps } from '@renderer/components/popover/types'
import { Check, Monitor, Moon, Sun } from 'lucide-react'

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Monitor }> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon }
]

export function ThemePanel({
  payload,
  onAction
}: PopoverPanelProps<ThemePopoverPayload>): React.JSX.Element {
  return (
    <div className="flex w-full flex-col gap-0.5">
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon
        const selected = option.value === payload.themePreference

        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              buttonVariants({ variant: selected ? 'secondary' : 'ghost', size: 'xs' }),
              'w-full justify-start'
            )}
            onClick={() => onAction({ type: 'set-theme', preference: option.value })}
          >
            <Icon />
            {option.label}
            {selected ? <Check className="ml-auto" /> : null}
          </button>
        )
      })}
    </div>
  )
}
