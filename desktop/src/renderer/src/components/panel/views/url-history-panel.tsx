import { useState } from 'react'
import { Globe02Icon } from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/lib/utils'
import type { PanelAction, UrlHistoryPanelPayload } from '../../../../../shared/panel-types'
import { suggestProjectName } from '../../../../../shared/project'

export function UrlHistoryPanel({
  payload,
  onAction
}: {
  payload?: UrlHistoryPanelPayload
  onAction: (action: PanelAction) => void
}): React.JSX.Element {
  if (!payload || payload.items.length === 0) return <></>

  return (
    <div className="flex w-full flex-col gap-0.5 py-0.5">
      {payload.items.map((entry, index) => (
        <HistoryItem
          key={entry.url}
          url={entry.url}
          title={entry.title}
          faviconUrl={entry.faviconUrl}
          active={index === payload.activeIndex}
          onSelect={() => onAction({ type: 'navigate', url: entry.url })}
        />
      ))}
    </div>
  )
}

function HistoryItem({
  url,
  title,
  faviconUrl,
  active,
  onSelect
}: {
  url: string
  title: string
  faviconUrl: string | null
  active: boolean
  onSelect: () => void
}): React.JSX.Element {
  const [faviconFailed, setFaviconFailed] = useState(false)
  const displayTitle = suggestProjectName(title, url)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-white/10 text-foreground' : 'text-foreground hover:bg-white/10'
      )}
    >
      {faviconUrl && !faviconFailed ? (
        <img
          src={faviconUrl}
          alt=""
          aria-hidden="true"
          className="size-4 shrink-0 rounded-sm"
          onError={() => setFaviconFailed(true)}
        />
      ) : (
        <Icon aria-hidden icon={Globe02Icon} className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{displayTitle}</span>
      <span className="shrink-0 truncate text-xs text-muted-foreground max-w-[24ch]">{url}</span>
    </button>
  )
}
