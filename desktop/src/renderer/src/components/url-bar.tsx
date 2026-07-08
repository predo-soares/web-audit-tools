import { FormEvent, useEffect, useState } from 'react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { SaveProjectButton } from '@renderer/components/save-project-button'
import { cn } from '@renderer/lib/utils'
import { Globe, RefreshCw } from 'lucide-react'

interface UrlBarProps {
  value: string
  pageTitle: string
  faviconUrl: string | null
  onChange: (url: string) => void
  onNavigate: (url: string) => void
  onRefresh: () => void
  disabled?: boolean
  canSaveProject: boolean
  saveSuggestedName: string
  onSaveProject: (name: string) => void
}

export function UrlBar({
  value,
  pageTitle,
  faviconUrl,
  onChange,
  onNavigate,
  onRefresh,
  disabled,
  canSaveProject,
  saveSuggestedName,
  onSaveProject
}: UrlBarProps): React.JSX.Element {
  const [faviconFailed, setFaviconFailed] = useState(false)

  useEffect(() => {
    setFaviconFailed(false)
  }, [faviconUrl])

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault()
    if (!value.trim()) return
    onNavigate(value)
  }

  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-2  bg-white/20 rounded-lg"
      onSubmit={handleSubmit}
    >
      <div className="relative min-w-0 flex-1">
        {faviconUrl && !faviconFailed ? (
          <img
            src={faviconUrl}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 rounded-sm"
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <Globe
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
          />
        )}
        <Input
          data-testid="url-input"
          type="text"
          placeholder="Enter a URL"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={cn(
            'min-w-0 flex-1 pl-9 focus-visible:bg-white/10',
            pageTitle ? 'pr-64' : 'pr-20'
          )}
        />
        {pageTitle ? (
          <span className="pointer-events-none absolute top-1/2 right-16 z-10 max-w-52 -translate-y-1/2 truncate text-sm text-muted-foreground/70">
            {pageTitle}
          </span>
        ) : null}
        <SaveProjectButton
          disabled={!canSaveProject || disabled}
          suggestedName={saveSuggestedName}
          onSave={onSaveProject}
          className="absolute top-1/2 right-8 z-10 -translate-y-1/2"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          data-testid="url-refresh"
          aria-label="Refresh"
          className="absolute top-1/2 right-1 z-10 -translate-y-1/2 text-muted-foreground"
          onClick={() => void onRefresh()}
          disabled={disabled}
        >
          <RefreshCw />
        </Button>
      </div>
      <button type="submit" data-testid="url-submit" className="sr-only" disabled={disabled}>
        Go
      </button>
    </form>
  )
}
