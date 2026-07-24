import type { AuditResult } from '../../../../../shared/seo-audit'
import type { SeoAuditPresentation } from '@renderer/hooks/use-seo-audit-presentation'

export function LinkInventorySection({
  result,
  linkFilter,
  setLinkFilter
}: {
  result: AuditResult
  linkFilter: string
  setLinkFilter: SeoAuditPresentation['setLinkFilter']
}): React.JSX.Element {
  return (
    <section
      data-testid="seo-link-inventory"
      className="rounded-xl border border-white/10 bg-black/55 p-5 backdrop-blur-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/55">
          Link inventory
        </h2>
        <span className="text-xs text-white/55">{result.links.length} anchors</span>
      </div>
      <input
        data-testid="seo-link-filter"
        type="search"
        value={linkFilter}
        onChange={(event) => setLinkFilter(event.target.value)}
        placeholder="Filter links…"
        aria-label="Filter link inventory"
        className="mb-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-white/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
              <p className="mt-0.5 break-all text-white/55">
                source {link.sourceIndex} · {link.kind} · {link.visible ? 'visible' : 'hidden'} ·{' '}
                {link.resolvedHref ?? link.rawHref ?? '(no destination)'}
              </p>
              <p className="text-white/55">
                target {link.target ?? '_self'} · rel {link.rel.join(' ') || '(none)'}
              </p>
            </li>
          ))}
      </ul>
      <p className="mt-3 text-[10px] text-white/55">
        Ordinary destinations are classified from rendered anchors and are not fetched.
      </p>
    </section>
  )
}
