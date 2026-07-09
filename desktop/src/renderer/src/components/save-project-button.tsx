import { StarIcon } from '@hugeicons/core-free-icons'
import { buttonVariants } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/lib/utils'

interface SaveProjectButtonProps {
  disabled: boolean
  isSaved: boolean
  suggestedName: string
  onSave: (name: string) => void
  className?: string
}

export function SaveProjectButton({
  disabled,
  isSaved,
  suggestedName,
  onSave,
  className
}: SaveProjectButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      data-testid="save-project"
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
        'hover:bg-transparent active:bg-transparent',
        isSaved ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        className
      )}
      aria-label={isSaved ? 'Current page saved as project' : 'Save current page as project'}
      aria-pressed={isSaved}
      disabled={disabled}
      onClick={() => onSave(suggestedName)}
    >
      <Icon
        aria-hidden
        icon={StarIcon}
        className={cn('size-4 transition-colors', isSaved && '[&_svg]:fill-current')}
      />
    </button>
  )
}
