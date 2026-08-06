import { FormEvent, useEffect, useState, KeyboardEvent } from 'react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { SaveProjectButton } from '@renderer/components/save-project-button'
import { cn } from '@renderer/lib/utils'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Globe02Icon,
  RefreshCw,
  StopIcon
} from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'

interface UrlBarProps {
  value: string
  pageTitle: string
  faviconUrl: string | null
  onChange: (url: string) => void
  onNavigate: (url: string) => void
  onRefresh: () => void
  onStop: () => void
  onFocusInput?: () => void
  onBlurInput?: () => void
  onKeyDownInput?: (event: KeyboardEvent<HTMLInputElement>) => void
  canGoBack: boolean
  canGoForward: boolean
  onBack: () => void
  onForward: () => void
  loading?: boolean
  disabled?: boolean
  canSaveProject: boolean
  isSavedProject: boolean
  saveSuggestedName: string
  onSaveProject: (name: string) => void
  containerRef?: React.Ref<HTMLFormElement>
  className?: string
}

export function UrlBar({
  value,
  pageTitle,
  faviconUrl,
  onChange,
  onNavigate,
  onRefresh,
  onStop,
  onFocusInput,
  onBlurInput,
  onKeyDownInput,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  loading = false,
  disabled,
  canSaveProject,
  isSavedProject,
  saveSuggestedName,
  onSaveProject,
  containerRef,
  className
}: UrlBarProps): React.JSX.Element {
  const [faviconFailed, setFaviconFailed] = useState(false)

  useEffect(() => {
    setFaviconFailed(false)
    if (faviconUrl) {
      console.debug('[favicon]', JSON.stringify({ action: 'url-bar:render', faviconUrl }))
    }
  }, [faviconUrl])

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault()
    if (!value.trim()) return
    onNavigate(value)
  }

  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-1', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        data-testid="toolbar-back"
        aria-label="Back"
        aria-keyshortcuts="Meta+["
        className="text-muted-foreground"
        disabled={!canGoBack || disabled}
        onClick={onBack}
      >
        <Icon icon={ArrowLeft01Icon} size={14} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        data-testid="toolbar-forward"
        aria-label="Forward"
        aria-keyshortcuts="Meta+]"
        className="text-muted-foreground"
        disabled={!canGoForward || disabled}
        onClick={onForward}
      >
        <Icon icon={ArrowRight01Icon} size={14} />
      </Button>
      <form
        ref={containerRef}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-black/50 focus-within:bg-black/10 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
        onSubmit={handleSubmit}
      >
        <div className="relative min-w-0 flex-1 flex items-center pr-1">
          {faviconUrl && !faviconFailed ? (
            <img
              src={faviconUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2 z-10 size-4.5 -translate-y-1/2 rounded-sm"
              onLoad={() => {
                console.debug('[favicon]', JSON.stringify({ action: 'url-bar:load', faviconUrl }))
              }}
              onError={() => {
                console.debug(
                  '[favicon]',
                  JSON.stringify({
                    action: 'url-bar:error',
                    faviconUrl,
                    hint: 'img failed to load'
                  })
                )
                setFaviconFailed(true)
              }}
            />
          ) : (
            <Icon
              aria-hidden
              icon={Globe02Icon}
              className="pointer-events-none absolute top-1/2 left-2 z-10 size-4.5 -translate-y-1/2 text-muted-foreground"
            />
          )}
          <Input
            data-testid="url-input"
            type="text"
            placeholder="Enter a URL"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onFocusInput}
            onBlur={onBlurInput}
            onKeyDown={onKeyDownInput}
            disabled={disabled}
            className={cn(
              'min-w-0 flex-1 pl-9  border-none !bg-transparent focus-visible:ring-0',
              pageTitle ? 'pr-64' : 'pr-20'
            )}
            autoComplete="off"
            spellCheck={false}
          />
          {pageTitle ? (
            <span className="pointer-events-none absolute top-1/2 right-3 z-10 max-w-52 -translate-y-1/2 truncate text-sm text-muted-foreground/70">
              {pageTitle}
            </span>
          ) : null}
        </div>
        <button type="submit" data-testid="url-submit" className="sr-only" disabled={disabled}>
          Go
        </button>
      </form>
      <SaveProjectButton
        disabled={!canSaveProject}
        isSaved={isSavedProject}
        suggestedName={saveSuggestedName}
        onSave={onSaveProject}
        className=""
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        data-testid={loading ? 'url-stop' : 'url-refresh'}
        aria-label={loading ? 'Stop loading' : 'Refresh'}
        className=" text-muted-foreground"
        onClick={() => void (loading ? onStop() : onRefresh())}
        disabled={disabled && !loading}
      >
        <Icon icon={loading ? StopIcon : RefreshCw} size={14} />
      </Button>
    </div>
  )
}
