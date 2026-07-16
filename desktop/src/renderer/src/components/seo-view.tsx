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
import { Button } from '@renderer/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@renderer/components/ui/tooltip'
import { auditMarkdown } from '../../../shared/seo-markdown'
import { InformationCircleIcon } from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'
import { useSeoAuditPresentation } from '@renderer/hooks/use-seo-audit-presentation'

const CATEGORIES = Object.keys(CATEGORY_LABEL) as AuditCategory[]
const OUTCOMES = Object.keys(OUTCOME_LABEL) as FindingOutcome[]

// Shared visual language with the Lighthouse view: translucent glass cards over
// the canvas, soft white borders, uppercase section labels, and easing tokens.
const EASE_OUT = 'ease-[var(--ease-out-strong)]'
const PRESSABLE =
  'transition-transform duration-[160ms] ease-[var(--ease-out-strong)] active:scale-[0.98] motion-reduce:active:scale-100'
const CARD = 'rounded-xl border border-white/10 bg-black/40 backdrop-blur-md'
const SECTION_TITLE = 'text-xs font-semibold uppercase tracking-wider text-white/45'
const SUBLABEL = 'text-[11px] font-medium uppercase tracking-wider text-white/35'

const OUTCOME_CLASS: Record<FindingOutcome, string> = {
  error: 'bg-destructive/15 text-destructive',
  warning: 'bg-amber-500/15 text-amber-500',
  opportunity: 'bg-sky-500/15 text-sky-500',
  passed: 'bg-emerald-500/15 text-emerald-500',
  'unable-to-verify': 'bg-white/10 text-white/45'
}

const INTENT_OPTIONS: { label: string; value: IndexingIntent }[] = (
  ['indexable', 'non-indexable', 'local-private'] as IndexingIntent[]
).map((value) => ({ value, label: INDEXING_INTENT_LABEL[value] }))

