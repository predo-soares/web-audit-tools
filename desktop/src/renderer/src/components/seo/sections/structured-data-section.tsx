import type { AuditResult } from '../../../../../shared/seo-audit'
import { DetailRow, InfoDialog } from '../detail'

export function StructuredDataSection({ result }: { result: AuditResult }): React.JSX.Element {
  return (
    <section
      data-testid="seo-structured-data"
      className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
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
      <div className="space-y-1.5">
        {result.structuredData.sources.map((source) => {
          const label = `${source.format.toUpperCase()} source ${source.sourceIndex + 1}`
          return (
            <div
              key={`${source.format}-${source.sourceIndex}`}
              data-testid="seo-structured-source"
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-xs"
            >
              <p className="min-w-0 flex-1 truncate text-foreground">{label}</p>
              <InfoDialog
                title={label}
                testId="seo-structured-source-modal"
                triggerLabel={`Raw ${label}`}
              >
                <pre className="whitespace-pre-wrap break-all text-[10px] text-white/70">
                  {source.raw}
                </pre>
              </InfoDialog>
            </div>
          )
        })}
        {result.structuredData.entities.map((entity, index) => {
          const label = entity.types.join(', ') || 'Untyped entity'
          return (
            <div
              key={`${entity.format}-${entity.sourceIndex}-${entity.path}-${index}`}
              data-testid="seo-structured-entity"
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">{label}</p>
                <p className="mt-0.5 truncate text-white/55">
                  {entity.format} source {entity.sourceIndex + 1} · {entity.path}
                </p>
              </div>
              <InfoDialog title={label} testId="seo-structured-entity-modal" triggerLabel={label}>
                <DetailRow label="Types">{label}</DetailRow>
                <DetailRow label="Source">
                  {entity.format} source {entity.sourceIndex + 1}
                </DetailRow>
                <DetailRow label="Path">{entity.path}</DetailRow>
                {entity.id ? <DetailRow label="ID">{entity.id}</DetailRow> : null}
                <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] text-white/70">
                  {JSON.stringify(entity.properties, null, 2)}
                </pre>
              </InfoDialog>
            </div>
          )
        })}
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
