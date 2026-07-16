import type { AuditResult } from '../../../../../shared/seo-audit'

export function DocumentStructureSection({ result }: { result: AuditResult }): React.JSX.Element {
  return (
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
        {result.documentStructure.headings.filter((item) => item.visible).length} visible headings ·{' '}
        {result.documentStructure.landmarks.filter((item) => item.visible).length} visible landmarks
      </p>
      <details className="mb-2 rounded-md border border-white/10 p-2">
        <summary className="cursor-pointer text-xs">Rendered heading tree</summary>
        <ol data-testid="seo-heading-tree" className="mt-2 space-y-1 text-[10px]">
          {result.documentStructure.headings.map((heading) => (
            <li key={heading.sourceIndex} style={{ paddingLeft: (heading.level - 1) * 8 }}>
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
                {landmark.visible ? 'visible' : 'hidden'} · {landmark.textCharacters} characters
              </span>
              {landmark.accessibleName ? ` · "${landmark.accessibleName}"` : ''}
            </li>
          ))}
        </ul>
      </details>
      <p className="mt-3 text-[10px] text-white/45">
        These observations do not evaluate keyword density, prose quality, or general WCAG
        conformance.
      </p>
    </section>
  )
}
