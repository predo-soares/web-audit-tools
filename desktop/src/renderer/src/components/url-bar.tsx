import { FormEvent, useEffect, useState } from 'react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Globe, RefreshCw } from 'lucide-react'

interface UrlBarProps {
  value: string
  pageTitle: string
  faviconUrl: string | null
  onChange: (url: string) => void
  onNavigate: (url: string) => void
  onRefresh: () => void
  disabled?: boolean
}

export function UrlBar({
  value,
  pageTitle,
  faviconUrl,
  onChange,
  onNavigate,
  onRefresh,
  disabled
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
    <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={handleSubmit}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        data-testid="url-refresh"
        aria-label="Refresh"
        onClick={() => void onRefresh()}
        disabled={disabled}
      >
        <RefreshCw />
      </Button>
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
          className="min-w-0 flex-1 pr-60 pl-9"
        />
        {pageTitle ? (
          <span className="pointer-events-none absolute top-1/2 right-4 z-10 max-w-56 -translate-y-1/2 truncate text-sm text-muted-foreground/70">
            {pageTitle}
          </span>
        ) : null}
      </div>
      <Button type="submit" data-testid="url-submit" disabled={disabled}>
        Go
      </Button>
    </form>
  )
}
