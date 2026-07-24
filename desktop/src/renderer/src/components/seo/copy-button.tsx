import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Icon } from '@renderer/components/ui/icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/lib/utils'

// Icon-only copy affordance that confirms the action inline: on click it copies,
// swaps to a check, and forces its tooltip to read "Copied" for a moment.
export function CopyButton({
  onCopy,
  label,
  className,
  testId
}: {
  onCopy: () => void
  label: string
  className?: string
  testId?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const handleClick = useCallback((): void => {
    onCopy()
    setCopied(true)
    setOpen(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setCopied(false)
      setOpen(false)
    }, 1400)
  }, [onCopy])

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        type="button"
        aria-label={label}
        data-testid={testId}
        onClick={handleClick}
        className={cn(
          '-my-1 flex items-center rounded p-1 text-white/55 outline-none transition-colors hover:text-white/90 focus-visible:text-white/90 focus-visible:ring-2 focus-visible:ring-ring/50',
          copied && 'text-emerald-400 hover:text-emerald-400',
          className
        )}
      >
        <Icon icon={copied ? Tick02Icon : Copy01Icon} size={14} />
      </TooltipTrigger>
      <TooltipContent side="top">{copied ? 'Copied' : 'Copy'}</TooltipContent>
    </Tooltip>
  )
}
