import { createHash } from 'crypto'
import type {
  DeliveredEvidence,
  EvidenceOrigin,
  RenderedAuditSnapshot,
  ResolvedMetadataValue,
  SocialCardMetadata,
  SocialDeclaration,
  SocialImageEvidence,
  SocialSharingResult
} from '../../shared/seo-audit'
import { sanitizeResponseHeaders, sanitizeUrl } from '../../shared/seo-sanitize'
import type { FetchTransport, RawResponse } from './referenced-fetch'

const MAX_IMAGE_BYTES = 8_000_000
const MAX_REDIRECTS = 5
const MAX_IMAGES = 6

export async function resolveSocialSharing(
  url: string,
  rendered: RenderedAuditSnapshot,
  delivered: DeliveredEvidence,
  transport: FetchTransport,
  requestHeaders: Record<string, string> = {}
): Promise<SocialSharingResult> {
  const declared = collectDeclarations(rendered, delivered)
  const property = (name: string): ResolvedMetadataValue => resolveProperty(declared, name)
  const fallback = (
    primary: string,
    alternatives: { value: ResolvedMetadataValue; label: string }[]
  ): ResolvedMetadataValue => {
    const direct = property(primary)
    if (direct.value) return direct
    const selected = alternatives.find((item) => item.value.value)
    return selected
      ? { ...selected.value, reason: `${primary} is absent; fell back to ${selected.label}.` }
      : { value: null, origin: null, reason: `${primary} and its documented fallbacks are absent.` }
  }
  const renderedTitle = value('title', rendered.title, 'rendered')
  const deliveredTitle = value('title', delivered.documentTitle, 'delivered')
  const searchTitle = renderedTitle.value ? renderedTitle : deliveredTitle
  const renderedDescription = value('description', rendered.descriptions?.[0] ?? null, 'rendered')
  const deliveredDescription = value(
    'description',
    delivered.descriptions?.[0] ?? null,
    'delivered'
  )
  const searchDescription = renderedDescription.value ? renderedDescription : deliveredDescription
  const pageUrl = value('page URL', url, 'rendered')

  const openGraph: SocialCardMetadata = {
    title: fallback('og:title', [{ value: searchTitle, label: 'the page title' }]),
    description: fallback('og:description', [
      { value: searchDescription, label: 'the meta description' }
    ]),
    image: property('og:image'),
    url: fallback('og:url', [{ value: pageUrl, label: 'the audited URL' }]),
    card: value('Open Graph card', 'link card', 'rendered')
  }
  const x: SocialCardMetadata = {
    title: fallback('twitter:title', [
      { value: openGraph.title, label: 'og:title' },
      { value: searchTitle, label: 'the page title' }
    ]),
    description: fallback('twitter:description', [
      { value: openGraph.description, label: 'og:description' },
      { value: searchDescription, label: 'the meta description' }
    ]),
    image: fallback('twitter:image', [{ value: openGraph.image, label: 'og:image' }]),
    url: fallback('twitter:url', [{ value: openGraph.url, label: 'og:url' }]),
    card: fallback('twitter:card', [
      { value: value('default card', 'summary', 'rendered'), label: 'summary' }
    ])
  }

  for (const card of [openGraph, x]) {
    if (card.image.value) card.image.value = absolute(card.image.value, url)
    if (card.url.value) card.url.value = absolute(card.url.value, url)
  }
  const imageUrls = unique(
    declared
      .filter((item) =>
        ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'].includes(item.property)
      )
      .map((item) => absolute(item.value, url))
      .filter(Boolean)
  ).slice(0, MAX_IMAGES)
  const images = await Promise.all(
    imageUrls.map((imageUrl) => inspectImage(imageUrl, transport, requestHeaders))
  )
  return { declared, resolved: { openGraph, x }, images }
}

