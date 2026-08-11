import type { Finding, ImagesMediaEvidence } from '../../../shared/seo-audit'
import { finding } from './finding'
import type { Rule } from './rule-types'

export const imageAlternativesRule: Rule = {
  id: 'images-media/alternatives',
  category: 'images-media',
  evaluate({ imagesMedia }): Finding {
    const meaningful = imagesMedia.images.filter(
      (image) => image.role !== 'presentation' && image.role !== 'none' && image.alt !== ''
    )
    const missing = meaningful.filter((image) => image.alt === null)
    if (missing.length)
      return finding(
        this,
        'warning',
        'Some meaningful images have no text alternative',
        'Images that convey page meaning need an alternative that search and accessibility consumers can interpret.',
        'Add an accurate alt value; use alt="" only for intentionally decorative images.',
        mediaSources(missing)
      )
    return finding(
      this,
      'passed',
      'Image alternatives are explicitly classified',
      'Meaningful images expose alternatives and decorative images are intentionally empty or presentational.',
      null,
      `${meaningful.length} meaningful · ${imagesMedia.images.length - meaningful.length} decorative image(s).`
    )
  }
}

export const imageSourcesRule: Rule = {
  id: 'images-media/sources-available',
  category: 'images-media',
  evaluate({ imagesMedia }): Finding {
    const empty = imagesMedia.images.filter(
      (image) => !image.src && !image.currentSrc && !image.srcset && !image.pictureSources.length
    )
    const broken = imagesMedia.images.filter(
      (image) => image.complete && !image.intrinsicWidth && Boolean(image.currentSrc || image.src)
    )
    if (empty.length || broken.length)
      return finding(
        this,
        'error',
        'Some rendered images have empty or inaccessible selected sources',
        'An image with no usable selected asset cannot present or contribute its intended meaning.',
        'Provide a valid image candidate and confirm the browser can load the selected source.',
        `${empty.length} empty · ${broken.length} failed selected source(s). ${mediaSources([...empty, ...broken])}`
      )
    return finding(
      this,
      'passed',
      'Selected image sources loaded',
      'Browser completion and intrinsic dimensions indicate the selected rendered assets are available.',
      null,
      `${imagesMedia.images.length} image(s) inspected from browser-selected evidence; no arbitrary media bodies downloaded.`
    )
  }
}

export const imageDimensionsRule: Rule = {
  id: 'images-media/dimensions',
  category: 'images-media',
  evaluate({ imagesMedia }): Finding {
    const distorted = imagesMedia.images.filter(
      (image) =>
        image.intrinsicWidth &&
        image.intrinsicHeight &&
        image.renderedWidth &&
        image.renderedHeight &&
        Math.abs(
          image.intrinsicWidth / image.intrinsicHeight - image.renderedWidth / image.renderedHeight
        ) /
          (image.intrinsicWidth / image.intrinsicHeight) >
          0.1
    )
    if (distorted.length)
      return finding(
        this,
        'warning',
        'Some images appear aspect-ratio distorted',
        'Rendered proportions that differ materially from the intrinsic asset can make meaningful imagery unclear.',
        'Preserve the intrinsic aspect ratio unless the crop or stretch is intentional.',
        `${mediaSources(distorted)} ${distorted.map((image) => `${image.intrinsicWidth}×${image.intrinsicHeight} → ${image.renderedWidth}×${image.renderedHeight}`).join(' · ')}`
      )
    const missing = imagesMedia.images.filter(
      (image) => image.widthAttribute === null || image.heightAttribute === null
    )
    if (missing.length)
      return finding(
        this,
        'opportunity',
        'Some images omit intrinsic dimension attributes',
        'Width and height attributes can reserve layout space, but responsive CSS and aspect-ratio may provide equivalent sizing context.',
        'Add accurate width and height attributes where they fit the responsive implementation.',
        mediaSources(missing)
      )
    return finding(
      this,
      'passed',
      'Image dimensions are declared and proportionate',
      'No material aspect-ratio distortion or missing dimension attributes were detected.',
      null,
      `${imagesMedia.images.length} image(s) checked.`
    )
  }
}

export const responsiveMediaRule: Rule = {
  id: 'images-media/responsive-selection',
  category: 'images-media',
  evaluate({ imagesMedia, socialSharing }): Finding {
    const responsive = imagesMedia.images.filter(
      (image) => image.srcset || image.pictureSources.length
    )
    const lazy = imagesMedia.images.filter((image) => image.loading === 'lazy')
    const mediaWithTracks = imagesMedia.media.filter((item) => item.tracks.length)
    const autoplayAudio = imagesMedia.media.filter((item) => item.autoplay && !item.muted)
    if (autoplayAudio.length)
      return finding(
        this,
        'warning',
        'Audible media may autoplay',
        'Autoplaying audible media can obscure page content and presentation.',
        'Avoid autoplay for audible media or start it muted with clear controls.',
        `Media source(s): ${autoplayAudio.map((item) => item.sourceIndex).join(', ')}.`
      )
    const socialReference = socialSharing.images.length
      ? ` Social-card assets remain counted under Social sharing (${socialSharing.images.length} inspected).`
      : ''
    return finding(
      this,
      'passed',
      'Responsive image and media signals are inspectable',
      'Selected sources, candidates, loading behavior, and page-declared media tracks are reported without imposing universal file-size or format thresholds.',
      null,
      `${responsive.length} responsive image(s) · ${lazy.length} lazy image(s) · ${imagesMedia.media.length} audio/video element(s) · ${mediaWithTracks.length} with tracks.${socialReference}`
    )
  }
}

function mediaSources(images: ImagesMediaEvidence['images']): string {
  return `Image source(s): ${
    images
      .map((image) => image.sourceIndex)
      .slice(0, 12)
      .join(', ') || 'none'
  }.`
}
