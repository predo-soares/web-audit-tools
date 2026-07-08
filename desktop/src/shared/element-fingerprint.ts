export interface ElementDescriptor {
  tagName: string
  id?: string | null
  visibleText?: string | null
  testId?: string | null
  ariaLabel?: string | null
  role?: string | null
  structuralPath?: string | null
}

export type ElementFingerprintLayer =
  | {
      type: 'id'
      id: string
    }
  | {
      type: 'testid'
      testId: string
    }
  | {
      type: 'accessible-name'
      tagName: string
      role: string
      name: string
    }
  | {
      type: 'text-tag'
      tagName: string
      text: string
    }
  | {
      type: 'structural-path'
      path: string
    }

export interface ElementFingerprint {
  layers: ElementFingerprintLayer[]
  indexAmongMatches?: number
}

export interface ResolvedElementFingerprint {
  index: number
  layer: ElementFingerprintLayer
}

export type MirrorFailureReason = 'not-found' | 'ambiguous' | 'occluded'

export interface MirrorFailureLog {
  fingerprint: ElementFingerprint
  paneId: string
  reason: MirrorFailureReason
}

export function normalizeVisibleText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

export function isMachineGeneratedId(id: string): boolean {
  const value = id.trim()
  if (!value) return true
  if (/^:.*:$/.test(value)) return true
  if (/^[0-9]+$/.test(value)) return true
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return true
  }
  if (/^(radix|headlessui|mui|ember|react-aria|reach)-[_:-]?[a-z0-9-]{6,}$/i.test(value)) {
    return true
  }
  if (/^[a-z]+[_:-]?[0-9]{5,}$/i.test(value)) return true
  if (/^[a-z0-9]{12,}$/i.test(value) && /[a-z]/i.test(value) && /[0-9]/.test(value)) {
    return true
  }
  return false
}

function buildLayers(descriptor: ElementDescriptor): ElementFingerprintLayer[] {
  const layers: ElementFingerprintLayer[] = []
  const id = descriptor.id?.trim()
  const tagName = descriptor.tagName.toLowerCase()
  const text = normalizeVisibleText(descriptor.visibleText)

  if (id && !isMachineGeneratedId(id)) {
    layers.push({ type: 'id', id })
  }

  const testId = descriptor.testId?.trim()
  if (testId) {
    layers.push({ type: 'testid', testId })
  }

  const ariaLabel = descriptor.ariaLabel?.trim()
  if (ariaLabel) {
    const role = descriptor.role?.trim() || tagName
    layers.push({ type: 'accessible-name', tagName, role, name: normalizeVisibleText(ariaLabel) })
  }

  if (tagName && text) {
    layers.push({ type: 'text-tag', tagName, text })
  }

  const structuralPath = descriptor.structuralPath?.trim()
  if (structuralPath) {
    layers.push({ type: 'structural-path', path: structuralPath })
  }

  return layers
}

export function buildElementFingerprint(descriptor: ElementDescriptor): ElementFingerprint | null {
  const layers = buildLayers(descriptor)
  if (!layers.length) return null
  return { layers }
}

export function buildElementFingerprintInContext(
  descriptor: ElementDescriptor,
  allCandidates: readonly ElementDescriptor[],
  candidateIndex?: number
): ElementFingerprint | null {
  const layers = buildLayers(descriptor)
  if (!layers.length) return null

  // Find the first layer that has any matches; if multiple matches, record the
  // index of this descriptor among them so the resolver can pick the right one.
  for (const layer of layers) {
    const matchIndices = getLayerMatches(layer, allCandidates)
    if (matchIndices.length === 0) continue

    if (matchIndices.length === 1) {
      return { layers }
    }

    // Multiple matches — find this descriptor's position among them
    const descriptorIdx = candidateIndex ?? allCandidates.indexOf(descriptor as ElementDescriptor)
    const positionAmongMatches = matchIndices.indexOf(descriptorIdx)
    if (positionAmongMatches !== -1) {
      return { layers, indexAmongMatches: positionAmongMatches }
    }
    // Descriptor not found among candidates — return without index
    return { layers }
  }

  // No layer matched any candidate — still return layers so resolution can try
  return { layers }
}

export function getLayerMatches(
  layer: ElementFingerprintLayer,
  candidates: readonly ElementDescriptor[]
): number[] {
  const matches: number[] = []
  candidates.forEach((candidate, index) => {
    if (matchesLayer(layer, candidate)) {
      matches.push(index)
    }
  })
  return matches
}

export function matchesLayer(layer: ElementFingerprintLayer, candidate: ElementDescriptor): boolean {
  if (layer.type === 'id') {
    return candidate.id === layer.id
  }
  if (layer.type === 'testid') {
    return candidate.testId === layer.testId
  }
  if (layer.type === 'accessible-name') {
    return (
      candidate.tagName.toLowerCase() === layer.tagName &&
      (candidate.role?.trim() || candidate.tagName.toLowerCase()) === layer.role &&
      normalizeVisibleText(candidate.ariaLabel) === layer.name
    )
  }
  if (layer.type === 'text-tag') {
    return (
      candidate.tagName.toLowerCase() === layer.tagName &&
      normalizeVisibleText(candidate.visibleText) === layer.text
    )
  }
  if (layer.type === 'structural-path') {
    return candidate.structuralPath === layer.path
  }
  return false
}

export function resolveElementFingerprint(
  fingerprint: ElementFingerprint,
  candidates: readonly ElementDescriptor[]
): ResolvedElementFingerprint | null {
  for (const layer of fingerprint.layers) {
    const matches = getLayerMatches(layer, candidates)

    if (matches.length === 1) {
      return { index: matches[0], layer }
    }

    if (matches.length > 1) {
      if (
        fingerprint.indexAmongMatches !== undefined &&
        fingerprint.indexAmongMatches >= 0 &&
        fingerprint.indexAmongMatches < matches.length
      ) {
        return { index: matches[fingerprint.indexAmongMatches], layer }
      }
      continue
    }
  }

  return null
}

export function classifyMirrorFailure(
  fingerprint: ElementFingerprint,
  candidates: readonly ElementDescriptor[]
): Exclude<MirrorFailureReason, 'occluded'> {
  for (const layer of fingerprint.layers) {
    const matches = getLayerMatches(layer, candidates)
    if (matches.length > 1 && fingerprint.indexAmongMatches === undefined) {
      return 'ambiguous'
    }
  }

  return 'not-found'
}
