import type { Finding } from '../../../shared/seo-audit'
import { isLocalhostUrl } from '../../../shared/dev-context'
import { finding } from './finding'
import type { Rule } from './rule-types'

export const socialMetadataRule: Rule = {
  id: 'social-sharing/metadata-complete',
  category: 'social-sharing',
  evaluate({ socialSharing }): Finding {
    const og = socialSharing.resolved.openGraph
    const missing = [
      !og.title.value && 'title',
      !og.description.value && 'description',
      !og.image.value && 'image'
    ].filter(Boolean)
    if (missing.length) {
      return finding(
        this,
        'warning',
        'Social sharing metadata is incomplete',
        'Platforms may generate inconsistent cards when core title, description, or image values are absent.',
        'Declare Open Graph title, description, and image values for predictable sharing.',
        `Missing: ${missing.join(', ')}`
      )
    }
    return finding(
      this,
      'passed',
      'Core social sharing metadata resolves',
      'Representative cards have a title, description, and image candidate.',
      null,
      `Open Graph title: “${og.title.value}” · X card: ${socialSharing.resolved.x.card.value}`
    )
  }
}

export const socialDeclarationsRule: Rule = {
  id: 'social-sharing/declarations-consistent',
  category: 'social-sharing',
  evaluate({ socialSharing }): Finding {
    const problems: string[] = []
    for (const property of new Set(socialSharing.declared.map((item) => item.property))) {
      for (const origin of ['delivered', 'rendered'] as const) {
        const items = socialSharing.declared.filter(
          (item) => item.property === property && item.origin === origin
        )
        if (items.length > 1 && new Set(items.map((item) => item.value.trim())).size > 1) {
          problems.push(`${origin} ${property} has ${items.length} conflicting values`)
        }
      }
    }
    return problems.length
      ? finding(
          this,
          'warning',
          'Social metadata declarations conflict',
          'Platforms may select different values when the same property conflicts.',
          'Keep intentional multi-image declarations, but remove contradictory scalar values.',
          problems.join(' · ')
        )
      : finding(
          this,
          'passed',
          'Social metadata declarations are consistent',
          'No conflicting values were found within either evidence origin.',
          null,
          `${socialSharing.declared.length} declarations inspected.`
        )
  }
}

export const socialImagesRule: Rule = {
  id: 'social-sharing/images-valid',
  category: 'social-sharing',
  evaluate({ socialSharing }): Finding {
    const selected =
      socialSharing.resolved.openGraph.image.value ?? socialSharing.resolved.x.image.value
    if (!selected) {
      return finding(
        this,
        'warning',
        'No social image is declared',
        'Cards without an image are less distinctive and may use platform-generated fallbacks.',
        'Declare an absolute Open Graph image with a supported image format.',
        'No image candidate resolved.'
      )
    }
    const image = socialSharing.images.find(
      (item) => item.url === selected || item.finalUrl === selected
    )
    if (!image || !image.available) {
      return finding(
        this,
        'error',
        'Social image could not be verified',
        'Platforms may be unable to render the selected image.',
        'Use a publicly reachable image URL that responds successfully.',
        `${selected} (${image?.unavailableReason ?? 'not inspected'})`
      )
    }
    const problems: string[] = []
    if ((image.status ?? 500) >= 400) problems.push(`HTTP ${image.status}`)
    if (!image.mediaType?.startsWith('image/'))
      problems.push(`unsupported media type ${image.mediaType ?? 'unknown'}`)
    if (image.truncated) problems.push('exceeded the image byte budget')
    if (!image.width || !image.height) problems.push('dimensions could not be read')
    if (image.width && image.height && (image.width < 200 || image.height < 200))
      problems.push(`small dimensions ${image.width}×${image.height}`)
    if (selected.startsWith('http://') && !isLocalhostUrl(selected)) {
      problems.push('insecure HTTP URL')
    }
    const detail = `${image.finalUrl ?? image.url} · ${image.mediaType ?? 'unknown type'} · ${image.byteSize ?? 'unknown'} bytes · ${image.width ?? '?'}×${image.height ?? '?'} · sha256 ${image.sha256 ?? 'unavailable'}`
    return problems.length
      ? finding(
          this,
          'warning',
          'Social image may be unsuitable',
          'One or more image properties may reduce compatibility or card quality.',
          'Use a secure, supported, sufficiently large image that fits the platform card.',
          `${detail} · ${problems.join(', ')}`
        )
      : finding(
          this,
          'passed',
          'Social image is reachable and inspectable',
          'The selected image has a supported response and usable dimensions.',
          null,
          detail
        )
  }
}
