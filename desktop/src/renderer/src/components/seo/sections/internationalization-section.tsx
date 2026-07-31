import type { AuditResult } from '../../../../../shared/seo-audit'
import { DetailRow, InfoDialog } from '../detail'

export function InternationalizationSection({
  result
}: {
  result: AuditResult
}): React.JSX.Element {
  return (
    <section
      data-testid="seo-internationalization"
      className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/55">
          International targeting
        </h2>
        <span className="text-xs text-white/55">
          {result.internationalization.declarations.length} alternates
        </span>
      </div>
      <ul className="mb-3 space-y-1.5 text-xs">
        {result.internationalization.declarations.map((item) => {
          const href = item.resolvedHref ?? item.href
          return (
            <li
              key={`${item.sourceIndex}-${item.hreflang}`}
              data-testid="seo-hreflang-item"
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="text-foreground">{item.hreflang}</span>
                </p>
                <p className="mt-0.5 truncate text-white/55">{href}</p>
              </div>
              <InfoDialog
                title={item.hreflang}
                triggerLabel={`Alternate details for ${item.hreflang}`}
              >
                <DetailRow label="hreflang">{item.hreflang}</DetailRow>
                <DetailRow label="Source">local source {item.sourceIndex}</DetailRow>
                <DetailRow label="Resolved">{item.resolvedHref ?? '(unresolved)'}</DetailRow>
                <DetailRow label="Raw href">{item.href}</DetailRow>
              </InfoDialog>
            </li>
          )
        })}
      </ul>
      <ul className="space-y-1.5 border-t border-white/10 pt-3 text-xs">
        {result.internationalization.targets.map((target) => {
          const status = target.available
            ? `HTTP ${target.status} · reciprocal ${target.reciprocal ? 'yes' : 'no'} · language ${target.targetLanguage ?? 'unknown'}`
            : `unable: ${target.unavailableReason}`
          return (
            <li
              key={`${target.hreflang}-${target.url}`}
              data-testid="seo-hreflang-target"
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="text-foreground">{target.hreflang}</span> · bounded target
                </p>
                <p className="mt-0.5 truncate text-white/55">{status}</p>
              </div>
              <InfoDialog
                title={`${target.hreflang} target`}
                triggerLabel={`Target details for ${target.hreflang}`}
              >
                <DetailRow label="hreflang">{target.hreflang}</DetailRow>
                <DetailRow label="URL">{target.url}</DetailRow>
                <DetailRow label="Status">{status}</DetailRow>
              </InfoDialog>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-[10px] text-white/55">
        Only directly declared targets are checked; their alternates are not traversed.
      </p>
    </section>
  )
}
