import { useEffect } from 'react'
import { Button } from '@renderer/components/ui/button'

interface ClearHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ClearHistoryDialog({
  open,
  onOpenChange,
  onConfirm
}: ClearHistoryDialogProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open])

  if (!open) return null

  const handleConfirm = (): void => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="clear-history-dialog"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-80 rounded-lg border border-border bg-card p-4 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="clear-history-title" className="text-sm font-semibold">
          Clear history?
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This removes every history entry. Your current page will stay open.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="clear-history-cancel"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            data-testid="clear-history-confirm"
            onClick={handleConfirm}
          >
            Clear history
          </Button>
        </div>
      </div>
    </div>
  )
}
