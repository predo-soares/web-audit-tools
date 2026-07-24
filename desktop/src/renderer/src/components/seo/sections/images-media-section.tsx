import type { AuditResult } from '../../../../../shared/seo-audit'

export function ImagesMediaSection({ result }: { result: AuditResult }): React.JSX.Element {
  return (
    <section
      data-testid="seo-images-media"
      className="rounded-xl border border-white/10 bg-black/55 p-5 backdrop-blur-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/55">
          Images &amp; media
        </h2>
        <span className="text-xs text-white/55">
          {result.imagesMedia.images.length} images · {result.imagesMedia.media.length} media
        </span>
      </div>
      <div className="max-h-96 space-y-2 overflow-auto">
        {result.imagesMedia.images.map((image) => (
          <article
            key={image.sourceIndex}
            data-testid="seo-image-item"
            className="rounded-md border border-white/10 p-2.5 text-xs"
          >
            <p className="text-foreground">
              {image.alt === '' ? '(decorative)' : (image.alt ?? '(missing alt)')}
            </p>
            <p className="mt-0.5 break-all text-white/55">
              source {image.sourceIndex} · {image.visible ? 'visible' : 'hidden'} ·{' '}
              {image.currentSrc ?? image.src ?? '(empty source)'}
            </p>
            <p className="text-white/55">
              intrinsic {image.intrinsicWidth}×{image.intrinsicHeight} · rendered{' '}
              {image.renderedWidth}×{image.renderedHeight} · loading {image.loading}
            </p>
            <p className="break-all text-white/55">
              srcset {image.srcset || '(none)'} · sizes {image.sizes || '(none)'}
            </p>
            {image.pictureSources.map((source, index) => (
              <p key={index} className="break-all text-white/55">
                picture source {index}: {source.srcset} · {source.media || 'all media'} ·{' '}
                {source.type || 'unspecified type'}
              </p>
            ))}
          </article>
        ))}
        {result.imagesMedia.media.map((media) => (
          <article
            key={`${media.kind}-${media.sourceIndex}`}
            data-testid="seo-media-item"
            className="rounded-md border border-white/10 p-2.5 text-xs"
          >
            <p className="text-foreground">
              {media.kind} source {media.sourceIndex}
            </p>
            <p className="mt-0.5 break-all text-white/55">
              {media.currentSrc ?? media.src ?? '(source candidates only)'} · preload{' '}
              {media.preload} · {media.controls ? 'controls' : 'no controls'} ·{' '}
              {media.tracks.length} tracks
            </p>
          </article>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-white/55">
        Selected assets use browser evidence. File-size and format guidance is contextual;
        social-card assets remain under Social sharing.
      </p>
    </section>
  )
}
