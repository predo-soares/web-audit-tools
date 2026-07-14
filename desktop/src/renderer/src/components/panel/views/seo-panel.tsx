import { useCallback, useEffect, useRef, useState } from 'react'
import { TOOLBAR_HEIGHT_PX } from '../../../../../shared/sidebar'
import {
  CATEGORY_LABEL,
  IDLE_AUDIT_STATE,
  INDEXING_INTENT_LABEL,
  OUTCOME_LABEL,
  SEO_PANEL_WIDTH_PX,
  inferIndexingIntent,
  isAuditableUrl,
  type AuditJobState,
  type FindingOutcome,
  type IndexingIntent
} from '../../../../../shared/seo-audit'
import { cn } from '@renderer/lib/utils'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'

const OUTCOME_CLASS: Record<FindingOutcome, string> = {
  error: 'bg-destructive/15 text-destructive',
  warning: 'bg-amber-500/15 text-amber-500',
  opportunity: 'bg-sky-500/15 text-sky-500',
  passed: 'bg-emerald-500/15 text-emerald-500',
  'unable-to-verify': 'bg-white/10 text-muted-foreground'
}

const INTENT_OPTIONS: { label: string; value: IndexingIntent }[] = (
  ['indexable', 'non-indexable', 'local-private'] as IndexingIntent[]
).map((value) => ({ value, label: INDEXING_INTENT_LABEL[value] }))