export function unavailableSocialSharing(): SocialSharingResult {
  const missing = (label: string): ResolvedMetadataValue => ({
    value: null,
    origin: null,
    reason: `${label} is unavailable.`
  })
  const card = (): SocialCardMetadata => ({
    title: missing('title'),
    description: missing('description'),
    image: missing('image'),
    url: missing('URL'),
    card: missing('card')
  })
  return { declared: [], resolved: { openGraph: card(), x: card() }, images: [] }
}

function collectDeclarations(
  rendered: RenderedAuditSnapshot,
  delivered: DeliveredEvidence
): SocialDeclaration[] {
  return [
    ...(delivered.available
      ? (delivered.social ?? []).map((item, order) => ({
          ...item,
          origin: 'delivered' as const,
          order
        }))
      : []),
    ...(rendered.social ?? []).map((item, order) => ({
      ...item,
      origin: 'rendered' as const,
      order
    }))
  ]
}

function resolveProperty(declared: SocialDeclaration[], property: string): ResolvedMetadataValue {
  const candidates = declared.filter((item) => item.property === property && item.value.trim())
  const selected = candidates.find((item) => item.origin === 'rendered') ?? candidates[0]
  return selected
    ? {
        value: selected.value.trim(),
        origin: selected.origin,
        reason: `Selected the first non-empty ${selected.origin} ${property} declaration.`
      }
    : { value: null, origin: null, reason: `No non-empty ${property} declaration was found.` }
}

function value(label: string, raw: string | null, origin: EvidenceOrigin): ResolvedMetadataValue {
  return raw?.trim()
    ? { value: raw.trim(), origin, reason: `Used ${label}.` }
    : { value: null, origin: null, reason: `${label} is absent.` }
}

async function inspectImage(
  url: string,
  transport: FetchTransport,
  headers: Record<string, string>
): Promise<SocialImageEvidence> {
  let current = url
  const redirects: SocialImageEvidence['redirects'] = []
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: RawResponse
    try {
      response = await transport(current, new AbortController().signal, headers)
    } catch {
      return failedImage(url, redirects, 'network')
    }
    if (response.status >= 300 && response.status < 400 && response.location) {
      const next = absolute(response.location, current)
      redirects.push({ from: sanitizeUrl(current), to: sanitizeUrl(next), status: response.status })
      current = next
      continue
    }
    const responseHeaders = sanitizeResponseHeaders(response.headers)
    if (!response.readBytes) return failedImage(url, redirects, 'binary-unavailable')
    const body = await response.readBytes(MAX_IMAGE_BYTES)
    const dimensions = imageDimensions(body.bytes)
    return {
      url: sanitizeUrl(url),
      available: true,
      unavailableReason: null,
      status: response.status,
      finalUrl: sanitizeUrl(current),
      redirects,
      truncated: body.truncated,
      mediaType: responseHeaders['content-type']?.split(';')[0] ?? null,
      byteSize: body.bytes.byteLength,
      sha256: createHash('sha256').update(body.bytes).digest('hex'),
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null
    }
  }
  return failedImage(url, redirects, 'too-many-redirects')
}

function failedImage(
  url: string,
  redirects: SocialImageEvidence['redirects'],
  reason: string
): SocialImageEvidence {
  return {
    url: sanitizeUrl(url),
    available: false,
    unavailableReason: reason,
    status: null,
    finalUrl: null,
    redirects,
    truncated: false,
    mediaType: null,
    byteSize: null,
    sha256: null,
    width: null,
    height: null
  }
}

function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (
    bytes.length >= 10 &&
    (String.fromCharCode(...bytes.slice(0, 6)) === 'GIF87a' ||
      String.fromCharCode(...bytes.slice(0, 6)) === 'GIF89a')
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
  }
  return null
}

function absolute(value: string, base: string): string {
  try {
    return new URL(value, base).toString()
  } catch {
    return value
  }
}
function unique(values: string[]): string[] {
  return [...new Set(values)]
}
