import { InformationCircleIcon } from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@renderer/components/ui/dialog'
import { cn } from '@renderer/lib/utils'

/** Label + value line used inside detail dialogs across the audit sections. */
export function DetailRow({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="w-28 shrink-0 text-white/40">{label}</span>
      <span className="min-w-0 break-all text-white/80">{children}</span>
    </div>
  )
}

/**
 * A compact info-icon button that opens a dialog holding an item's full details,
 * keeping the list row itself uncluttered. Mirrors the image card's details modal.
 */
export function InfoDialog({
  title,
  testId,
  triggerTestId,
  triggerLabel,
  triggerClassName,
  children
}: {
  title: string
  testId?: string
  triggerTestId?: string
  triggerLabel: string
  triggerClassName?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger
        data-testid={triggerTestId}
        aria-label={triggerLabel}
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md text-white/50 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-ring/50',
          triggerClassName
        )}
      >
        <Icon icon={InformationCircleIcon} size={13} />
      </DialogTrigger>
      <DialogContent data-testid={testId}>
        <DialogTitle className="ml-1 truncate pr-8" title={title}>
          {title}
        </DialogTitle>
        <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto px-1 pb-1 text-xs">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
