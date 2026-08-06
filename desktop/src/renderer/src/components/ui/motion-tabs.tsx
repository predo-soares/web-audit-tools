import { MotionConfig, motion, useReducedMotion } from 'motion/react'
import { cn } from '@renderer/lib/utils'

export interface MotionTabItem<T extends string> {
  value: T
  label: React.ReactNode
  /** Optional trailing content, e.g. a count badge. */
  trailing?: React.ReactNode
  testId?: string
}

/**
 * Tab bar with a shared-layout indicator that slides between tabs (motion
 * `layoutId`). Click-driven and respects prefers-reduced-motion by dropping the
 * slide. `layoutId` must be unique per rendered instance so separate tab bars
 * don't animate into one another.
 */
export function MotionTabs<T extends string>({
  items,
  value,
  onChange,
  layoutId,
  ariaLabel,
  className,
  tabClassName
}: {
  items: Array<MotionTabItem<T>>
  value: T
  onChange: (value: T) => void
  layoutId: string
  ariaLabel?: string
  className?: string
  tabClassName?: string
}): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  return (
    <MotionConfig
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.4 }}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn('flex w-fit flex-wrap gap-1', className)}
      >
        {items.map((item) => {
          const isActive = value === item.value
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={item.testId}
              onClick={() => onChange(item.value)}
              className={cn(
                'relative flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring/50',
                isActive ? 'text-white' : 'text-white/50 hover:text-white/80',
                tabClassName
              )}
            >
              {isActive ? (
                <motion.div
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-lg border border-white/5 bg-white/10"
                />
              ) : null}
              <span className="relative">{item.label}</span>
              {item.trailing ? (
                <span className="relative flex items-center">{item.trailing}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </MotionConfig>
  )
}
