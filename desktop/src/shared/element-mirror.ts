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
  checkedState?: boolean
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

export interface InPageMatchResult<TElement extends Element = Element> {
  elements: TElement[]
  descriptors: ElementDescriptor[]
  resolved: ResolvedElementFingerprint | null
  element: TElement | null
  failureReason?: MirrorFailureReason
}

export interface BuildFingerprintOptions {
  /**
   * After the primary layer pass, scan the remaining layers for one where the
   * target is among multiple matches and record its position. Used on the
   * click path so a later layer resolving ambiguously in a target pane can
   * still be disambiguated by index-among-matches.
   */
  disambiguateAcrossLayers?: boolean
}

export interface ElementMirror {
  interactiveSelector: string
  /**
   * Widened "clickable" selector (ADR 0005 amendment): the semantic
   * {@link interactiveSelector} plus non-semantic elements that still present
   * as clickable — inline `onclick`, dialog/backdrop affordances
   * (`[role="dialog"]`, `[aria-modal="true"]`). The `cursor: pointer` case
   * needs a computed-style read and lives in {@link isClickable}, not here.
   */
  clickableSelector: string
  valueSyncSelector: string
  /** Whether an element is a clickable ancestor candidate (selector or pointer cursor). */
  isClickable(element: Element): boolean
  /** Nearest self-or-ancestor clickable element, or null. Replaces the raw `closest(interactiveSelector)`. */
  findClickableAncestor(target: EventTarget | Element | null): Element | null
  /**
   * Every clickable element in the tree, in document order, disabled controls
   * excluded. Capture and resolution MUST use this same set so
   * index-among-matches stays aligned across panes.
   */
  collectClickableCandidates(root?: ParentNode): Element[]
  normalizeVisibleText(text: string | null | undefined): string
  isMachineGeneratedId(id: string): boolean
  buildElementFingerprint(descriptor: ElementDescriptor): ElementFingerprint | null
  buildElementFingerprintInContext(
    descriptor: ElementDescriptor,
    allCandidates: readonly ElementDescriptor[],
    candidateIndex?: number
  ): ElementFingerprint | null
  matchesLayer(layer: ElementFingerprintLayer, candidate: ElementDescriptor): boolean
  getLayerMatches(
    layer: ElementFingerprintLayer,
    candidates: readonly ElementDescriptor[]
  ): number[]
  resolveElementFingerprint(
    fingerprint: ElementFingerprint,
    candidates: readonly ElementDescriptor[]
  ): ResolvedElementFingerprint | null
  classifyMirrorFailure(
    fingerprint: ElementFingerprint,
    candidates: readonly ElementDescriptor[]
  ): Exclude<MirrorFailureReason, 'occluded'>
  describeElement(element: Element): ElementDescriptor
  getInputGroupMatchIndex(element: HTMLInputElement): number | null
  buildFingerprint(
    target: Element,
    candidates: readonly Element[],
    options?: BuildFingerprintOptions
  ): ElementFingerprint | null
  resolveFingerprint<TElement extends Element>(
    fingerprint: ElementFingerprint,
    elements: readonly TElement[]
  ): InPageMatchResult<TElement>
}

/**
 * Element mirror — the one implementation of Interaction sync's element
 * identity (ADR 0005): fingerprint building on the source pane, fingerprint
 * resolution on target panes, and failure classification.
 *
 * Three consumers share this single artifact:
 * - pane-preload calls `createElementMirror()` directly (source side)
 * - WebContentsViewEngine injects `(${createElementMirror.toString()})()`
 *   into target panes via CDP Runtime.evaluate
 * - unit tests exercise the same interface in Node/jsdom
 *
 * INVARIANT: because the factory is serialized with `.toString()` and
 * re-evaluated inside arbitrary pages, its body must be fully self-contained —
 * no references to module scope, imports, or emit helpers at runtime. Only
 * type-level imports/annotations (erased at compile time) are allowed.
 * TypeScript checks the whole module as one unit, so the injected copy can
 * never drift from the copy the preload and tests run.
 */
