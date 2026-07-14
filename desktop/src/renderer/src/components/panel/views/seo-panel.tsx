import { useCallback, useEffect, useRef, useState } from 'react'
import { TOOLBAR_HEIGHT_PX } from '../../../../../shared/sidebar'
import {
  CATEGORY_LABEL,
  INDEXING_INTENT_LABEL,
  OUTCOME_LABEL,
  SEO_PANEL_WIDTH_PX,
  inferIndexingIntent,
  isAuditableUrl,
  type AuditResult,
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
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
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

  const auditable = isAuditableUrl(url)

  const handleRun = useCallback(async (): Promise<void> => {
    setRunning(true)
    try {
      const run = await window.panelApi.runSeoAudit(intent)
      if (run.ok) setResult(run.result)
    } finally {
      setRunning(false)
    }
  }, [intent])

  const handleIntentChange = useCallback((next: IndexingIntent): void => {
    intentTouchedRef.current = true
    setIntent(next)
  }, [])

  return (
    <aside
      id="seo-panel"
      data-testid="seo-panel"
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

            <button
              type="button"
              data-testid="seo-run-audit"
              disabled={running}
              className={cn(
                'mt-3 w-full rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-foreground transition-colors',
                'hover:bg-white/15 disabled:opacity-50'
              )}
              onClick={() => void handleRun()}
            >
              {running ? 'Running audit…' : 'Run audit'}
            </button>
          </section>

          {result ? (
            <section data-testid="seo-result" className="px-3 py-3">
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {result.findings.length} finding{result.findings.length === 1 ? '' : 's'}
                </span>
                <span data-testid="seo-catalog-version">Rules {result.ruleCatalogVersion}</span>
              </div>
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
