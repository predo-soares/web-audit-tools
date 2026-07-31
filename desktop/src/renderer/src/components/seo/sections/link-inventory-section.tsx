import type { AuditResult } from '../../../../../shared/seo-audit'
import type { SeoAuditPresentation } from '@renderer/hooks/use-seo-audit-presentation'
import { DetailRow, InfoDialog } from '../detail'

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
      className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
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
      <ul data-testid="seo-link-list" className="space-y-1.5">
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
          .map((link) => {
            const name = link.accessibleName || link.text || '(unnamed link)'
            const destination = link.resolvedHref ?? link.rawHref ?? '(no destination)'
            return (
              <li
                key={link.sourceIndex}
                data-testid="seo-link-item"
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground">{name}</p>
                  <p className="mt-0.5 truncate text-white/55">
                    {link.kind} · {destination}
                  </p>
                </div>
                <InfoDialog
                  title={name}
                  testId="seo-link-modal"
                  triggerTestId="seo-link-details"
                  triggerLabel={`Link details for ${name}`}
                >
                  <DetailRow label="Name">{name}</DetailRow>
                  <DetailRow label="Source">
                    source {link.sourceIndex} · {link.visible ? 'visible' : 'hidden'}
                  </DetailRow>
                  <DetailRow label="Kind">{link.kind}</DetailRow>
                  <DetailRow label="Destination">{destination}</DetailRow>
                  <DetailRow label="Raw href">{link.rawHref ?? '(none)'}</DetailRow>
                  <DetailRow label="Target">{link.target ?? '_self'}</DetailRow>
                  <DetailRow label="rel">{link.rel.join(' ') || '(none)'}</DetailRow>
                </InfoDialog>
              </li>
            )
          })}
      </ul>
      <p className="mt-3 text-[10px] text-white/55">
        Ordinary destinations are classified from rendered anchors and are not fetched.
      </p>
    </section>
  )
}
