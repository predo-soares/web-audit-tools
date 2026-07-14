import type {
  AuditAccessContext,
  DeliveredEvidence,
  EvidenceOrigin,
  MetadataDeclaration,
  RenderedAuditSnapshot,
  ResolvedMetadataValue,
  SearchAppearanceResult,
  SearchMetadataKind
} from '../../shared/seo-audit'
import { sanitizeUrl } from '../../shared/seo-sanitize'

export interface SearchAppearanceEvidence {
  rendered: RenderedAuditSnapshot
  delivered: DeliveredEvidence
  accessContext: AuditAccessContext
}

export function resolveSearchAppearance(
  evidence: SearchAppearanceEvidence,
  auditedUrl: string
): SearchAppearanceResult {
  const declared = collectDeclarations(evidence)
  const resolve = (kind: SearchMetadataKind): ResolvedMetadataValue => {
    const candidates = declared.filter((item) => item.kind === kind && item.value.trim() !== '')
    const rendered = candidates.find((item) => item.origin === 'rendered')
    const selected = rendered ?? candidates[0] ?? null
    if (!selected) {
      return { value: null, origin: null, reason: `No non-empty ${kind} declaration was found.` }
    }
    let value = selected.value.trim()
    if (kind === 'canonical' || kind === 'favicon') value = resolveUrl(value, auditedUrl)
    return {
      value,
      origin: selected.origin,
      reason:
        selected.origin === 'rendered'
          ? `Selected the first non-empty rendered ${kind} declaration in document order.`
          : `No non-empty rendered ${kind} existed; selected the first delivered declaration.`
    }
  }

  const title = resolve('title')
  const description = resolve('description')
  const renderedDescriptionIndex = (evidence.rendered.descriptions ?? []).findIndex(
    (value) => value.trim() === description.value
  )

  return {
    declared,
    resolved: {
      title,
      description,
      canonical: resolve('canonical'),
      favicon: resolve('favicon')
    },
    measurements: {
      titleCharacters: title.value?.length ?? 0,
      titleWidthPx: title.origin === 'rendered' ? (evidence.rendered.titleWidthPx ?? null) : null,
      descriptionCharacters: description.value?.length ?? 0,
      descriptionWidthPx:
        description.origin === 'rendered' && renderedDescriptionIndex >= 0
          ? (evidence.rendered.descriptionWidthsPx?.[renderedDescriptionIndex] ?? null)
          : null
    }
  }
}

function collectDeclarations(evidence: SearchAppearanceEvidence): MetadataDeclaration[] {
  const output: MetadataDeclaration[] = []
  const add = (
    origin: EvidenceOrigin,
    kind: SearchMetadataKind,
    values: (string | null)[],
    source: string
  ): void => {
    values.forEach((value, order) => {
      if (value !== null) output.push({ kind, value, origin, order, source })
    })
  }

  if (evidence.delivered.available) {
    add('delivered', 'title', [evidence.delivered.documentTitle], '<title>')
    add(
      'delivered',
      'description',
      evidence.delivered.descriptions ?? [],
      '<meta name="description">'
    )
    add('delivered', 'canonical', evidence.delivered.canonicals ?? [], '<link rel="canonical">')
    add('delivered', 'favicon', evidence.delivered.favicons ?? [], '<link rel="icon">')
  }
  add('rendered', 'title', [evidence.rendered.title], '<title>')
  add('rendered', 'description', evidence.rendered.descriptions ?? [], '<meta name="description">')
  add('rendered', 'canonical', evidence.rendered.canonicals ?? [], '<link rel="canonical">')
  add('rendered', 'favicon', evidence.rendered.favicons ?? [], '<link rel="icon">')
  return output
}

function resolveUrl(value: string, base: string): string {
  try {
    return sanitizeUrl(new URL(value, base).toString())
  } catch {
    return value
  }
}
