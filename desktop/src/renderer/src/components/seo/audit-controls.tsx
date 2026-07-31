import { useState } from 'react'
import type { IndexingIntent } from '../../../../shared/seo-audit'
import { Button } from '@renderer/components/ui/button'
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

type AuditControlsProps = Pick<
  SeoAuditPresentation,
  | 'url'
  | 'intent'
  | 'running'
  | 'job'
  | 'result'
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
  handleNavigate,
  handleIntentChange,
  handleRun,
  handleCancel
}: AuditControlsProps): React.JSX.Element {
  const [draft, setDraft] = useState(url)
  // Keep the editable bar in sync when the pane navigates on its own, without a
  // sync-in-effect: adjust state during render when the committed URL changes.
  const [lastUrl, setLastUrl] = useState(url)
  if (url !== lastUrl) {
    setLastUrl(url)
    setDraft(url)
  }

  return (
    <div className={cn(CARD, 'px-5 py-4')}>
      {/* Grouped URL + indexing intent + run action */}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleNavigate(draft)
        }}
        className="flex items-stretch overflow-hidden rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
      >
        <Input
          id="seo-target-url"
          data-testid="seo-target-url"
          type="text"
          aria-label="Target page URL"
          spellCheck={false}
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="https://example.com"
          className="h-8 flex-1 rounded-none border-0 bg-transparent focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
        />
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
          <SelectContent>
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

      {/* Status + banners */}
      {running ? (
        <p data-testid="seo-running" className="mt-3 text-xs text-white/55">
          Running audit…
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
