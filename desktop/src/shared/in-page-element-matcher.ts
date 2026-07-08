import {
  classifyMirrorFailure,
  resolveElementFingerprint,
  type ElementDescriptor,
  type ElementFingerprint,
  type MirrorFailureReason,
  type ResolvedElementFingerprint
} from './element-fingerprint'
import { describeElementInPage } from './in-page-element-descriptor'

export interface InPageMatchResult<TElement extends Element = Element> {
  elements: TElement[]
  descriptors: ElementDescriptor[]
  resolved: ResolvedElementFingerprint | null
  element: TElement | null
  failureReason?: MirrorFailureReason
}

export function getDescribedElementsInPage<TElement extends Element>(
  elements: readonly TElement[],
  normalizeText: (text: string | null | undefined) => string
): { elements: TElement[]; descriptors: ElementDescriptor[] } {
  const describedElements = [...elements]
  return {
    elements: describedElements,
    descriptors: describedElements.map((element) => describeElementInPage(element, normalizeText))
  }
}

export function resolveFingerprintInPage<TElement extends Element>(
  fingerprint: ElementFingerprint,
  elements: readonly TElement[],
  normalizeText: (text: string | null | undefined) => string
): InPageMatchResult<TElement> {
  const described = getDescribedElementsInPage(elements, normalizeText)
  const resolved = resolveElementFingerprint(fingerprint, described.descriptors)
  const element = resolved ? described.elements[resolved.index] ?? null : null

  if (!resolved || !element) {
    return {
      ...described,
      resolved,
      element: null,
      failureReason: resolved
        ? 'not-found'
        : classifyMirrorFailure(fingerprint, described.descriptors)
    }
  }

  return {
    ...described,
    resolved,
    element
  }
}
