import { useRef, useState } from 'react'
import { Globe02Icon } from '@hugeicons/core-free-icons'
import type { IndexingIntent } from '../../../../shared/seo-audit'
import type { HistoryEntry } from '../../../../shared/history'
import { suggestProjectName } from '../../../../shared/project'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { cn } from '@renderer/lib/utils'
import type { SeoAuditPresentation } from '@renderer/hooks/use-seo-audit-presentation'
import { CARD, PRESSABLE } from './lib/styles'
import { INTENT_OPTIONS } from './lib/finding-format'

const HISTORY_MAX_SUGGESTIONS = 8

// Same match rule as the browser URL bar: substring on URL or title, most
// recent first, capped to a short list.
function filterHistory(history: HistoryEntry[], query: string): HistoryEntry[] {
  const trimmed = query.trim().toLowerCase()
  const matches = trimmed
    ? history.filter(
        (entry) =>
          entry.url.toLowerCase().includes(trimmed) || entry.title.toLowerCase().includes(trimmed)
      )
    : history
  return matches.slice(0, HISTORY_MAX_SUGGESTIONS)
}

// Accept bare hosts (example.com) by assuming https, and reject anything that
// isn't a real URL so the audit never navigates to a search query or garbage.
function normalizeUrlEntry(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const candidate = /^[a-z][\w+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(candidate)
    if (!parsed.hostname) return null
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    if (!isLocal && !parsed.hostname.includes('.')) return null
    return parsed.toString()
  } catch {
    return null
  }
}

function Spinner(): React.JSX.Element {
  return (
    <span
      aria-hidden
      className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  )
}

type AuditControlsProps = Pick<
  SeoAuditPresentation,
  | 'url'
  | 'intent'
  | 'running'
  | 'job'
  | 'result'
  | 'history'
  | 'handleNavigate'
  | 'handleIntentChange'
  | 'handleRun'
  | 'handleCancel'
>

