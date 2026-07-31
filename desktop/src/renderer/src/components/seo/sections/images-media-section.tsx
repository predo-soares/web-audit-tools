import {
  Download01Icon,
  ImageNotFound01Icon,
  InformationCircleIcon,
  MusicNote01Icon,
  Video01Icon
} from '@hugeicons/core-free-icons'
import type { AuditResult, ImageEvidence, MediaEvidence } from '../../../../../shared/seo-audit'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@renderer/components/ui/dialog'
import { ProgressiveBlur } from '@renderer/components/ui/progressive-blur'
import { cn } from '@renderer/lib/utils'

// Overlay affordance shared by image/media cards. `pointer-events-auto` so it
// stays clickable inside the otherwise click-through hover overlay.
function OverlayIconButton({
  icon,
  label,
  onClick,
  testId
}: {
  icon: typeof Download01Icon
  label: string
  onClick?: () => void
  testId?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      onClick={onClick}
      className="pointer-events-auto relative flex size-7 shrink-0 items-center justify-center rounded-md text-white/80 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Icon icon={icon} size={14} />
    </button>
  )
}

function downloadMedia(url: string | null, name: string): void {
  if (!url) return
  void window.api.downloadMedia(url, name)
}

function altDisplay(image: ImageEvidence): string {
  if (image.alt === '') return '(decorative)'
  return image.alt ?? '(missing alt)'
}

// A short, human-readable name for the card overlay: the file name when the
// source is a URL, a marker for inline data URIs, or a fallback when empty.
function imageName(image: ImageEvidence): string {
  const source = image.currentSrc ?? image.src
  if (!source) return '(no source)'
  if (source.startsWith('data:')) return '(inline image)'
  try {
    const { pathname } = new URL(source, 'http://local')
    return pathname.split('/').filter(Boolean).pop() || source
  } catch {
    return source
  }
}

function Thumbnail({
  src,
  fallbackIcon,
  fallbackLabel,
  alt,
  className
}: {
  src: string | null
  fallbackIcon: typeof ImageNotFound01Icon
  fallbackLabel: string
  alt: string
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-black/30 [background-image:repeating-conic-gradient(rgba(255,255,255,0.04)_0_25%,transparent_0_50%)] [background-size:16px_16px]',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/30">
        <Icon icon={fallbackIcon} size={22} strokeWidth={1.5} />
        <span className="px-2 text-center text-[10px] text-white/35">{fallbackLabel}</span>
      </div>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          // The thumbnail sits above the fallback; on load failure it removes
          // itself so the icon/label underneath shows through.
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
          className="relative h-full w-full object-contain "
        />
      ) : null}
    </div>
  )
}

function DetailRow({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-32 shrink-0 text-white/40">{label}</dt>
      <dd className="min-w-0 break-all text-white/80">{children}</dd>
    </div>
  )
}

