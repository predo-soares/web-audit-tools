import type { AuditResult } from '../../../../../shared/seo-audit'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@renderer/components/ui/dialog'

export function MetadataDetails({ result }: { result: AuditResult }): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/55 outline-none backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white/70 focus-visible:ring-2 focus-visible:ring-ring/50">
        Declared and resolved metadata
      </DialogTrigger>
      <DialogContent data-testid="seo-metadata-modal">
        <DialogTitle className="ml-1 pr-8">Declared and resolved metadata</DialogTitle>
        <div className="min-h-0 overflow-y-auto px-1 pb-1">
          <div data-testid="seo-resolved-metadata" className="space-y-2 text-sm">
            {Object.entries(result.searchAppearance.resolved).map(([kind, resolved]) => (
              <div key={kind} data-metadata-kind={kind}>
                <span className="capitalize text-white/55">{kind}: </span>
                <span>{resolved.value ?? 'Not resolved'}</span>
                <p className="pl-2 text-[10px] text-white/55">{resolved.reason}</p>
              </div>
            ))}
          </div>
          <ul
            data-testid="seo-declared-metadata"
            className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm"
          >
            {result.searchAppearance.declared.map((declaration, index) => (
              <li key={`${declaration.origin}-${declaration.kind}-${declaration.order}-${index}`}>
                <span className="text-white/55">
                  {declaration.origin} · {declaration.kind} #{declaration.order + 1}:{' '}
                </span>
                <span>{declaration.value || '(empty)'}</span>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
