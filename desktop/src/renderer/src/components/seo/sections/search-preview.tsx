import type { AuditResult } from '../../../../../shared/seo-audit'

export function SearchPreview({ result }: { result: AuditResult }): React.JSX.Element {
  return (
    <section
      data-testid="seo-search-preview"
      className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/55">
        Representative search preview
      </h2>
      <div className="flex items-center gap-2 text-xs text-white/55">
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
        className="mt-1 line-clamp-2 text-sm leading-5 text-white/55"
      >
        {result.searchAppearance.resolved.description.value ??
          'No meta description is available for this preview.'}
      </p>
      <p data-testid="seo-preview-measurements" className="mt-2 text-xs text-white/55">
        Title {result.searchAppearance.measurements.titleCharacters} chars
        {result.searchAppearance.measurements.titleWidthPx === null
          ? ''
          : ` / ${result.searchAppearance.measurements.titleWidthPx}px`}
        {' · '}Description {result.searchAppearance.measurements.descriptionCharacters} chars
        {result.searchAppearance.measurements.descriptionWidthPx === null
          ? ''
          : ` / ${result.searchAppearance.measurements.descriptionWidthPx}px`}
      </p>
    </section>
  )
}