export function SeoPanel(): React.JSX.Element {
  const [url, setUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [intent, setIntent] = useState<IndexingIntent>('indexable')
  // The audit job is owned by the main process; the panel is a view of its
  // broadcast state so closing/reopening restores progress instead of losing it.
  const [job, setJob] = useState<AuditJobState>(IDLE_AUDIT_STATE)
  // Once the user picks an intent, incoming navigations must not silently
  // re-infer it out from under them.
  const intentTouchedRef = useRef(false)

  const applyNavigation = useCallback((barUrl: string, title: string): void => {
    setUrl(barUrl)
    setPageTitle(title)
    if (!intentTouchedRef.current && isAuditableUrl(barUrl)) {
      setIntent(inferIndexingIntent(barUrl))
    }
  }, [])

  useEffect(() => {
    void window.panelApi.getNavigationState().then((state) => {
      applyNavigation(state.barUrl, state.pageTitle)
    })
    const unsubscribe = window.panelApi.onPaneNavigation((state) => {
      applyNavigation(state.barUrl, state.pageTitle)
    })
    return unsubscribe
  }, [applyNavigation])

  useEffect(() => {
    void window.panelApi.getSeoAuditState().then(setJob)
    return window.panelApi.onSeoAuditState(setJob)
  }, [])

  const auditable = isAuditableUrl(url)
  const running = job.phase === 'running'

  const handleRun = useCallback((): void => {
    void window.panelApi.runSeoAudit(intent)
  }, [intent])

  const handleCancel = useCallback((): void => {
    void window.panelApi.cancelSeoAudit()
  }, [])

  const handleIntentChange = useCallback((next: IndexingIntent): void => {
    intentTouchedRef.current = true
    setIntent(next)
  }, [])

  const { result } = job

  return (
    <aside
      id="seo-panel"
      data-testid="seo-panel"
      data-phase={job.phase}
      className="relative box-border flex h-screen min-h-screen shrink-0 flex-col overflow-hidden border-l border-white/10 bg-background text-foreground"
      style={{ width: SEO_PANEL_WIDTH_PX }}
    >
      <header
        className="flex items-center gap-2 border-b border-white/10 px-3 py-2"
        style={{ paddingTop: TOOLBAR_HEIGHT_PX }}
      >
        <h2 className="text-sm font-semibold">Page SEO</h2>
      </header>

      {!auditable ? (
        <div
          data-testid="seo-empty"
          className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground"
        >
          Nothing to audit yet — load a page in the panes, then run an audit.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="border-b border-white/10 px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Target page
            </p>
            {pageTitle ? (
              <p data-testid="seo-target-title" className="mt-1 truncate text-sm text-foreground">
                {pageTitle}
              </p>
            ) : null}
            <p
              data-testid="seo-target-url"
              className="truncate text-xs text-muted-foreground"
              title={url}
            >
              {url}
            </p>

            <div className="mt-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Indexing intent
              </p>
              <SegmentedControl
                ariaLabel="Indexing intent"
                options={INTENT_OPTIONS}
                value={intent}
                onChange={handleIntentChange}
              />
            </div>

            {running ? (
              <button
                type="button"
                data-testid="seo-cancel-audit"
                className={cn(
                  'mt-3 w-full rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-foreground transition-colors',
                  'hover:bg-white/15'
                )}
                onClick={handleCancel}
              >
                Cancel audit
              </button>
            ) : (
              <button
                type="button"
                data-testid="seo-run-audit"
                className={cn(
                  'mt-3 w-full rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-foreground transition-colors',
                  'hover:bg-white/15'
                )}
                onClick={handleRun}
              >
                {result ? 'Run audit again' : 'Run audit'}
              </button>
            )}

            {running ? (
              <p data-testid="seo-running" className="mt-2 text-xs text-muted-foreground">
                Running audit…
              </p>
            ) : null}
            {job.phase === 'cancelled' ? (
              <p data-testid="seo-cancelled" className="mt-2 text-xs text-amber-500">
                Audit cancelled.
              </p>
            ) : null}
            {job.phase === 'failed' ? (
              <p data-testid="seo-failed" className="mt-2 text-xs text-destructive">
                The audit could not finish. The page may have changed or could not be read.
              </p>
            ) : null}
          </section>

          {result ? (
            <section data-testid="seo-result" className="px-3 py-3">
              {job.stale ? (
                <div
                  data-testid="seo-stale-banner"
                  className="mb-2 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-500"
                >
                  This result may be out of date — the page has navigated or reloaded since the
                  audit ran.
                </div>
              ) : null}
              {job.incomplete ? (
                <div
                  data-testid="seo-incomplete-banner"
                  className="mb-2 rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-muted-foreground"
                >
                  This result is incomplete — the audit was interrupted before every check ran.
                </div>
              ) : null}
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {result.findings.length} finding{result.findings.length === 1 ? '' : 's'}
                </span>
                <span data-testid="seo-catalog-version">Rules {result.ruleCatalogVersion}</span>
              </div>
              <section
                data-testid="seo-search-preview"
                className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
              >
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Representative search preview
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {result.searchAppearance.resolved.favicon.value ? (
                    <img
                      data-testid="seo-preview-favicon"
                      src={result.searchAppearance.resolved.favicon.value}
                      alt=""
                      className="size-4 rounded-sm"
                    />
                  ) : (
                    <span className="size-4 rounded-full bg-white/10" aria-hidden="true" />
                  )}
                  <span data-testid="seo-preview-url" className="truncate">
                    {result.searchAppearance.resolved.canonical.value ?? result.url}
                  </span>
                </div>
                <p
                  data-testid="seo-preview-title"
                  className="mt-1.5 line-clamp-1 text-base font-medium text-sky-400"
                >
                  {result.searchAppearance.resolved.title.value ?? result.url}
                </p>
                <p
                  data-testid="seo-preview-description"
                  className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground"
                >
                  {result.searchAppearance.resolved.description.value ??
                    'No meta description is available for this preview.'}
                </p>
                <p
                  data-testid="seo-preview-measurements"
                  className="mt-2 text-[10px] text-muted-foreground"
                >
                  Title {result.searchAppearance.measurements.titleCharacters} characters
                  {result.searchAppearance.measurements.titleWidthPx === null
                    ? ''
                    : ` / ${result.searchAppearance.measurements.titleWidthPx}px`}
                  {' · '}Description {result.searchAppearance.measurements.descriptionCharacters}{' '}
                  characters
                  {result.searchAppearance.measurements.descriptionWidthPx === null
                    ? ''
                    : ` / ${result.searchAppearance.measurements.descriptionWidthPx}px`}
                </p>
              </section>

              <details className="mb-3 rounded-md border border-white/10 p-2.5">
                <summary className="cursor-pointer text-xs font-medium text-foreground">
                  Declared and resolved metadata
                </summary>
                <div data-testid="seo-resolved-metadata" className="mt-2 space-y-1 text-xs">
                  {Object.entries(result.searchAppearance.resolved).map(([kind, resolved]) => (
                    <div key={kind} data-metadata-kind={kind}>
                      <span className="capitalize text-muted-foreground">{kind}: </span>
                      <span>{resolved.value ?? 'Not resolved'}</span>
                      <p className="pl-2 text-[10px] text-muted-foreground">{resolved.reason}</p>
                    </div>
                  ))}
                </div>
                <ul
                  data-testid="seo-declared-metadata"
                  className="mt-2 space-y-1 border-t border-white/10 pt-2 text-xs"
                >
                  {result.searchAppearance.declared.map((declaration, index) => (
                    <li
                      key={`${declaration.origin}-${declaration.kind}-${declaration.order}-${index}`}
                    >
                      <span className="text-muted-foreground">
                        {declaration.origin} · {declaration.kind} #{declaration.order + 1}:{' '}
                      </span>
                      <span>{declaration.value || '(empty)'}</span>
                    </li>
                  ))}
                </ul>
              </details>
              <ul className="flex flex-col gap-2">
                {result.findings.map((finding) => (
                  <li
                    key={finding.ruleId}
                    data-testid="seo-finding"
                    data-outcome={finding.outcome}
                    data-rule-id={finding.ruleId}
                    className="rounded-md border border-white/10 p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        data-testid="seo-finding-outcome"
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          OUTCOME_CLASS[finding.outcome]
                        )}
                      >
                        {OUTCOME_LABEL[finding.outcome]}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {CATEGORY_LABEL[finding.category]}
                      </span>
                    </div>
                    <p data-testid="seo-finding-summary" className="mt-1.5 text-sm text-foreground">
                      {finding.summary}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{finding.impact}</p>
                    <p
                      data-testid="seo-finding-evidence"
                      className="mt-1.5 text-xs text-foreground/80"
                    >
                      <span className="text-muted-foreground">
                        {finding.evidence.origin === 'delivered' ? 'Delivered' : 'Rendered'}:{' '}
                      </span>
                      {finding.evidence.detail}
                    </p>
                    {finding.remediation ? (
                      <p
                        data-testid="seo-finding-remediation"
                        className="mt-1.5 text-xs text-sky-400"
                      >
                        {finding.remediation}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </aside>
  )
}