export function SeoView({ onClose: _onClose }: { onClose: () => void }): React.JSX.Element {
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
    <TooltipProvider delay={200}>
      <div
        data-testid="seo-view"
        className="absolute inset-0 z-10 overflow-y-auto bg-transparent text-foreground"
        style={{ top: TOOLBAR_HEIGHT_PX, left: sidebarOffset }}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-6">
          {!auditable ? (
            <p
              data-testid="seo-view-empty"
              className="rounded-xl border border-white/10 bg-black/30 px-6 py-16 text-center text-sm text-white/40 backdrop-blur-md"
            >
              Nothing to audit yet — load a page in the browser view, then come back to run an
              audit.
            </p>
          ) : (
            <>
              {/* Control card */}
              <div className={cn(CARD, 'px-5 py-4')}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-lg font-semibold tracking-tight text-white">
                      Page SEO audit
                    </h1>
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
                        Tells the audit how you expect search engines to treat this page, so
                        discoverability findings are judged against your goal — it changes how
                        results are interpreted, not which checks run. Indexable: should appear in
                        search, so missing or blocking signals are flagged. Non-indexable:
                        intentionally hidden (e.g. thank-you pages), so a noindex is expected rather
                        than an error. Local / private: a dev or internal environment, so
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
                        This result may be out of date — the page has navigated or reloaded since
                        the audit ran.
                      </div>
                    ) : null}
                    {job.incomplete ? (
                      <div
                        data-testid="seo-incomplete-banner"
                        className="mt-3 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/50"
                      >
                        This result is incomplete — the audit was interrupted before every check
                        ran.
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                      <span className="text-[11px] text-white/40">
                        {result.findings.length} finding{result.findings.length === 1 ? '' : 's'} ·{' '}
                        <span data-testid="seo-catalog-version">v{result.ruleCatalogVersion}</span>
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          data-testid="seo-copy-result"
                          className={cn(
                            'rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-sky-400 transition-colors hover:bg-white/5 hover:text-sky-300',
                            PRESSABLE
                          )}
                          onClick={() => copyMarkdown(auditMarkdown(result), 'complete result')}
                        >
                          Copy result
                        </button>
                        <button
                          type="button"
                          data-testid="seo-export-snapshot"
                          onClick={exportWithSnapshot}
                          className={cn(
                            'rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-sky-400 transition-colors hover:bg-white/5 hover:text-sky-300',
                            PRESSABLE
                          )}
                        >
                          Export snapshot
                        </button>
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

              {!result ? (
                <p className="rounded-xl border border-white/10 bg-black/30 px-6 py-16 text-center text-sm text-white/40 backdrop-blur-md">
                  Run an audit to see results.
                </p>
              ) : (
                <>
                  {/* Findings */}
                  <section data-testid="seo-result">
                    <h2 className={cn('mb-3', SECTION_TITLE)}>Findings</h2>
                    <ul className="space-y-2">
                      {result.findings
                        .filter(
                          (finding) => !findingCategory || finding.category === findingCategory
                        )
                        .filter((finding) => !findingOutcome || finding.outcome === findingOutcome)
                        .map((finding, index) => (
                          <li
                            key={finding.ruleId}
                            data-testid="seo-finding"
                            data-outcome={finding.outcome}
                            data-rule-id={finding.ruleId}
                            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                            className={cn(
                              CARD,
                              'p-4',
                              'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2',
                              'motion-safe:fill-mode-forwards motion-safe:opacity-0 motion-safe:duration-200',
                              EASE_OUT
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                data-testid="seo-finding-outcome"
                                className={cn(
                                  'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                  OUTCOME_CLASS[finding.outcome]
                                )}
                              >
                                {OUTCOME_LABEL[finding.outcome]}
                              </span>
                              <span className="text-xs text-white/45">
                                {CATEGORY_LABEL[finding.category]}
                              </span>
                              <code
                                data-testid="seo-finding-rule-id"
                                className="ml-auto text-[10px] text-white/35"
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
                              className="mt-2 text-sm text-white/90"
                            >
                              {finding.summary}
                            </p>
                            <p className="mt-1 text-xs text-white/45">{finding.impact}</p>
                            <p
                              data-testid="seo-finding-evidence"
                              className="mt-2 text-xs text-white/75"
                            >
                              <span className="text-white/40">
                                {finding.evidence.origin === 'delivered' ? 'Delivered' : 'Rendered'}
                                :{' '}
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
                        <li className="rounded-xl border border-white/10 bg-black/40 p-5 text-sm text-white/45 backdrop-blur-md">
                          No findings match the current filters.
                        </li>
                      ) : null}
                    </ul>
                  </section>

                  {/* Search preview */}
                  <section
                    data-testid="seo-search-preview"
                    className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
                  >
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/45">
                      Representative search preview
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-white/45">
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
                      className="mt-1 line-clamp-2 text-sm leading-5 text-white/45"
                    >
                      {result.searchAppearance.resolved.description.value ??
                        'No meta description is available for this preview.'}
                    </p>
                    <p
                      data-testid="seo-preview-measurements"
                      className="mt-2 text-xs text-white/45"
                    >
                      Title {result.searchAppearance.measurements.titleCharacters} chars
                      {result.searchAppearance.measurements.titleWidthPx === null
                        ? ''
                        : ` / ${result.searchAppearance.measurements.titleWidthPx}px`}
                      {' · '}Description{' '}
                      {result.searchAppearance.measurements.descriptionCharacters} chars
                      {result.searchAppearance.measurements.descriptionWidthPx === null
                        ? ''
                        : ` / ${result.searchAppearance.measurements.descriptionWidthPx}px`}
                    </p>
                  </section>

                  {/* Social cards */}
                  <section
                    data-testid="seo-social-previews"
                    className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">
                        Social card previews
                      </h2>
                      <span className="text-xs text-amber-500">Representative approximation</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        ['Open Graph', result.socialSharing.resolved.openGraph, 'aspect-[1.91/1]'],
                        ['X summary', result.socialSharing.resolved.x, 'aspect-square'],
                        ['X large image', result.socialSharing.resolved.x, 'aspect-[1.91/1]'],
                        [
                          'LinkedIn-style',
                          result.socialSharing.resolved.openGraph,
                          'aspect-[1.91/1]'
                        ],
                        [
                          'Messaging-style',
                          result.socialSharing.resolved.openGraph,
                          'aspect-[1.6/1]'
                        ]
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
                              <p className="text-[9px] uppercase text-white/45">{String(label)}</p>
                              <p className="mt-0.5 line-clamp-1 text-xs font-medium">
                                {metadata.title.value ?? 'Untitled page'}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[10px] text-white/45">
                                {metadata.description.value ?? 'No description'}
                              </p>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                    <details className="mt-3 rounded-md border border-white/10 p-2">
                      <summary className="cursor-pointer text-xs">Declared social metadata</summary>
                      <ul
                        data-testid="seo-social-declarations"
                        className="mt-2 space-y-1 text-[10px]"
                      >
                        {result.socialSharing.declared.map((item, index) => (
                          <li key={`${item.origin}-${item.property}-${item.order}-${index}`}>
                            <span className="text-white/45">
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
                    className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">
                        Structured data
                      </h2>
                      <span className="text-xs text-white/45">
                        {result.structuredData.entities.length} entities
                      </span>
                    </div>
                    <p className="mb-3 text-xs text-white/45">
                      Search enhancement eligibility uses a versioned profile and does not guarantee
                      a rich result.
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
                          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-white/45">
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
                          <p className="mt-1 text-[10px] text-white/45">
                            {entity.format} source {entity.sourceIndex + 1} · {entity.path}
                            {entity.id ? ` · ${entity.id}` : ''}
                          </p>
                          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-white/45">
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
                          className="text-xs text-white/45"
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
                    className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">
                        Document structure
                      </h2>
                      <span className="text-xs text-white/45">
                        {result.documentStructure.visibleTextCharacters} text characters
                      </span>
                    </div>
                    <p className="mb-3 text-xs text-white/45">
                      Language: {result.documentStructure.language.lang ?? 'not declared'} ·{' '}
                      {result.documentStructure.headings.filter((item) => item.visible).length}{' '}
                      visible headings ·{' '}
                      {result.documentStructure.landmarks.filter((item) => item.visible).length}{' '}
                      visible landmarks
                    </p>
                    <details className="mb-2 rounded-md border border-white/10 p-2">
                      <summary className="cursor-pointer text-xs">Rendered heading tree</summary>
                      <ol data-testid="seo-heading-tree" className="mt-2 space-y-1 text-[10px]">
                        {result.documentStructure.headings.map((heading) => (
                          <li
                            key={heading.sourceIndex}
                            style={{ paddingLeft: (heading.level - 1) * 8 }}
                          >
                            <span className="text-white/45">
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
                            <span className="text-white/45">
                              {landmark.role} · source {landmark.sourceIndex} ·{' '}
                              {landmark.visible ? 'visible' : 'hidden'} · {landmark.textCharacters}{' '}
                              characters
                            </span>
                            {landmark.accessibleName ? ` · "${landmark.accessibleName}"` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                    <p className="mt-3 text-[10px] text-white/45">
                      These observations do not evaluate keyword density, prose quality, or general
                      WCAG conformance.
                    </p>
                  </section>

                  {/* Link inventory */}
                  <section
                    data-testid="seo-link-inventory"
                    className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">
                        Link inventory
                      </h2>
                      <span className="text-xs text-white/45">{result.links.length} anchors</span>
                    </div>
                    <input
                      data-testid="seo-link-filter"
                      type="search"
                      value={linkFilter}
                      onChange={(event) => setLinkFilter(event.target.value)}
                      placeholder="Filter links…"
                      aria-label="Filter link inventory"
                      className="mb-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none placeholder:text-white/45"
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
                            <p className="mt-0.5 break-all text-white/45">
                              source {link.sourceIndex} · {link.kind} ·{' '}
                              {link.visible ? 'visible' : 'hidden'} ·{' '}
                              {link.resolvedHref ?? link.rawHref ?? '(no destination)'}
                            </p>
                            <p className="text-white/45">
                              target {link.target ?? '_self'} · rel {link.rel.join(' ') || '(none)'}
                            </p>
                          </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-[10px] text-white/45">
                      Ordinary destinations are classified from rendered anchors and are not
                      fetched.
                    </p>
                  </section>

                  {/* Images & media */}
                  <section
                    data-testid="seo-images-media"
                    className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">
                        Images &amp; media
                      </h2>
                      <span className="text-xs text-white/45">
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
                          <p className="mt-0.5 break-all text-white/45">
                            source {image.sourceIndex} · {image.visible ? 'visible' : 'hidden'} ·{' '}
                            {image.currentSrc ?? image.src ?? '(empty source)'}
                          </p>
                          <p className="text-white/45">
                            intrinsic {image.intrinsicWidth}×{image.intrinsicHeight} · rendered{' '}
                            {image.renderedWidth}×{image.renderedHeight} · loading {image.loading}
                          </p>
                          <p className="break-all text-white/45">
                            srcset {image.srcset || '(none)'} · sizes {image.sizes || '(none)'}
                          </p>
                          {image.pictureSources.map((source, index) => (
                            <p key={index} className="break-all text-white/45">
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
                          <p className="mt-0.5 break-all text-white/45">
                            {media.currentSrc ?? media.src ?? '(source candidates only)'} · preload{' '}
                            {media.preload} · {media.controls ? 'controls' : 'no controls'} ·{' '}
                            {media.tracks.length} tracks
                          </p>
                        </article>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] text-white/45">
                      Selected assets use browser evidence. File-size and format guidance is
                      contextual; social-card assets remain under Social sharing.
                    </p>
                  </section>

                  {/* International targeting */}
                  <section
                    data-testid="seo-internationalization"
                    className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">
                        International targeting
                      </h2>
                      <span className="text-xs text-white/45">
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
                          <span className="break-all text-white/45">
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
                          <span className="text-foreground">{target.hreflang}</span> · bounded
                          target ·{' '}
                          {target.available
                            ? `HTTP ${target.status} · reciprocal ${target.reciprocal ? 'yes' : 'no'} · language ${target.targetLanguage ?? 'unknown'}`
                            : `unable: ${target.unavailableReason}`}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-[10px] text-white/45">
                      Only directly declared targets are checked; their alternates are not
                      traversed.
                    </p>
                  </section>

                  {/* Declared and resolved metadata */}
                  <details className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-white/45">
                      Declared and resolved metadata
                    </summary>
                    <div data-testid="seo-resolved-metadata" className="mt-3 space-y-2 text-sm">
                      {Object.entries(result.searchAppearance.resolved).map(([kind, resolved]) => (
                        <div key={kind} data-metadata-kind={kind}>
                          <span className="capitalize text-white/45">{kind}: </span>
                          <span>{resolved.value ?? 'Not resolved'}</span>
                          <p className="pl-2 text-[10px] text-white/45">{resolved.reason}</p>
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
                          <span className="text-white/45">
                            {declaration.origin} · {declaration.kind} #{declaration.order + 1}:{' '}
                          </span>
                          <span>{declaration.value || '(empty)'}</span>
                        </li>
                      ))}
                    </ul>
                  </details>

                  {/* Filters — single-column footer */}
                  <div data-testid="seo-overview" className={cn(CARD, 'px-5 py-4')}>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <p className={cn('mb-1.5', SUBLABEL)}>Filter by outcome</p>
                        <div className="grid grid-cols-2 gap-1.5">
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
                                'rounded-lg border px-1.5 py-1 text-[10px] transition-colors',
                                PRESSABLE,
                                findingOutcome === outcome
                                  ? cn('border-transparent', OUTCOME_CLASS[outcome])
                                  : 'border-white/10 bg-white/[0.03] text-white/45 hover:text-white/80'
                              )}
                            >
                              {OUTCOME_LABEL[outcome]}{' '}
                              {result.findings.filter((item) => item.outcome === outcome).length}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className={cn('mb-1.5', SUBLABEL)}>Filter by category</p>
                        <div className="space-y-0.5">
                          {CATEGORIES.map((category) => (
                            <div
                              key={category}
                              data-testid="seo-category-row"
                              className="flex items-center gap-1"
                            >
                              <button
                                type="button"
                                aria-pressed={findingCategory === category}
                                onClick={() =>
                                  setFindingCategory(findingCategory === category ? null : category)
                                }
                                className={cn(
                                  'min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left text-[11px] transition-colors',
                                  findingCategory === category
                                    ? 'bg-sky-400/10 text-sky-300'
                                    : 'text-white/45 hover:text-white/80'
                                )}
                              >
                                {CATEGORY_LABEL[category]}{' '}
                                <span className="text-white/30">
                                  ·{' '}
                                  {
                                    result.findings.filter((item) => item.category === category)
                                      .length
                                  }
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
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
