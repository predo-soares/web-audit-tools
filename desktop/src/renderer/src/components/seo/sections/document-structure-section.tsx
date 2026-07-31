import type { AuditResult } from '../../../../../shared/seo-audit'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@renderer/components/ui/dialog'

const REVEAL_TRIGGER_CLASS =
  'flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-xs text-foreground outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-ring/50'

export function DocumentStructureSection({ result }: { result: AuditResult }): React.JSX.Element {
  return (
    <section
      data-testid="seo-document-structure"
      className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/55">
          Document structure
        </h2>
        <span className="text-xs text-white/55">
          {result.documentStructure.visibleTextCharacters} text characters
        </span>
      </div>
      <p className="mb-3 text-xs text-white/55">
        Language: {result.documentStructure.language.lang ?? 'not declared'} ·{' '}
        {result.documentStructure.headings.filter((item) => item.visible).length} visible headings ·{' '}
        {result.documentStructure.landmarks.filter((item) => item.visible).length} visible landmarks
      </p>
      <div className="space-y-1.5">
        <Dialog>
          <DialogTrigger className={REVEAL_TRIGGER_CLASS}>
            <span>Rendered heading tree</span>
            <span className="text-white/40">{result.documentStructure.headings.length}</span>
          </DialogTrigger>
          <DialogContent data-testid="seo-heading-tree-modal">
            <DialogTitle className="ml-1 pr-8">Rendered heading tree</DialogTitle>
            <ol
              data-testid="seo-heading-tree"
              className="min-h-0 space-y-1 overflow-y-auto px-1 pb-1 text-[11px]"
            >
              {result.documentStructure.headings.map((heading) => (
                <li key={heading.sourceIndex} style={{ paddingLeft: (heading.level - 1) * 12 }}>
                  <span className="text-white/55">
                    h{heading.level} · source {heading.sourceIndex} ·{' '}
                    {heading.visible ? 'visible' : 'hidden'}:{' '}
                  </span>
                  {heading.accessibleName || heading.text || '(unnamed)'}
                </li>
              ))}
            </ol>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger className={REVEAL_TRIGGER_CLASS}>
            <span>Page landmarks</span>
            <span className="text-white/40">{result.documentStructure.landmarks.length}</span>
          </DialogTrigger>
          <DialogContent data-testid="seo-landmarks-modal">
            <DialogTitle className="ml-1 pr-8">Page landmarks</DialogTitle>
            <ul
              data-testid="seo-landmarks"
              className="min-h-0 space-y-1 overflow-y-auto px-1 pb-1 text-[11px]"
            >
              {result.documentStructure.landmarks.map((landmark) => (
                <li key={`${landmark.role}-${landmark.sourceIndex}`}>
                  <span className="text-white/55">
                    {landmark.role} · source {landmark.sourceIndex} ·{' '}
                    {landmark.visible ? 'visible' : 'hidden'} · {landmark.textCharacters} characters
                  </span>
                  {landmark.accessibleName ? ` · "${landmark.accessibleName}"` : ''}
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      </div>
      <p className="mt-3 text-[10px] text-white/55">
        These observations do not evaluate keyword density, prose quality, or general WCAG
        conformance.
      </p>
    </section>
  )
}
