import { cn } from '@renderer/lib/utils'

export interface SegmentedControlOption<T extends string> {
  label: string
  value: T
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className
}: {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  className?: string
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('flex w-full items-center gap-0.5 rounded-md bg-black/20 p-0.5', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn(
              'flex-1 rounded-[5px] px-2 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              selected
                ? 'bg-white/15 text-foreground'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
