import { Delete02Icon, Globe02Icon, MoreHorizontalIcon } from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'
import { useState } from 'react'
import type { HistoryEntry } from '../../../shared/history'
import { suggestProjectName } from '../../../shared/project'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { cn } from '@renderer/lib/utils'

interface HistoryRowProps {
  entry: HistoryEntry
  isActive: boolean
  rowRef?: React.Ref<HTMLButtonElement>
  onActivate: (entry: HistoryEntry) => void
  onDelete: (entry: HistoryEntry) => void
}

function historyRowTestId(url: string): string {
  return `history-row-${encodeURIComponent(url)}`
}

export function HistoryRow({
  entry,
  isActive,
  rowRef,
  onActivate,
  onDelete
}: HistoryRowProps): React.JSX.Element {
  const [faviconFailed, setFaviconFailed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const title = suggestProjectName(entry.title, entry.url)

  return (
    <div
      className={cn(
        'group/history-row flex min-w-0 items-stretch rounded-md',
        isActive && 'bg-white/10',
        !isActive && 'hover:bg-white/10 focus-within:bg-white/10'
      )}
    >
      <button
        ref={rowRef}
        type="button"
        data-testid={historyRowTestId(entry.url)}
        data-history-active={isActive ? 'true' : 'false'}
        className={cn(
          'flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-2 text-left transition-colors focus-visible:outline-none'
        )}
        onClick={() => onActivate(entry)}
      >
        {entry.faviconUrl && !faviconFailed ? (
          <img
            src={entry.faviconUrl}
            alt=""
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 rounded-sm"
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <Icon
            aria-hidden
            icon={Globe02Icon}
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{entry.url}</span>
        </span>
      </button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              data-testid={`${historyRowTestId(entry.url)}-menu`}
              aria-label={`History actions for ${title}`}
              className={cn(
                'my-1 mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-background/60 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none',
                menuOpen
                  ? 'opacity-100'
                  : 'opacity-0 group-hover/history-row:opacity-100 group-focus-within/history-row:opacity-100'
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <Icon aria-hidden icon={MoreHorizontalIcon} className="size-4" />
            </button>
          }
        />
        <DropdownMenuContent align="end" side="right">
          <DropdownMenuItem
            variant="destructive"
            data-testid={`${historyRowTestId(entry.url)}-delete`}
            onClick={() => onDelete(entry)}
          >
            <Icon icon={Delete02Icon} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
