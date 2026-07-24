import type { AuditResult } from '../../../../../shared/seo-audit'

export function StructuredDataSection({ result }: { result: AuditResult }): React.JSX.Element {
  return (
    <section
      data-testid="seo-structured-data"
      className="rounded-xl border border-white/10 bg-black/55 p-5 backdrop-blur-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/55">
          Structured data
        </h2>
        <span className="text-xs text-white/55">
          {result.structuredData.entities.length} entities
        </span>
      </div>
      <p className="mb-3 text-xs text-white/55">
        Search enhancement eligibility uses a versioned profile and does not guarantee a rich
        result.
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
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-white/55">
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
            <p className="mt-1 text-[10px] text-white/55">
              {entity.format} source {entity.sourceIndex + 1} · {entity.path}
              {entity.id ? ` · ${entity.id}` : ''}
            </p>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-white/55">
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
            className="text-xs text-white/55"
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
  )
}
