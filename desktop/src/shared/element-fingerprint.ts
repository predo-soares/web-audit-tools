export interface ElementDescriptor {
  tagName: string
  id?: string | null
  visibleText?: string | null
}

export type ElementFingerprintLayer =
  | {
      type: 'id'
      id: string
    }
  | {
      type: 'text-tag'
      tagName: string
      text: string
    }

export interface ElementFingerprint {
  layers: ElementFingerprintLayer[]
}

export interface ResolvedElementFingerprint {
  index: number
  layer: ElementFingerprintLayer
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

export function buildElementFingerprint(descriptor: ElementDescriptor): ElementFingerprint | null {
  const layers: ElementFingerprintLayer[] = []
  const id = descriptor.id?.trim()
  const tagName = descriptor.tagName.toLowerCase()
  const text = normalizeVisibleText(descriptor.visibleText)

  if (id && !isMachineGeneratedId(id)) {
    layers.push({ type: 'id', id })
  }

  if (tagName && text) {
    layers.push({ type: 'text-tag', tagName, text })
  }

  if (!layers.length) return null
  return { layers }
}

export function resolveElementFingerprint(
  fingerprint: ElementFingerprint,
  candidates: readonly ElementDescriptor[]
): ResolvedElementFingerprint | null {
  for (const layer of fingerprint.layers) {
    const matches: number[] = []

    candidates.forEach((candidate, index) => {
      if (layer.type === 'id') {
        if (candidate.id === layer.id) matches.push(index)
        return
      }

      if (
        candidate.tagName.toLowerCase() === layer.tagName &&
        normalizeVisibleText(candidate.visibleText) === layer.text
      ) {
        matches.push(index)
      }
    })

    if (matches.length === 1) {
      return { index: matches[0], layer }
    }

    if (matches.length > 1) {
      return null
    }
  }

  return null
}