export function AuditControls({
  url,
  intent,
  running,
  job,
  result,
  history,
  handleNavigate,
  handleIntentChange,
  handleRun,
  handleCancel
}: AuditControlsProps): React.JSX.Element {
  const [draft, setDraft] = useState(url)
  const [urlError, setUrlError] = useState('')
  const [focused, setFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Keep the editable bar in sync when the pane navigates on its own, without a
  // sync-in-effect: adjust state during render when the committed URL changes.
  const [lastUrl, setLastUrl] = useState(url)
  if (url !== lastUrl) {
    setLastUrl(url)
    setDraft(url)
    setUrlError('')
  }

  const suggestions = filterHistory(history, draft)
  const historyOpen = focused && suggestions.length > 0

  const submitUrl = (): void => {
    const normalized = normalizeUrlEntry(draft)
    if (!normalized) {
      setUrlError('Enter a valid URL, e.g. https://example.com')
      return
    }
    setUrlError('')
    handleNavigate(normalized)
  }

  const chooseHistory = (entry: HistoryEntry): void => {
    setDraft(entry.url)
    setUrlError('')
    setActiveIndex(-1)
    setFocused(false)
    handleNavigate(entry.url)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!historyOpen) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, -1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      chooseHistory(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setFocused(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div className={cn(CARD, 'relative z-20 px-3 py-3')}>
      {/* Grouped URL bar + indexing intent + run action */}
      <div className="relative">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submitUrl()
          }}
          className={cn(
            'flex items-stretch overflow-hidden rounded-lg border bg-transparent transition-colors focus-within:ring-3',
            urlError
              ? 'border-destructive focus-within:border-destructive focus-within:ring-destructive/30'
              : 'border-input/50 focus-within:border-ring focus-within:ring-ring/50'
          )}
        >
          <div className="relative flex min-w-0 flex-1 items-center">
            <Icon
              aria-hidden
              icon={Globe02Icon}
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="seo-target-url"
              data-testid="seo-target-url"
              type="text"
              aria-label="Target page URL"
              aria-invalid={urlError ? true : undefined}
              aria-describedby={urlError ? 'seo-target-url-error' : undefined}
              spellCheck={false}
              autoComplete="off"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                setActiveIndex(-1)
                if (urlError) setUrlError('')
              }}
              onFocus={() => {
                if (blurTimeout.current) clearTimeout(blurTimeout.current)
                setFocused(true)
              }}
              onBlur={() => {
                blurTimeout.current = setTimeout(() => setFocused(false), 120)
              }}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com"
              className="h-8 flex-1 rounded-none border-0 bg-transparent pl-8 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
          <Select
            value={intent}
            onValueChange={(value) => handleIntentChange(value as IndexingIntent)}
          >
            <SelectTrigger
              data-testid="seo-intent-select"
              aria-label="Indexing intent"
              className="h-8 w-40 shrink-0 rounded-none border-y-0 border-r-0 border-l border-l-input bg-transparent focus-visible:border-l-input focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false} className="min-w-72">
              <p className="border-b border-white/10 px-2 py-2 text-[11px] leading-relaxed text-muted-foreground">
                How you expect search engines to treat this page. It changes how discoverability
                findings are judged, not which checks run — indexable flags missing signals,
                non-indexable expects a noindex, local / private relaxes crawler checks.
              </p>
              {INTENT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {running ? (
            <Button
              type="button"
              variant="outline"
              data-testid="seo-cancel-audit"
              className={cn(PRESSABLE, 'shrink-0 rounded-none')}
              onClick={handleCancel}
            >
              <Spinner />
              Cancel audit
            </Button>
          ) : (
            <Button
              type="button"
              variant="solid"
              color="neutral"
              data-testid="seo-run-audit"
              className={cn(PRESSABLE, 'shrink-0 rounded-none')}
              onClick={handleRun}
            >
              {result ? 'Run audit again' : 'Run audit'}
            </Button>
          )}
        </form>

        {historyOpen ? (
          <ul
            data-testid="seo-url-history"
            className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-white/10 bg-popover p-1 shadow-md ring-1 ring-foreground/10"
          >
            {suggestions.map((entry, index) => (
              <li key={entry.url}>
                <button
                  type="button"
                  data-testid="seo-url-history-item"
                  // Keep the input from blurring before the click registers.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseHistory(entry)}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    index === activeIndex ? 'bg-white/10 text-foreground' : 'hover:bg-white/10'
                  )}
                >
                  <HistoryFavicon faviconUrl={entry.faviconUrl} />
                  <span className="min-w-0 max-w-[45%] shrink-0 truncate font-medium">
                    {suggestProjectName(entry.title, entry.url)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
                    {entry.url}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {urlError ? (
        <p
          id="seo-target-url-error"
          data-testid="seo-url-error"
          role="alert"
          className="mt-1.5 text-xs text-destructive"
        >
          {urlError}
        </p>
      ) : null}

      {job.phase === 'cancelled' ? (
        <p data-testid="seo-cancelled" className="mt-3 text-xs text-amber-400">
          Audit cancelled.
        </p>
      ) : null}
      {job.phase === 'failed' ? (
        <p
          data-testid="seo-failed"
          className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
        >
          The audit could not finish. The page may have changed or could not be read.
        </p>
      ) : null}

      {result ? (
        <>
          {job.stale ? (
            <div
              data-testid="seo-stale-banner"
              className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-400"
            >
              This result may be out of date — the page has navigated or reloaded since the audit
              ran.
            </div>
          ) : null}
          {job.incomplete ? (
            <div
              data-testid="seo-incomplete-banner"
              className="mt-3 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/50"
            >
              This result is incomplete — the audit was interrupted before every check ran.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function HistoryFavicon({ faviconUrl }: { faviconUrl: string | null }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (faviconUrl && !failed) {
    return (
      <img
        src={faviconUrl}
        alt=""
        aria-hidden="true"
        className="size-4 shrink-0 rounded-sm"
        onError={() => setFailed(true)}
      />
    )
  }
  return <Icon aria-hidden icon={Globe02Icon} className="size-4 shrink-0 text-muted-foreground" />
}
