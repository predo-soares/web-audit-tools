import type { AuditResult } from '../../../../../shared/seo-audit'

export function InternationalizationSection({
  result
}: {
  result: AuditResult
}): React.JSX.Element {
  return (
    <section
      data-testid="seo-internationalization"
      className="rounded-xl border border-white/10 bg-black/55 p-5 backdrop-blur-md"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/55">
          International targeting
        </h2>
        <span className="text-xs text-white/55">
          {result.internationalization.declarations.length} alternates
        </span>
      </div>
      <ul className="mb-3 space-y-1 text-xs">
        {result.internationalization.declarations.map((item) => (
          <li key={`${item.sourceIndex}-${item.hreflang}`} data-testid="seo-hreflang-item">
            <span className="text-foreground">{item.hreflang}</span> · local source{' '}
            {item.sourceIndex} ·{' '}
            <span className="break-all text-white/55">{item.resolvedHref ?? item.href}</span>
          </li>
        ))}
      </ul>
      <ul className="space-y-1 border-t border-white/10 pt-3 text-xs">
        {result.internationalization.targets.map((target) => (
          <li key={`${target.hreflang}-${target.url}`} data-testid="seo-hreflang-target">
            <span className="text-foreground">{target.hreflang}</span> · bounded target ·{' '}
            {target.available
              ? `HTTP ${target.status} · reciprocal ${target.reciprocal ? 'yes' : 'no'} · language ${target.targetLanguage ?? 'unknown'}`
              : `unable: ${target.unavailableReason}`}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] text-white/55">
        Only directly declared targets are checked; their alternates are not traversed.
      </p>
    </section>
  )
}
