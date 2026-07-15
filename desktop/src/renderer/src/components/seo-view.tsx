import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../shared/sidebar'
import { useSidebar } from '@renderer/context/sidebar-context'
import {
  CATEGORY_LABEL,
  INDEXING_INTENT_LABEL,
  OUTCOME_LABEL,
  type AuditCategory,
  type FindingOutcome,
  type IndexingIntent
} from '../../../shared/seo-audit'
import { cn } from '@renderer/lib/utils'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { auditMarkdown } from '../../../shared/seo-markdown'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'
import { useSeoAuditPresentation } from '@renderer/hooks/use-seo-audit-presentation'

const CATEGORIES = Object.keys(CATEGORY_LABEL) as AuditCategory[]
const OUTCOMES = Object.keys(OUTCOME_LABEL) as FindingOutcome[]

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

export function SeoView({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const sidebarOffset = sidebarOpen || sidebarTransitioning ? SIDEBAR_WIDTH_PX : 0
  const {
    url,
    pageTitle,
    intent,
    auditable,
    job,
    result,
    running,
    linkFilter,
    setLinkFilter,
    findingCategory,
    setFindingCategory,
    findingOutcome,
    setFindingOutcome,
    copied,
    exportStatus,
    handleIntentChange,
    handleRun,
    handleCancel,
    copyMarkdown,
    exportWithSnapshot
  } = useSeoAuditPresentation(window.api)

  return (
    <div
      data-testid="seo-view"
      className="box-border flex h-screen min-h-screen flex-col overflow-hidden bg-background text-foreground"
      style={{ paddingTop: TOOLBAR_HEIGHT_PX, paddingLeft: sidebarOffset }}
    >
      {/* Sub-header: sits just below the toolbar overlay */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2">
        <button
          type="button"
          data-testid="seo-view-back"
          onClick={onClose}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors',
            'hover:bg-white/5 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
          )}
        >
          <Icon icon={ArrowLeft01Icon} size={14} />
          Browser
        </button>
        <div className="h-4 w-px bg-white/10" />
        <h1 className="text-sm font-semibold">SEO</h1>
        {url ? (
          <p className="truncate text-xs text-muted-foreground" title={url}>
            {pageTitle ? `${pageTitle} — ` : ''}{url}
          </p>
        ) : null}
      </header>

      {/* Body */}
      {!auditable ? (
        <div
          data-testid="seo-view-empty"
          className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground"
        >
          Nothing to audit yet — load a page in the browser view, then come back to run an audit.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Left column — controls */}
          <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/10 p-4">
            {/* Intent */}
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Indexing intent
              </p>
              <SegmentedControl
                ariaLabel="Indexing intent"
                options={INTENT_OPTIONS}
                value={intent}
                onChange={handleIntentChange}
              />
            </div>

            {/* Run / cancel */}
            {running ? (
              <button
                type="button"
                data-testid="seo-cancel-audit"
                className={cn(
                  'w-full rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-foreground transition-colors',
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
                  'w-full rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-foreground transition-colors',
                  'hover:bg-white/15'
                )}
                onClick={handleRun}
              >
                {result ? 'Run audit again' : 'Run audit'}
              </button>
            )}

            {running ? (
              <p data-testid="seo-running" className="text-xs text-muted-foreground">
                Running audit…
              </p>
            ) : null}
            {job.phase === 'cancelled' ? (
              <p data-testid="seo-cancelled" className="text-xs text-amber-500">
                Audit cancelled.
              </p>
            ) : null}
            {job.phase === 'failed' ? (
              <p data-testid="seo-failed" className="text-xs text-destructive">
                The audit could not finish. The page may have changed or could not be read.
              </p>
            ) : null}

            {result ? (
              <>
                {/* Stale / incomplete banners */}
                {job.stale ? (
                  <div
                    data-testid="seo-stale-banner"
                    className="rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-500"
                  >
                    This result may be out of date — the page has navigated or reloaded since the
                    audit ran.
                  </div>
                ) : null}
                {job.incomplete ? (
                  <div
                    data-testid="seo-incomplete-banner"
                    className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-muted-foreground"
                  >
                    This result is incomplete — the audit was interrupted before every check ran.
                  </div>
                ) : null}

                {/* Summary + export */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {result.findings.length} finding{result.findings.length === 1 ? '' : 's'}
                    </span>
                    <span data-testid="seo-catalog-version">v{result.ruleCatalogVersion}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      data-testid="seo-copy-result"
                      className="flex-1 rounded border border-white/10 px-2 py-1 text-xs text-sky-400 transition-colors hover:bg-white/5"
                      onClick={() => copyMarkdown(auditMarkdown(result), 'complete result')}
                    >
                      Copy result
                    </button>
                    <button
                      type="button"
                      data-testid="seo-export-snapshot"
                      onClick={exportWithSnapshot}
                      className="flex-1 rounded border border-white/10 px-2 py-1 text-xs text-sky-400 transition-colors hover:bg-white/5"
                    >
                      Export snapshot
                    </button>
                  </div>
                  {exportStatus ? (
                    <p
                      data-testid="seo-export-status"
                      role="status"
                      className="mt-1 text-[10px] text-muted-foreground"
                    >
                      {exportStatus}
                    </p>
                  ) : null}
                  {copied ? (
                    <p
                      data-testid="seo-copy-status"
                      role="status"
                      className="mt-1 text-[10px] text-emerald-500"
                    >
                      Copied {copied} as agent-ready Markdown.
                    </p>
                  ) : null}
                </div>

                {/* Outcome filters */}
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Filter by outcome
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {OUTCOMES.map((outcome) => (
                      <button
                        type="button"
                        key={outcome}
                        data-testid="seo-outcome-filter"
                        data-outcome={outcome}
                        aria-pressed={findingOutcome === outcome}
                        onClick={() =>
                          setFindingOutcome(findingOutcome === outcome ? null : outcome)
                        }
                        className={cn(
                          'rounded border border-white/10 px-1.5 py-1 text-[10px] transition-colors',
                          findingOutcome === outcome
                            ? OUTCOME_CLASS[outcome]
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {OUTCOME_LABEL[outcome]}{' '}
                        {result.findings.filter((item) => item.outcome === outcome).length}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category filters */}
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Filter by category
                  </p>
                  <div className="space-y-0.5">
                    {CATEGORIES.map((category) => (
                      <div key={category} data-testid="seo-category-row" className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-pressed={findingCategory === category}
                          onClick={() =>
                            setFindingCategory(findingCategory === category ? null : category)
                          }
                          className={cn(
                            'min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left text-[11px] transition-colors',
                            findingCategory === category
                              ? 'bg-white/10 text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {CATEGORY_LABEL[category]}{' '}
                          <span className="text-muted-foreground">
                            · {result.findings.filter((item) => item.category === category).length}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Copy ${CATEGORY_LABEL[category]} findings`}
                          onClick={() =>
                            copyMarkdown(
                              auditMarkdown(result, { category }),
                              CATEGORY_LABEL[category]
                            )
                          }
                          className="px-1 text-[10px] text-sky-400 transition-colors hover:text-sky-300"
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </aside>

          {/* Right column — findings + detail sections */}
          <main className="min-h-0 flex-1 overflow-y-auto">
            {!result ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Run an audit to see results.
              </div>
            ) : (
              <div className="mx-auto max-w-4xl space-y-6 p-6">
                {/* Findings */}
                <section data-testid="seo-result">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Findings
                  </h2>
                  <ul className="space-y-2">
                    {result.findings
                      .filter(
                        (finding) => !findingCategory || finding.category === findingCategory
                      )
                      .filter(
                        (finding) => !findingOutcome || finding.outcome === findingOutcome
                      )
                      .map((finding) => (
                        <li
                          key={finding.ruleId}
                          data-testid="seo-finding"
                          data-outcome={finding.outcome}
                          data-rule-id={finding.ruleId}
                          className="rounded-lg border border-white/10 p-4"
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
                            <span className="text-xs text-muted-foreground">
                              {CATEGORY_LABEL[finding.category]}
                            </span>
                            <code
                              data-testid="seo-finding-rule-id"
                              className="ml-auto text-[10px] text-muted-foreground"
                            >
                              {finding.ruleId}
                            </code>
                            <button
                              type="button"
                              aria-label={`Copy ${finding.ruleId} finding`}
                              onClick={() =>
                                copyMarkdown(auditMarkdown(result, { finding }), finding.ruleId)
                              }
                              className="text-[10px] text-sky-400 transition-colors hover:text-sky-300"
                            >
                              Copy
                            </button>
                          </div>
                          <p
                            data-testid="seo-finding-summary"
                            className="mt-2 text-sm text-foreground"
                          >
                            {finding.summary}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{finding.impact}</p>
                          <p
                            data-testid="seo-finding-evidence"
                            className="mt-2 text-xs text-foreground/80"
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
                    {result.findings.filter(
                      (f) =>
                        (!findingCategory || f.category === findingCategory) &&
                        (!findingOutcome || f.outcome === findingOutcome)
                    ).length === 0 ? (
                      <li className="rounded-lg border border-white/10 p-4 text-sm text-muted-foreground">
                        No findings match the current filters.
                      </li>
                    ) : null}
                  </ul>
                </section>

                {/* Search preview */}
                <section
                  data-testid="seo-search-preview"
                  className="rounded-lg border border-white/10 p-4"
                >
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Representative search preview
                  </h2>
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
                    className="mt-2 line-clamp-1 text-lg font-medium text-sky-400"
                  >
                    {result.searchAppearance.resolved.title.value ?? result.url}
                  </p>
                  <p
                    data-testid="seo-preview-description"
                    className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground"
                  >
                    {result.searchAppearance.resolved.description.value ??
                      'No meta description is available for this preview.'}
                  </p>
                  <p
                    data-testid="seo-preview-measurements"
                    className="mt-2 text-xs text-muted-foreground"
                  >
                    Title {result.searchAppearance.measurements.titleCharacters} chars
                    {result.searchAppearance.measurements.titleWidthPx === null
                      ? ''
                      : ` / ${result.searchAppearance.measurements.titleWidthPx}px`}
                    {' · '}Description {result.searchAppearance.measurements.descriptionCharacters}{' '}
                    chars
                    {result.searchAppearance.measurements.descriptionWidthPx === null
                      ? ''
                      : ` / ${result.searchAppearance.measurements.descriptionWidthPx}px`}
                  </p>
                </section>

                {/* Social cards */}
                <section data-testid="seo-social-previews" className="rounded-lg border border-white/10 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Social card previews
                    </h2>
                    <span className="text-xs text-amber-500">Representative approximation</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['Open Graph', result.socialSharing.resolved.openGraph, 'aspect-[1.91/1]'],
                      ['X summary', result.socialSharing.resolved.x, 'aspect-square'],
                      ['X large image', result.socialSharing.resolved.x, 'aspect-[1.91/1]'],
                      ['LinkedIn-style', result.socialSharing.resolved.openGraph, 'aspect-[1.91/1]'],
                      ['Messaging-style', result.socialSharing.resolved.openGraph, 'aspect-[1.6/1]']
                    ].map(([label, card, ratio]) => {
                      const metadata = card as typeof result.socialSharing.resolved.openGraph
                      return (
                        <article
                          key={label as string}
                          data-testid="seo-social-preview"
                          data-preview-kind={(label as string).toLowerCase().replaceAll(' ', '-')}
                          className="overflow-hidden rounded-md border border-white/10 bg-white/[0.03]"
                        >
                          <div className={cn('overflow-hidden bg-white/5', ratio as string)}>
                            {metadata.image.value ? (
                              <img
                                src={metadata.image.value}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="p-2">
                            <p className="text-[9px] uppercase text-muted-foreground">
                              {String(label)}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-xs font-medium">
                              {metadata.title.value ?? 'Untitled page'}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                              {metadata.description.value ?? 'No description'}
                            </p>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                  <details className="mt-3 rounded-md border border-white/10 p-2">
                    <summary className="cursor-pointer text-xs">Declared social metadata</summary>
                    <ul data-testid="seo-social-declarations" className="mt-2 space-y-1 text-[10px]">
                      {result.socialSharing.declared.map((item, index) => (
                        <li key={`${item.origin}-${item.property}-${item.order}-${index}`}>
                          <span className="text-muted-foreground">
                            {item.origin} · {item.property}:{' '}
                          </span>
                          {item.value || '(empty)'}
                        </li>
                      ))}
                    </ul>
                  </details>
                </section>

                {/* Structured data */}
                <section
                  data-testid="seo-structured-data"
                  className="rounded-lg border border-white/10 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Structured data
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {result.structuredData.entities.length} entities
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Search enhancement eligibility uses a versioned profile and does not guarantee a
                    rich result.
                  </p>
                  <div className="space-y-2">
                    {result.structuredData.sources.map((source) => (
                      <details
                        key={`${source.format}-${source.sourceIndex}`}
                        data-testid="seo-structured-source"
                        className="rounded-md border border-white/10 p-2"
                      >
                        <summary className="cursor-pointer text-xs">
                          {source.format.toUpperCase()} source {source.sourceIndex + 1}
                        </summary>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
                          {source.raw}
                        </pre>
                      </details>
                    ))}
                    {result.structuredData.entities.map((entity, index) => (
                      <details
                        key={`${entity.format}-${entity.sourceIndex}-${entity.path}-${index}`}
                        data-testid="seo-structured-entity"
                        className="rounded-md border border-white/10 p-2"
                      >
                        <summary className="cursor-pointer text-xs">
                          {entity.types.join(', ') || 'Untyped entity'}
                        </summary>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {entity.format} source {entity.sourceIndex + 1} · {entity.path}
                          {entity.id ? ` · ${entity.id}` : ''}
                        </p>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
                          {JSON.stringify(entity.properties, null, 2)}
                        </pre>
                      </details>
                    ))}
                  </div>
                  <ul className="mt-3 space-y-1 border-t border-white/10 pt-3">
                    {result.structuredData.enhancements.map((assessment, index) => (
                      <li
                        key={`${assessment.entityPath}-${assessment.type}-${index}`}
                        data-testid="seo-search-enhancement"
                        className="text-xs text-muted-foreground"
                      >
                        <span className="text-foreground">{assessment.type}</span> ·{' '}
                        {assessment.status.replaceAll('-', ' ')} · {assessment.profileVersion}
                        {assessment.missingRequired.length
                          ? ` · missing required: ${assessment.missingRequired.join(', ')}`
                          : ''}
                        {assessment.missingRecommended.length
                          ? ` · missing recommended: ${assessment.missingRecommended.join(', ')}`
                          : ''}
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Document structure */}
                <section
                  data-testid="seo-document-structure"
                  className="rounded-lg border border-white/10 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Document structure
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {result.documentStructure.visibleTextCharacters} text characters
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Language: {result.documentStructure.language.lang ?? 'not declared'} ·{' '}
                    {result.documentStructure.headings.filter((item) => item.visible).length} visible
                    headings ·{' '}
                    {result.documentStructure.landmarks.filter((item) => item.visible).length} visible
                    landmarks
                  </p>
                  <details className="mb-2 rounded-md border border-white/10 p-2">
                    <summary className="cursor-pointer text-xs">Rendered heading tree</summary>
                    <ol data-testid="seo-heading-tree" className="mt-2 space-y-1 text-[10px]">
                      {result.documentStructure.headings.map((heading) => (
                        <li
                          key={heading.sourceIndex}
                          style={{ paddingLeft: (heading.level - 1) * 8 }}
                        >
                          <span className="text-muted-foreground">
                            h{heading.level} · source {heading.sourceIndex} ·{' '}
                            {heading.visible ? 'visible' : 'hidden'}:{' '}
                          </span>
                          {heading.accessibleName || heading.text || '(unnamed)'}
                        </li>
                      ))}
                    </ol>
                  </details>
                  <details className="rounded-md border border-white/10 p-2">
                    <summary className="cursor-pointer text-xs">Page landmarks</summary>
                    <ul data-testid="seo-landmarks" className="mt-2 space-y-1 text-[10px]">
                      {result.documentStructure.landmarks.map((landmark) => (
                        <li key={`${landmark.role}-${landmark.sourceIndex}`}>
                          <span className="text-muted-foreground">
                            {landmark.role} · source {landmark.sourceIndex} ·{' '}
                            {landmark.visible ? 'visible' : 'hidden'} · {landmark.textCharacters}{' '}
                            characters
                          </span>
                          {landmark.accessibleName ? ` · "${landmark.accessibleName}"` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                  <p className="mt-3 text-[10px] text-muted-foreground">
                    These observations do not evaluate keyword density, prose quality, or general
                    WCAG conformance.
                  </p>
                </section>

                {/* Link inventory */}
                <section
                  data-testid="seo-link-inventory"
                  className="rounded-lg border border-white/10 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Link inventory
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {result.links.length} anchors
                    </span>
                  </div>
                  <input
                    data-testid="seo-link-filter"
                    type="search"
                    value={linkFilter}
                    onChange={(event) => setLinkFilter(event.target.value)}
                    placeholder="Filter links…"
                    aria-label="Filter link inventory"
                    className="mb-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <ul data-testid="seo-link-list" className="max-h-72 space-y-1.5 overflow-auto">
                    {result.links
                      .filter((link) => {
                        const query = linkFilter.trim().toLowerCase()
                        return (
                          !query ||
                          [
                            link.accessibleName,
                            link.text,
                            link.resolvedHref,
                            link.rawHref,
                            link.kind,
                            ...link.rel
                          ]
                            .filter(Boolean)
                            .some((value) => String(value).toLowerCase().includes(query))
                        )
                      })
                      .map((link) => (
                        <li
                          key={link.sourceIndex}
                          data-testid="seo-link-item"
                          className="rounded-md border border-white/10 p-2.5 text-xs"
                        >
                          <p className="text-foreground">
                            {link.accessibleName || link.text || '(unnamed link)'}
                          </p>
                          <p className="mt-0.5 break-all text-muted-foreground">
                            source {link.sourceIndex} · {link.kind} ·{' '}
                            {link.visible ? 'visible' : 'hidden'} ·{' '}
                            {link.resolvedHref ?? link.rawHref ?? '(no destination)'}
                          </p>
                          <p className="text-muted-foreground">
                            target {link.target ?? '_self'} · rel {link.rel.join(' ') || '(none)'}
                          </p>
                        </li>
                      ))}
                  </ul>
                  <p className="mt-3 text-[10px] text-muted-foreground">
                    Ordinary destinations are classified from rendered anchors and are not fetched.
                  </p>
                </section>

                {/* Images & media */}
                <section
                  data-testid="seo-images-media"
                  className="rounded-lg border border-white/10 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Images &amp; media
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {result.imagesMedia.images.length} images ·{' '}
                      {result.imagesMedia.media.length} media
                    </span>
                  </div>
                  <div className="max-h-96 space-y-2 overflow-auto">
                    {result.imagesMedia.images.map((image) => (
                      <article
                        key={image.sourceIndex}
                        data-testid="seo-image-item"
                        className="rounded-md border border-white/10 p-2.5 text-xs"
                      >
                        <p className="text-foreground">
                          {image.alt === '' ? '(decorative)' : (image.alt ?? '(missing alt)')}
                        </p>
                        <p className="mt-0.5 break-all text-muted-foreground">
                          source {image.sourceIndex} · {image.visible ? 'visible' : 'hidden'} ·{' '}
                          {image.currentSrc ?? image.src ?? '(empty source)'}
                        </p>
                        <p className="text-muted-foreground">
                          intrinsic {image.intrinsicWidth}×{image.intrinsicHeight} · rendered{' '}
                          {image.renderedWidth}×{image.renderedHeight} · loading {image.loading}
                        </p>
                        <p className="break-all text-muted-foreground">
                          srcset {image.srcset || '(none)'} · sizes {image.sizes || '(none)'}
                        </p>
                        {image.pictureSources.map((source, index) => (
                          <p key={index} className="break-all text-muted-foreground">
                            picture source {index}: {source.srcset} ·{' '}
                            {source.media || 'all media'} · {source.type || 'unspecified type'}
                          </p>
                        ))}
                      </article>
                    ))}
                    {result.imagesMedia.media.map((media) => (
                      <article
                        key={`${media.kind}-${media.sourceIndex}`}
                        data-testid="seo-media-item"
                        className="rounded-md border border-white/10 p-2.5 text-xs"
                      >
                        <p className="text-foreground">
                          {media.kind} source {media.sourceIndex}
                        </p>
                        <p className="mt-0.5 break-all text-muted-foreground">
                          {media.currentSrc ?? media.src ?? '(source candidates only)'} · preload{' '}
                          {media.preload} · {media.controls ? 'controls' : 'no controls'} ·{' '}
                          {media.tracks.length} tracks
                        </p>
                      </article>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-muted-foreground">
                    Selected assets use browser evidence. File-size and format guidance is
                    contextual; social-card assets remain under Social sharing.
                  </p>
                </section>

                {/* International targeting */}
                <section
                  data-testid="seo-internationalization"
                  className="rounded-lg border border-white/10 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      International targeting
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {result.internationalization.declarations.length} alternates
                    </span>
                  </div>
                  <ul className="mb-3 space-y-1 text-xs">
                    {result.internationalization.declarations.map((item) => (
                      <li
                        key={`${item.sourceIndex}-${item.hreflang}`}
                        data-testid="seo-hreflang-item"
                      >
                        <span className="text-foreground">{item.hreflang}</span> · local source{' '}
                        {item.sourceIndex} ·{' '}
                        <span className="break-all text-muted-foreground">
                          {item.resolvedHref ?? item.href}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-1 border-t border-white/10 pt-3 text-xs">
                    {result.internationalization.targets.map((target) => (
                      <li
                        key={`${target.hreflang}-${target.url}`}
                        data-testid="seo-hreflang-target"
                      >
                        <span className="text-foreground">{target.hreflang}</span> · bounded target
                        ·{' '}
                        {target.available
                          ? `HTTP ${target.status} · reciprocal ${target.reciprocal ? 'yes' : 'no'} · language ${target.targetLanguage ?? 'unknown'}`
                          : `unable: ${target.unavailableReason}`}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[10px] text-muted-foreground">
                    Only directly declared targets are checked; their alternates are not traversed.
                  </p>
                </section>

                {/* Declared and resolved metadata */}
                <details className="rounded-lg border border-white/10 p-4">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Declared and resolved metadata
                  </summary>
                  <div data-testid="seo-resolved-metadata" className="mt-3 space-y-2 text-sm">
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
                    className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm"
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
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  )
}