export function createElementMirror(): ElementMirror {
  const interactiveSelector = [
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="option"]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',')

  // ADR 0005 amendment: a "clickable ancestor" widens "interactive ancestor" to
  // the non-semantic elements that still respond to a click — modal backdrops,
  // clickable cards, custom controls built from divs. The selector-expressible
  // affordances live here; the `cursor: pointer` case needs computed style and
  // is handled in isClickable/isPointerCursorOrigin.
  const clickableSelector = [
    interactiveSelector,
    '[onclick]',
    '[role="dialog"]',
    '[aria-modal="true"]'
  ].join(',')

  const valueSyncSelector = 'input:not([type="hidden"]),textarea,select'

  function isDisabled(element: Element): boolean {
    return Boolean((element as Partial<HTMLInputElement>).disabled)
  }

  function computedCursor(element: Element): string | null {
    const view = element.ownerDocument?.defaultView
    if (!view || typeof view.getComputedStyle !== 'function') return null
    try {
      return view.getComputedStyle(element).cursor || null
    } catch {
      return null
    }
  }

  // `cursor` inherits, so a child of a clickable element also computes to
  // `pointer`. Only the element that ORIGINATES the pointer cursor (its parent
  // is not also pointer) counts as clickable — otherwise every descendant of a
  // button would become its own candidate and resolution would go ambiguous.
  function isPointerCursorOrigin(element: Element): boolean {
    if (computedCursor(element) !== 'pointer') return false
    const parent = element.parentElement
    return !parent || computedCursor(parent) !== 'pointer'
  }

  function isClickable(element: Element): boolean {
    if (isDisabled(element)) return false
    if (element.matches(clickableSelector)) return true
    return isPointerCursorOrigin(element)
  }

  function findClickableAncestor(target: EventTarget | Element | null): Element | null {
    if (!(target instanceof Element)) return null
    let current: Element | null = target
    while (current) {
      if (isClickable(current)) return current
      current = current.parentElement
    }
    return null
  }

  function collectClickableCandidates(root: ParentNode = document): Element[] {
    const result: Element[] = []
    const seen = new Set<Element>()
    for (const element of Array.from(root.querySelectorAll(clickableSelector))) {
      if (isDisabled(element) || seen.has(element)) continue
      seen.add(element)
      result.push(element)
    }
    // Second pass picks up pointer-cursor origins the selector can't express.
    for (const element of Array.from(root.querySelectorAll('*'))) {
      if (seen.has(element) || isDisabled(element)) continue
      if (isPointerCursorOrigin(element)) {
        seen.add(element)
        result.push(element)
      }
    }
    return result
  }

  function normalizeVisibleText(text: string | null | undefined): string {
    return (text ?? '').replace(/\s+/g, ' ').trim()
  }

  function isMachineGeneratedId(id: string): boolean {
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

  function matchesLayer(layer: ElementFingerprintLayer, candidate: ElementDescriptor): boolean {
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

  function getLayerMatches(
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

  function buildElementFingerprint(descriptor: ElementDescriptor): ElementFingerprint | null {
    const layers = buildLayers(descriptor)
    if (!layers.length) return null
    return { layers }
  }

  function buildElementFingerprintInContext(
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

  function resolveElementFingerprint(
    fingerprint: ElementFingerprint,
    candidates: readonly ElementDescriptor[]
  ): ResolvedElementFingerprint | null {
    const identityLayers = fingerprint.layers.filter((layer) => layer.type !== 'structural-path')
    let sawIdentityMatch = false
    for (const layer of fingerprint.layers) {
      const matches = getLayerMatches(layer, candidates)
      const isStructuralPath = layer.type === 'structural-path'

      if (matches.length === 1) {
        if (isStructuralPath && identityLayers.length > 0 && !sawIdentityMatch) {
          continue
        }
        return { index: matches[0], layer }
      }

      if (matches.length > 1) {
        if (!isStructuralPath) {
          sawIdentityMatch = true
        }
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

  function classifyMirrorFailure(
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

  function getVisibleText(element: Element): string {
    if (element instanceof HTMLInputElement) {
      if (['button', 'submit', 'reset'].includes(element.type)) {
        return normalizeVisibleText(element.value)
      }
      return ''
    }

    return normalizeVisibleText(
      element instanceof HTMLElement ? element.innerText : element.textContent
    )
  }

  function getStructuralPath(element: Element): string {
    const parts: string[] = []
    let current: Element | null = element
    while (current && current !== document.body) {
      const parent = current.parentElement
      if (parent) {
        const index = Array.from(parent.children).indexOf(current) + 1
        parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`)
      } else {
        parts.unshift(current.tagName.toLowerCase())
      }
      current = parent
    }
    return parts.join(' > ')
  }

  function getInputGroupMatchIndex(element: HTMLInputElement): number | null {
    if (!['checkbox', 'radio'].includes(element.type)) return null
    if (!element.name) return null

    const matches = Array.from(document.querySelectorAll('input')).filter(
      (candidate): candidate is HTMLInputElement =>
        candidate instanceof HTMLInputElement &&
        !candidate.disabled &&
        candidate.type === element.type &&
        candidate.name === element.name
    )

    if (matches.length <= 1) return null
    const index = matches.indexOf(element)
    return index >= 0 ? index : null
  }

  function getDescriptorTestId(element: Element, isFormField: boolean): string | null {
    const explicitTestId = element.getAttribute('data-testid')
    if (explicitTestId) return explicitTestId

    if (element instanceof HTMLFormElement) {
      return element.getAttribute('name') || null
    }

    if (!isFormField) return null

    if (element instanceof HTMLInputElement) {
      if ((element.type === 'checkbox' || element.type === 'radio') && element.name) {
        const groupIndex = getInputGroupMatchIndex(element)
        if (groupIndex !== null) {
          return `${element.type}:${element.name}:${groupIndex}`
        }
      }

      return element.name || null
    }

    return element.getAttribute('name') || null
  }

  function describeElement(element: Element): ElementDescriptor {
    const tagName = element.tagName.toLowerCase()
    const isFormField =
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement

    return {
      tagName,
      id: element.id || null,
      visibleText: getVisibleText(element),
      testId: getDescriptorTestId(element, isFormField),
      ariaLabel: element.getAttribute('aria-label') || null,
      role: element.getAttribute('role') || null,
      structuralPath: getStructuralPath(element)
    }
  }

  function buildFingerprint(
    target: Element,
    candidates: readonly Element[],
    options?: BuildFingerprintOptions
  ): ElementFingerprint | null {
    const list = [...candidates]
    const descriptors = list.map(describeElement)
    const targetIndex = list.indexOf(target)
    const descriptorForContext =
      targetIndex !== -1 ? descriptors[targetIndex] : describeElement(target)

    const fingerprint = buildElementFingerprintInContext(
      descriptorForContext,
      descriptors,
      targetIndex
    )
    if (!fingerprint) return null

    if (
      options?.disambiguateAcrossLayers &&
      fingerprint.indexAmongMatches === undefined &&
      targetIndex !== -1
    ) {
      for (const layer of fingerprint.layers) {
        const matchIndices = getLayerMatches(layer, descriptors)
        if (matchIndices.length <= 1) continue
        const position = matchIndices.indexOf(targetIndex)
        if (position !== -1) {
          fingerprint.indexAmongMatches = position
          break
        }
      }
    }

    return fingerprint
  }

  function resolveFingerprint<TElement extends Element>(
    fingerprint: ElementFingerprint,
    elements: readonly TElement[]
  ): InPageMatchResult<TElement> {
    const describedElements = [...elements]
    const descriptors = describedElements.map(describeElement)
    const resolved = resolveElementFingerprint(fingerprint, descriptors)
    const element = resolved ? (describedElements[resolved.index] ?? null) : null

    if (!resolved || !element) {
      return {
        elements: describedElements,
        descriptors,
        resolved,
        element: null,
        failureReason: resolved ? 'not-found' : classifyMirrorFailure(fingerprint, descriptors)
      }
    }

    return {
      elements: describedElements,
      descriptors,
      resolved,
      element
    }
  }

  return {
    interactiveSelector,
    clickableSelector,
    valueSyncSelector,
    isClickable,
    findClickableAncestor,
    collectClickableCandidates,
    normalizeVisibleText,
    isMachineGeneratedId,
    buildElementFingerprint,
    buildElementFingerprintInContext,
    matchesLayer,
    getLayerMatches,
    resolveElementFingerprint,
    classifyMirrorFailure,
    describeElement,
    getInputGroupMatchIndex,
    buildFingerprint,
    resolveFingerprint
  }
}
