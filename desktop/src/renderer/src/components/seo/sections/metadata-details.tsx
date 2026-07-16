import type { AuditResult } from '../../../../../shared/seo-audit'

export function MetadataDetails({ result }: { result: AuditResult }): React.JSX.Element {
  return (
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
          <li key={`${declaration.origin}-${declaration.kind}-${declaration.order}-${index}`}>
            <span className="text-white/45">
              {declaration.origin} · {declaration.kind} #{declaration.order + 1}:{' '}
            </span>
            <span>{declaration.value || '(empty)'}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
