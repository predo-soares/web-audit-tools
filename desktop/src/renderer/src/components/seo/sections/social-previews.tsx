import type { AuditResult } from '../../../../../shared/seo-audit'
import { cn } from '@renderer/lib/utils'

export function SocialPreviews({ result }: { result: AuditResult }): React.JSX.Element {
  return (
    <section
      data-testid="seo-social-previews"
      className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/55">
          Social card previews
        </h2>
        <span className="text-xs text-amber-500">Representative approximation</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Open Graph', result.socialSharing.resolved.openGraph, 'aspect-[1.91/1]'],
          ['X summary', result.socialSharing.resolved.x, 'aspect-square'],
          ['X large image', result.socialSharing.resolved.x, 'aspect-[1.91/1]'],
          ['LinkedIn-style', result.socialSharing.resolved.openGraph, 'aspect-[1.91/1]'],
          ['Messaging-style', result.socialSharing.resolved.openGraph, 'aspect-[1.6/1]']
        ].map(([label, card, ratio]) => {
          const metadata = card as typeof result.socialSharing.resolved.openGraph
          return (
            <article
              key={label as string}
              data-testid="seo-social-preview"
              data-preview-kind={(label as string).toLowerCase().replaceAll(' ', '-')}
              className="overflow-hidden rounded-md border border-white/10 bg-white/[0.03]"
            >
              <div className={cn('overflow-hidden bg-white/5', ratio as string)}>
                {metadata.image.value ? (
                  <img src={metadata.image.value} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="p-2">
                <p className="text-[9px] uppercase text-white/55">{String(label)}</p>
                <p className="mt-0.5 line-clamp-1 text-xs font-medium">
                  {metadata.title.value ?? 'Untitled page'}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[10px] text-white/55">
                  {metadata.description.value ?? 'No description'}
                </p>
              </div>
            </article>
          )
        })}
      </div>
      <details className="mt-3 rounded-md border border-white/10 p-2">
        <summary className="cursor-pointer text-xs">Declared social metadata</summary>
        <ul data-testid="seo-social-declarations" className="mt-2 space-y-1 text-[10px]">
          {result.socialSharing.declared.map((item, index) => (
            <li key={`${item.origin}-${item.property}-${item.order}-${index}`}>
              <span className="text-white/55">
                {item.origin} · {item.property}:{' '}
              </span>
              {item.value || '(empty)'}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