function ImageCard({ image }: { image: ImageEvidence }): React.JSX.Element {
  const previewSrc = image.currentSrc ?? image.src
  const alt = altDisplay(image)
  const name = imageName(image)
  const dimensions = `${image.intrinsicWidth}×${image.intrinsicHeight}`
  return (
    <Dialog>
      <article
        data-testid="seo-image-item"
        className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]"
      >
        <Thumbnail
          src={previewSrc}
          fallbackIcon={ImageNotFound01Icon}
          fallbackLabel={previewSrc ? 'preview unavailable' : '(empty source)'}
          alt={image.alt ?? ''}
          className="h-full w-full"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5 pt-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <ProgressiveBlur className="absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="relative min-w-0">
            <p className="max-w-[20ch] truncate text-xs font-medium text-white" title={name}>
              {name}
            </p>
            <p className="text-[11px] tabular-nums text-white/60">{dimensions}</p>
          </div>
          <div className="relative flex shrink-0 items-center gap-0.5">
            {previewSrc ? (
              <OverlayIconButton
                icon={Download01Icon}
                label={`Download ${name}`}
                testId="seo-image-download"
                onClick={() => downloadMedia(previewSrc, name)}
              />
            ) : null}
            <DialogTrigger
              data-testid="seo-image-details"
              aria-label={`View details for ${name}`}
              className="pointer-events-auto relative flex size-7 shrink-0 items-center justify-center rounded-md text-white/80 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Icon icon={InformationCircleIcon} size={14} />
            </DialogTrigger>
          </div>
        </div>
      </article>

      <DialogContent data-testid="seo-image-modal">
        <div className="flex items-center justify-between gap-3 pr-8">
          <DialogTitle className="ml-2 truncate" title={name}>
            {name}
          </DialogTitle>
          {previewSrc ? (
            <Button
              type="button"
              variant="soft"
              color="neutral"
              size="tiny"
              data-testid="seo-image-modal-download"
              onClick={() => downloadMedia(previewSrc, name)}
            >
              <Icon icon={Download01Icon} size={14} />
              Download
            </Button>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <Thumbnail
            src={previewSrc}
            fallbackIcon={ImageNotFound01Icon}
            fallbackLabel={previewSrc ? 'preview unavailable' : '(empty source)'}
            alt={image.alt ?? ''}
            className="max-h-[45vh] min-h-48 w-full rounded-lg border border-white/10"
          />
          <dl className="flex flex-col gap-1.5 text-xs px-2 pb-2">
            <DetailRow label="Alt">{alt}</DetailRow>
            <DetailRow label="Source">
              source {image.sourceIndex} · {image.visible ? 'visible' : 'hidden'}
            </DetailRow>
            <DetailRow label="URL">{previewSrc ?? '(empty source)'}</DetailRow>
            <DetailRow label="Intrinsic">
              {image.intrinsicWidth}×{image.intrinsicHeight}
            </DetailRow>
            <DetailRow label="Rendered">
              {image.renderedWidth}×{image.renderedHeight}
            </DetailRow>
            <DetailRow label="Loading">
              {image.loading} · decoding {image.decoding}
            </DetailRow>
            <DetailRow label="srcset">{image.srcset || '(none)'}</DetailRow>
            <DetailRow label="sizes">{image.sizes || '(none)'}</DetailRow>
            {image.pictureSources.map((source, index) => (
              <DetailRow key={index} label={`picture source ${index}`}>
                {source.srcset} · {source.media || 'all media'} ·{' '}
                {source.type || 'unspecified type'}
              </DetailRow>
            ))}
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MediaCard({ media }: { media: MediaEvidence }): React.JSX.Element {
  const downloadSrc = media.currentSrc ?? media.src
  return (
    <article
      data-testid="seo-media-item"
      className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]"
    >
      <Thumbnail
        src={media.poster}
        fallbackIcon={media.kind === 'audio' ? MusicNote01Icon : Video01Icon}
        fallbackLabel={media.poster ? 'poster' : `${media.kind} · no poster`}
        alt=""
        className="h-full w-full"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5 pt-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        <ProgressiveBlur className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="relative min-w-0">
          <p className="truncate text-xs font-medium text-white">
            {media.kind} source {media.sourceIndex}
          </p>
          <p className="text-[11px] text-white/60">{media.tracks.length} tracks</p>
        </div>
        {downloadSrc ? (
          <OverlayIconButton
            icon={Download01Icon}
            label={`Download ${media.kind} source ${media.sourceIndex}`}
            testId="seo-media-download"
            onClick={() => downloadMedia(downloadSrc, `${media.kind}-${media.sourceIndex}`)}
          />
        ) : null}
      </div>
    </article>
  )
}

export function ImagesMediaSection({ result }: { result: AuditResult }): React.JSX.Element {
  const { images, media } = result.imagesMedia
  return (
    <section
      data-testid="seo-images-media"
      className="rounded-2xl border border-white/3 bg-black/5 p-5 backdrop-blur-md"
    >
      <div className="mb-5 flex items-center justify-between gap-2">
        <h2 className="text-base   tracking-wider text-white">Images &amp; media</h2>
        <span className="text-xs text-white/55">
          {images.length} images · {media.length} media
        </span>
      </div>
      {images.length === 0 && media.length === 0 ? (
        <p className="text-xs text-white/40">No images or media detected on this page.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image) => (
            <ImageCard key={image.sourceIndex} image={image} />
          ))}
          {media.map((item) => (
            <MediaCard key={`${item.kind}-${item.sourceIndex}`} media={item} />
          ))}
        </div>
      )}
    </section>
  )
}
