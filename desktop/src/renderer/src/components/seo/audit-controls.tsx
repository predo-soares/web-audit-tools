import type { IndexingIntent } from '../../../../shared/seo-audit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { TargetUrlBar } from '@renderer/components/target-url-bar'
import { cn } from '@renderer/lib/utils'
import type { SeoAuditPresentation } from '@renderer/hooks/use-seo-audit-presentation'
import { CARD } from './lib/styles'
import { INTENT_OPTIONS } from './lib/finding-format'

const SEO_URL_BAR_TEST_IDS = {
  input: 'seo-target-url',
  run: 'seo-run-audit',
  cancel: 'seo-cancel-audit',
  error: 'seo-url-error',
  history: 'seo-url-history',
  historyItem: 'seo-url-history-item'
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
  return (
    <div className={cn(CARD, 'relative z-20 px-3 py-3')}>
      <TargetUrlBar
        url={url}
        history={history}
        running={running}
        runLabel={result ? 'Run audit again' : 'Run audit'}
        onNavigate={handleNavigate}
        onRun={handleRun}
        onCancel={handleCancel}
        testIds={SEO_URL_BAR_TEST_IDS}
        middleSlot={
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
        }
      />

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
