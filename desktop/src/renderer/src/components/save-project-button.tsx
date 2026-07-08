import { Star } from 'lucide-react'
import { buttonVariants } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

interface SaveProjectButtonProps {
  disabled: boolean
  suggestedName: string
  onSave: (name: string) => void
  className?: string
}

export function SaveProjectButton({
  disabled,
  suggestedName,
  onSave,
  className
}: SaveProjectButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      data-testid="save-project"
      className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), className)}
      aria-label="Save current page as project"
      disabled={disabled}
      onClick={() => onSave(suggestedName)}
    >
      <Star aria-hidden="true" className="size-4" />
    </button>
  )
}
