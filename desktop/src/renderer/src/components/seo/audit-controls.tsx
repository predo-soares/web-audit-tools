import { InformationCircleIcon } from '@hugeicons/core-free-icons'
import { auditMarkdown } from '../../../../shared/seo-markdown'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/lib/utils'
import type { SeoAuditPresentation } from '@renderer/hooks/use-seo-audit-presentation'
import { CARD, PRESSABLE, SUBLABEL } from './lib/styles'
import { INTENT_OPTIONS } from './lib/finding-format'

type AuditControlsProps = Pick<
  SeoAuditPresentation,
  | 'url'
  | 'pageTitle'
  | 'intent'
  | 'running'
  | 'job'
  | 'result'
  | 'copied'
  | 'exportStatus'
  | 'handleIntentChange'
  | 'handleRun'
  | 'handleCancel'
  | 'copyMarkdown'
  | 'exportWithSnapshot'
>

export function AuditControls({
  url,
  pageTitle,
  intent,
  running,
  job,
  result,
  copied,
  exportStatus,
  handleIntentChange,
  handleRun,
  handleCancel,
  copyMarkdown,
  exportWithSnapshot
}: AuditControlsProps): React.JSX.Element {
  return (
    <div className={cn(CARD, 'px-5 py-4')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-white">Page SEO audit</h1>
          {url ? (
            <p className="mt-1 truncate text-xs text-white/45" title={url}>
              {pageTitle ? `${pageTitle} — ` : ''}
              <span data-testid="seo-target-url">{url}</span>
            </p>
          ) : null}
        </div>
        {running ? (
          <Button
            type="button"
            variant="outline"
            data-testid="seo-cancel-audit"
            className={PRESSABLE}
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
            className={PRESSABLE}
            onClick={handleRun}
          >
            {result ? 'Run audit again' : 'Run audit'}
          </Button>
        )}
      </div>

      {/* Indexing intent */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center gap-1.5">
          <p className={SUBLABEL}>Indexing intent</p>
          <Tooltip>
            <TooltipTrigger
              type="button"
              aria-label="What is indexing intent?"
              className="flex text-white/30 outline-none transition-colors hover:text-white/70 focus-visible:text-white/70"
            >
              <Icon icon={InformationCircleIcon} size={13} />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-xs whitespace-normal text-left leading-relaxed"
            >
              Tells the audit how you expect search engines to treat this page, so discoverability
              findings are judged against your goal — it changes how results are interpreted, not
              which checks run. Indexable: should appear in search, so missing or blocking signals
              are flagged. Non-indexable: intentionally hidden (e.g. thank-you pages), so a noindex
              is expected rather than an error. Local / private: a dev or internal environment, so
              crawler-facing checks are relaxed.
            </TooltipContent>
          </Tooltip>
        </div>
        <SegmentedControl
          ariaLabel="Indexing intent"
          options={INTENT_OPTIONS}
          value={intent}
          onChange={handleIntentChange}
        />
      </div>

      {/* Status + banners */}
      {running ? (
        <p data-testid="seo-running" className="mt-3 text-xs text-white/45">
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <span className="text-[11px] text-white/40">
              {result.findings.length} finding{result.findings.length === 1 ? '' : 's'} ·{' '}
              <span data-testid="seo-catalog-version">v{result.ruleCatalogVersion}</span>
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                color="blue"
                size="tiny"
                data-testid="seo-copy-result"
                className={PRESSABLE}
                onClick={() => copyMarkdown(auditMarkdown(result), 'complete result')}
              >
                Copy result
              </Button>
              <Button
                type="button"
                variant="outline"
                color="blue"
                size="tiny"
                data-testid="seo-export-snapshot"
                className={PRESSABLE}
                onClick={exportWithSnapshot}
              >
                Export snapshot
              </Button>
            </div>
          </div>
          {exportStatus ? (
            <p
              data-testid="seo-export-status"
              role="status"
              className="mt-1.5 text-[10px] text-white/40"
            >
              {exportStatus}
            </p>
          ) : null}
          {copied ? (
            <p
              data-testid="seo-copy-status"
              role="status"
              className="mt-1.5 text-[10px] text-emerald-400"
            >
              Copied {copied} as agent-ready Markdown.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
