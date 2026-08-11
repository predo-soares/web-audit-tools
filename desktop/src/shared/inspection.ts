import type { DeviceProfile, PaneId } from './pane-types'

export type InspectionMatchStatus = 'matched' | 'not-found' | 'ambiguous' | 'unavailable' | 'stale'

export type InspectionIdentityLayer =
  | { type: 'id'; value: string }
  | { type: 'test-id'; value: string }
  | { type: 'accessible-name'; tagName: string; role: string; value: string }
  | { type: 'visible-text'; tagName: string; value: string }
  | { type: 'structural-path'; value: string }

export interface InspectionElementDescriptor {
  tagName: string
  id: string | null
  testId: string | null
  accessibleName: string | null
  role: string | null
  visibleText: string | null
  structuralPath: string | null
}

export interface InspectionTarget {
  descriptor: InspectionElementDescriptor
  layers: InspectionIdentityLayer[]
  strongestIdentity: InspectionIdentityLayer | null
  indexAmongMatches?: number
}

export interface InspectionResolution {
  status: InspectionMatchStatus
  index: number | null
  layer: InspectionIdentityLayer | null
  provenance: string | null
}

export interface InspectionPageResolution {
  status: InspectionMatchStatus
  snapshot: InspectionPageSnapshot | null
  provenance: string | null
}

export interface InspectionGeometry {
  x: number
  y: number
  width: number
  height: number
}

export interface InspectionVisibility {
  visible: boolean
  clipped: boolean
  offscreen: boolean
}

export interface InspectionLayout {
  display: string
  position: string
  width: string
  height: string
  overflow: string
  flex: string | null
  grid: string | null
}

export interface InspectionStyles {
  margin: string
  padding: string
  color: string
  background: string
  font: string
  fontSize: string
  lineHeight: string
  fontWeight: string
  zIndex: string
  minWidth: string
  maxWidth: string
  minHeight: string
  maxHeight: string
  computedProperties?: Array<{ name: string; value: string; isAuthored?: boolean }>
}

export type InspectionMarkupNode = {
  id: string
  type: 'element' | 'text' | 'comment'
  tagName?: string
  attributes?: Array<{ name: string; value: string }>
  text?: string
  children?: InspectionMarkupNode[]
  hasChildren: boolean
}

export interface InspectionBoxModel {
  margin: { top: string; right: string; bottom: string; left: string }
  border: { top: string; right: string; bottom: string; left: string }
  padding: { top: string; right: string; bottom: string; left: string }
  content: { width: string; height: string }
  boxSizing: string
}

export interface InspectionPageSnapshot {
  target: InspectionTarget
  selector: string | null
  domPath: string | null
  geometry: InspectionGeometry
  visibility: InspectionVisibility
  layout: InspectionLayout
  styles: InspectionStyles
  boxModel: InspectionBoxModel
  markup: InspectionMarkupNode
  outerHTML: string
  url: string
  capturedAt: number
}

/**
 * Capture one markup node without serializing or reparsing outerHTML. When
 * includeChildren is false, callers get a cheap node summary that can be
 * expanded later through the page-context children resolver.
 */
export function createInspectionMarkupNode(
  node: Node,
  id: string,
  childrenDepth: number | boolean = false
): InspectionMarkupNode {
  const depth =
    childrenDepth === true ? 1 : childrenDepth === false ? 0 : Math.max(0, childrenDepth)
  if (node.nodeType === Node.TEXT_NODE) {
    return { id, type: 'text', text: node.textContent ?? '', hasChildren: false }
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    return { id, type: 'comment', text: node.textContent ?? '', hasChildren: false }
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return { id, type: 'text', text: node.textContent ?? '', hasChildren: false }
  }

  const element = node as Element
  const childNodes = Array.from(element.childNodes)
  return {
    id,
    type: 'element',
    tagName: element.tagName.toLowerCase(),
    attributes: Array.from(element.attributes).map(({ name, value }) => ({ name, value })),
    ...(depth > 0
      ? {
          children: childNodes.map((child, index) =>
            createInspectionMarkupNode(child, `${id}.${index}`, depth - 1)
          )
        }
      : {}),
    hasChildren: childNodes.length > 0
  }
}

export interface InspectionDeviceContext {
  paneId: PaneId
  preset: string
  viewport: { width: number; height: number }
  dpr: number
  touch: boolean
  url: string
  capturedAt: number
}

export interface InspectionRecord {
  paneId: PaneId
  source: boolean
  status: InspectionMatchStatus
  device: InspectionDeviceContext
  target: InspectionTarget
  snapshot: InspectionPageSnapshot | null
  provenance: string | null
  error?: string
}

export interface InspectionState {
  active: boolean
  record: InspectionRecord | null
  records: InspectionRecord[]
}

export interface InspectionDifference {
  category: 'geometry' | 'layout' | 'styles'
  key: string
  label: string
  sourceValue: string
  targetValues: Array<{ paneId: PaneId; value: string }>
}

export const EMPTY_INSPECTION_STATE: InspectionState = {
  active: false,
  record: null,
  records: []
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function layerValue(layer: InspectionIdentityLayer): string {
  if (layer.type === 'accessible-name') return `${layer.tagName}:${layer.role}:${layer.value}`
  if (layer.type === 'visible-text') return `${layer.tagName}:${layer.value}`
  return layer.value
}

export function buildInspectionLayers(
  descriptor: InspectionElementDescriptor
): InspectionIdentityLayer[] {
  const tagName = normalize(descriptor.tagName).toLowerCase()
  const layers: InspectionIdentityLayer[] = []
  const id = normalize(descriptor.id)
  const testId = normalize(descriptor.testId)
  const accessibleName = normalize(descriptor.accessibleName)
  const role = normalize(descriptor.role) || tagName
  const visibleText = normalize(descriptor.visibleText)
  const structuralPath = normalize(descriptor.structuralPath)

  if (id) layers.push({ type: 'id', value: id })
  if (testId) layers.push({ type: 'test-id', value: testId })
  if (accessibleName) {
    layers.push({ type: 'accessible-name', tagName, role, value: accessibleName })
  }
  if (tagName && visibleText) layers.push({ type: 'visible-text', tagName, value: visibleText })
  if (structuralPath) layers.push({ type: 'structural-path', value: structuralPath })
  return layers
}

export function buildInspectionTarget(
  descriptor: InspectionElementDescriptor,
  candidates: readonly InspectionElementDescriptor[] = [],
  candidateIndex = -1
): InspectionTarget {
  const layers = buildInspectionLayers(descriptor)
  let indexAmongMatches: number | undefined

  for (const layer of layers) {
    const matches = candidates.flatMap((candidate, index) =>
      matchesInspectionLayer(layer, candidate) ? [index] : []
    )
    if (matches.length <= 1) continue
    const position = matches.indexOf(candidateIndex)
    if (position !== -1) {
      indexAmongMatches = position
      break
    }
  }

  return {
    descriptor,
    layers,
    strongestIdentity: layers[0] ?? null,
    ...(indexAmongMatches === undefined ? {} : { indexAmongMatches })
  }
}

export function matchesInspectionLayer(
  layer: InspectionIdentityLayer,
  candidate: InspectionElementDescriptor
): boolean {
  const tagName = normalize(candidate.tagName).toLowerCase()
  if (layer.type === 'id') return normalize(candidate.id) === layer.value
  if (layer.type === 'test-id') return normalize(candidate.testId) === layer.value
  if (layer.type === 'accessible-name') {
    return (
      tagName === layer.tagName &&
      (normalize(candidate.role) || tagName) === layer.role &&
      normalize(candidate.accessibleName) === layer.value
    )
  }
  if (layer.type === 'visible-text') {
    return tagName === layer.tagName && normalize(candidate.visibleText) === layer.value
  }
  return normalize(candidate.structuralPath) === layer.value
}

export function resolveInspectionTarget(
  target: InspectionTarget,
  candidates: readonly InspectionElementDescriptor[]
): InspectionResolution {
  let sawIdentityMatch = false
  let sawAmbiguousIdentity = false
  let structuralMatch: { index: number; layer: InspectionIdentityLayer } | null = null

  for (const layer of target.layers) {
    const matches = candidates.flatMap((candidate, index) =>
      matchesInspectionLayer(layer, candidate) ? [index] : []
    )
    if (matches.length === 0) continue

    if (layer.type === 'structural-path') {
      if (matches.length === 1) structuralMatch = { index: matches[0], layer }
      continue
    }

    sawIdentityMatch = true
    if (matches.length === 1) {
      return {
        status: 'matched',
        index: matches[0],
        layer,
        provenance: layerValue(layer)
      }
    }

    if (
      target.indexAmongMatches !== undefined &&
      target.indexAmongMatches >= 0 &&
      target.indexAmongMatches < matches.length
    ) {
      const index = matches[target.indexAmongMatches]
      return { status: 'matched', index, layer, provenance: layerValue(layer) }
    }

    sawAmbiguousIdentity = true
  }

  if (structuralMatch && !sawIdentityMatch) {
    return {
      status: 'matched',
      index: structuralMatch.index,
      layer: structuralMatch.layer,
      provenance: layerValue(structuralMatch.layer)
    }
  }

  if (sawAmbiguousIdentity) {
    return { status: 'ambiguous', index: null, layer: null, provenance: null }
  }

  return { status: 'not-found', index: null, layer: null, provenance: null }
}

export function createInspectionDeviceContext(
  paneId: PaneId,
  profile: DeviceProfile,
  url: string,
  capturedAt = Date.now()
): InspectionDeviceContext {
  return {
    paneId,
    preset: profile.name,
    viewport: { width: profile.width, height: profile.height },
    dpr: profile.deviceScaleFactor,
    touch: profile.touch,
    url,
    capturedAt
  }
}

export function createInspectionRecord(input: {
  paneId: PaneId
  source: boolean
  target: InspectionTarget
  profile: DeviceProfile
  url: string
  snapshot?: InspectionPageSnapshot | null
  status?: InspectionMatchStatus
  provenance?: string | null
  error?: string
}): InspectionRecord {
  const strongestIdentity = input.snapshot?.target.strongestIdentity ?? null
  return {
    paneId: input.paneId,
    source: input.source,
    status: input.status ?? (input.snapshot ? 'matched' : 'unavailable'),
    device: createInspectionDeviceContext(input.paneId, input.profile, input.url),
    target: input.target,
    snapshot: input.snapshot ?? null,
    provenance: input.provenance ?? (strongestIdentity ? layerValue(strongestIdentity) : null),
    ...(input.error ? { error: input.error } : {})
  }
}

/**
 * Page-world inspection resolver. It is serialized by the engine and therefore
 * deliberately has no references to module scope. It returns evidence only;
 * it never mutates the page or uses coordinates to identify a target.
 */
export function createInspectionPageResolver(target: InspectionTarget): InspectionPageResolution {
  const normalizePage = (value: string | null | undefined): string =>
    (value ?? '').replace(/\s+/g, ' ').trim()

  const structuralPath = (element: Element): string => {
    const parts: string[] = []
    let current: Element | null = element
    while (current && current !== document.body) {
      const parent = current.parentElement
      const index = parent ? Array.from(parent.children).indexOf(current) + 1 : 1
      parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`)
      current = parent
    }
    return parts.join(' > ')
  }

  const accessibleName = (element: Element): string | null => {
    const ariaLabel = normalizePage(element.getAttribute('aria-label'))
    if (ariaLabel) return ariaLabel
    const labelledBy = normalizePage(element.getAttribute('aria-labelledby'))
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
      if (normalizePage(text)) return normalizePage(text)
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const label = element.labels?.[0]?.textContent
      if (normalizePage(label)) return normalizePage(label)
      if (normalizePage(element.getAttribute('placeholder'))) {
        return normalizePage(element.getAttribute('placeholder'))
      }
    }
    const title = normalizePage(element.getAttribute('title'))
    if (title) return title
    return null
  }

  const describe = (element: Element): InspectionElementDescriptor => {
    const tagName = element.tagName.toLowerCase()
    const text =
      element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type)
        ? element.value
        : element instanceof HTMLElement
          ? element.innerText
          : element.textContent
    const formField =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    return {
      tagName,
      id: normalizePage(element.id) || null,
      testId:
        normalizePage(element.getAttribute('data-testid')) ||
        (formField ? normalizePage(element.getAttribute('name')) : '') ||
        null,
      accessibleName: accessibleName(element),
      role: normalizePage(element.getAttribute('role')) || tagName,
      visibleText: normalizePage(text) || null,
      structuralPath: structuralPath(element)
    }
  }

  const elements = Array.from(document.querySelectorAll('*'))
  const descriptors = elements.map(describe)
  const matches = (layer: InspectionIdentityLayer): number[] => {
    const equal = (candidate: InspectionElementDescriptor): boolean => {
      const tagName = normalizePage(candidate.tagName).toLowerCase()
      if (layer.type === 'id') return normalizePage(candidate.id) === layer.value
      if (layer.type === 'test-id') return normalizePage(candidate.testId) === layer.value
      if (layer.type === 'accessible-name') {
        return (
          tagName === layer.tagName &&
          (normalizePage(candidate.role) || tagName) === layer.role &&
          normalizePage(candidate.accessibleName) === layer.value
        )
      }
      if (layer.type === 'visible-text') {
        return tagName === layer.tagName && normalizePage(candidate.visibleText) === layer.value
      }
      return normalizePage(candidate.structuralPath) === layer.value
    }
    return descriptors.flatMap((candidate, index) => (equal(candidate) ? [index] : []))
  }

  let selectedIndex: number | null = null
  let selectedLayer: InspectionIdentityLayer | null = null
  let sawIdentityMatch = false
  let sawAmbiguous = false
  for (const layer of target.layers) {
    const candidates = matches(layer)
    if (!candidates.length) continue
    if (layer.type === 'structural-path') {
      if (candidates.length === 1 && !sawIdentityMatch) {
        selectedIndex = candidates[0]
        selectedLayer = layer
      }
      continue
    }
    sawIdentityMatch = true
    if (candidates.length === 1) {
      selectedIndex = candidates[0]
      selectedLayer = layer
      break
    }
    if (
      target.indexAmongMatches !== undefined &&
      target.indexAmongMatches >= 0 &&
      target.indexAmongMatches < candidates.length
    ) {
      selectedIndex = candidates[target.indexAmongMatches]
      selectedLayer = layer
      break
    }
    sawAmbiguous = true
  }

  if (selectedIndex === null || !elements[selectedIndex]) {
    return {
      status: sawAmbiguous ? 'ambiguous' : 'not-found',
      snapshot: null,
      provenance: null
    }
  }

  const element = elements[selectedIndex]
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  const pageLayerValue = (layer: InspectionIdentityLayer): string => {
    if (layer.type === 'accessible-name') return `${layer.tagName}:${layer.role}:${layer.value}`
    if (layer.type === 'visible-text') return `${layer.tagName}:${layer.value}`
    return layer.value
  }
  const buildPageTarget = (nextDescriptor: InspectionElementDescriptor): InspectionTarget => {
    const tagName = normalizePage(nextDescriptor.tagName).toLowerCase()
    const layers: InspectionIdentityLayer[] = []
    const id = normalizePage(nextDescriptor.id)
    const testId = normalizePage(nextDescriptor.testId)
    const name = normalizePage(nextDescriptor.accessibleName)
    const role = normalizePage(nextDescriptor.role) || tagName
    const text = normalizePage(nextDescriptor.visibleText)
    const path = normalizePage(nextDescriptor.structuralPath)
    if (id) layers.push({ type: 'id', value: id })
    if (testId) layers.push({ type: 'test-id', value: testId })
    if (name) layers.push({ type: 'accessible-name', tagName, role, value: name })
    if (tagName && text) layers.push({ type: 'visible-text', tagName, value: text })
    if (path) layers.push({ type: 'structural-path', value: path })
    return { descriptor: nextDescriptor, layers, strongestIdentity: layers[0] ?? null }
  }
  const captureMarkupNode = (node: Node, id: string, childrenDepth = 0): InspectionMarkupNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      return { id, type: 'text', text: node.textContent ?? '', hasChildren: false }
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      return { id, type: 'comment', text: node.textContent ?? '', hasChildren: false }
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return { id, type: 'text', text: node.textContent ?? '', hasChildren: false }
    }
    const markupElement = node as Element
    const childNodes = Array.from(markupElement.childNodes)
    return {
      id,
      type: 'element',
      tagName: markupElement.tagName.toLowerCase(),
      attributes: Array.from(markupElement.attributes).map(({ name, value }) => ({ name, value })),
      ...(childrenDepth > 0
        ? {
            children: childNodes.map((child, index) =>
              captureMarkupNode(child, `${id}.${index}`, childrenDepth - 1)
            )
          }
        : {}),
      hasChildren: childNodes.length > 0
    }
  }
  const captureComputedProperties = (
    element: Element,
    style: CSSStyleDeclaration
  ): Array<{ name: string; value: string; isAuthored: boolean }> => {
    const inlineStyle = (element as Element & { style?: CSSStyleDeclaration }).style
    const authoredStyles: CSSStyleDeclaration[] = inlineStyle ? [inlineStyle] : []
    const collectRules = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        if (rule.type === CSSRule.STYLE_RULE) {
          const styleRule = rule as CSSStyleRule
          try {
            if (element.matches(styleRule.selectorText)) authoredStyles.push(styleRule.style)
          } catch {
            // Ignore selectors that the browser cannot match in this document.
          }
          continue
        }
        if ('cssRules' in rule) {
          try {
            collectRules((rule as CSSGroupingRule).cssRules)
          } catch {
            // Cross-origin stylesheets can reject cssRules access.
          }
        }
      }
    }
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        collectRules(sheet.cssRules)
      } catch {
        // Cross-origin stylesheets can reject cssRules access.
      }
    }

    const hasAuthoredValue = (name: string): boolean =>
      authoredStyles.some((authoredStyle) => authoredStyle.getPropertyValue(name) !== '')
    const properties: Array<{ name: string; value: string; isAuthored: boolean }> = []
    for (let index = 0; index < style.length; index += 1) {
      const name = style.item(index)
      if (name) {
        properties.push({
          name,
          value: style.getPropertyValue(name),
          isAuthored: hasAuthoredValue(name)
        })
      }
    }
    return properties
  }
  const captureBoxModel = (style: CSSStyleDeclaration): InspectionBoxModel => ({
    margin: {
      top: style.marginTop,
      right: style.marginRight,
      bottom: style.marginBottom,
      left: style.marginLeft
    },
    border: {
      top: style.borderTopWidth,
      right: style.borderRightWidth,
      bottom: style.borderBottomWidth,
      left: style.borderLeftWidth
    },
    padding: {
      top: style.paddingTop,
      right: style.paddingRight,
      bottom: style.paddingBottom,
      left: style.paddingLeft
    },
    content: { width: style.width, height: style.height },
    boxSizing: style.boxSizing
  })
  const viewportWidth = document.documentElement.clientWidth
  const viewportHeight = document.documentElement.clientHeight
  const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0))
  const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0))
  const descriptor = descriptors[selectedIndex]
  const selector = descriptor.id
    ? `#${CSS.escape(descriptor.id)}`
    : descriptor.testId
      ? `[data-testid="${CSS.escape(descriptor.testId)}"]`
      : null
  const snapshot: InspectionPageSnapshot = {
    target: buildPageTarget(descriptor),
    selector,
    domPath: descriptor.structuralPath,
    geometry: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    visibility: {
      visible: visibleWidth > 0 && visibleHeight > 0 && style.visibility !== 'hidden',
      clipped: visibleWidth < rect.width || visibleHeight < rect.height,
      offscreen:
        rect.bottom < 0 || rect.right < 0 || rect.left > viewportWidth || rect.top > viewportHeight
    },
    layout: {
      display: style.display,
      position: style.position,
      width: style.width,
      height: style.height,
      overflow: style.overflow,
      flex: style.flex || null,
      grid: style.grid || null
    },
    styles: {
      margin: style.margin,
      padding: style.padding,
      color: style.color,
      background: style.backgroundColor,
      font: style.font,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      fontWeight: style.fontWeight,
      zIndex: style.zIndex,
      minWidth: style.minWidth,
      maxWidth: style.maxWidth,
      minHeight: style.minHeight,
      maxHeight: style.maxHeight,
      computedProperties: captureComputedProperties(element, style)
    },
    boxModel: captureBoxModel(style),
    markup: captureMarkupNode(element, 'root', 2),
    outerHTML: element.outerHTML,
    url: window.location.href,
    capturedAt: Date.now()
  }

  return {
    status: 'matched',
    snapshot,
    provenance: selectedLayer ? pageLayerValue(selectedLayer) : null
  }
}

export function getInspectionPageExpression(target: InspectionTarget): string {
  return `(${createInspectionPageResolver.toString()})(${JSON.stringify(target)})`
}

/**
 * Resolve one node in the selected element's subtree and return only its
 * direct children. This stays page-context-local so expanding a tree node does
 * not require serializing the complete subtree into the initial snapshot.
 */
export function createInspectionMarkupChildrenResolver(
  target: InspectionTarget,
  nodeId: string
): InspectionMarkupNode[] {
  const normalizePage = (value: string | null | undefined): string =>
    (value ?? '').replace(/\s+/g, ' ').trim()

  const structuralPath = (element: Element): string => {
    const parts: string[] = []
    let current: Element | null = element
    while (current && current !== document.body) {
      const parent = current.parentElement
      const index = parent ? Array.from(parent.children).indexOf(current) + 1 : 1
      parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`)
      current = parent
    }
    return parts.join(' > ')
  }

  const accessibleName = (element: Element): string | null => {
    const ariaLabel = normalizePage(element.getAttribute('aria-label'))
    if (ariaLabel) return ariaLabel
    const labelledBy = normalizePage(element.getAttribute('aria-labelledby'))
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
      if (normalizePage(text)) return normalizePage(text)
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const label = element.labels?.[0]?.textContent
      if (normalizePage(label)) return normalizePage(label)
      if (normalizePage(element.getAttribute('placeholder'))) {
        return normalizePage(element.getAttribute('placeholder'))
      }
    }
    const title = normalizePage(element.getAttribute('title'))
    if (title) return title
    return null
  }

  const describe = (element: Element): InspectionElementDescriptor => {
    const tagName = element.tagName.toLowerCase()
    const text =
      element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type)
        ? element.value
        : element instanceof HTMLElement
          ? element.innerText
          : element.textContent
    const formField =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    return {
      tagName,
      id: normalizePage(element.id) || null,
      testId:
        normalizePage(element.getAttribute('data-testid')) ||
        (formField ? normalizePage(element.getAttribute('name')) : '') ||
        null,
      accessibleName: accessibleName(element),
      role: normalizePage(element.getAttribute('role')) || tagName,
      visibleText: normalizePage(text) || null,
      structuralPath: structuralPath(element)
    }
  }

  const elements = Array.from(document.querySelectorAll('*'))
  const descriptors = elements.map(describe)
  const matches = (layer: InspectionIdentityLayer): number[] => {
    const equal = (candidate: InspectionElementDescriptor): boolean => {
      const tagName = normalizePage(candidate.tagName).toLowerCase()
      if (layer.type === 'id') return normalizePage(candidate.id) === layer.value
      if (layer.type === 'test-id') return normalizePage(candidate.testId) === layer.value
      if (layer.type === 'accessible-name') {
        return (
          tagName === layer.tagName &&
          (normalizePage(candidate.role) || tagName) === layer.role &&
          normalizePage(candidate.accessibleName) === layer.value
        )
      }
      if (layer.type === 'visible-text') {
        return tagName === layer.tagName && normalizePage(candidate.visibleText) === layer.value
      }
      return normalizePage(candidate.structuralPath) === layer.value
    }
    return descriptors.flatMap((candidate, index) => (equal(candidate) ? [index] : []))
  }

  let selectedIndex: number | null = null
  let sawIdentityMatch = false
  let sawAmbiguous = false
  for (const layer of target.layers) {
    const candidates = matches(layer)
    if (!candidates.length) continue
    if (layer.type === 'structural-path') {
      if (candidates.length === 1 && !sawIdentityMatch) selectedIndex = candidates[0]
      continue
    }
    sawIdentityMatch = true
    if (candidates.length === 1) {
      selectedIndex = candidates[0]
      break
    }
    if (
      target.indexAmongMatches !== undefined &&
      target.indexAmongMatches >= 0 &&
      target.indexAmongMatches < candidates.length
    ) {
      selectedIndex = candidates[target.indexAmongMatches]
      break
    }
    sawAmbiguous = true
  }

  if (
    selectedIndex === null ||
    sawAmbiguous ||
    !elements[selectedIndex] ||
    !/^root(?:\.\d+)*$/.test(nodeId)
  ) {
    return []
  }

  let node: Node = elements[selectedIndex]
  for (const segment of nodeId.split('.').slice(1)) {
    const index = Number(segment)
    const next = node.childNodes[index]
    if (!next) return []
    node = next
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const element = node as Element
  return Array.from(element.childNodes).map((child, index) => {
    const childId = `${nodeId}.${index}`
    if (child.nodeType === Node.TEXT_NODE) {
      return { id: childId, type: 'text', text: child.textContent ?? '', hasChildren: false }
    }
    if (child.nodeType === Node.COMMENT_NODE) {
      return { id: childId, type: 'comment', text: child.textContent ?? '', hasChildren: false }
    }
    if (child.nodeType !== Node.ELEMENT_NODE) {
      return { id: childId, type: 'text', text: child.textContent ?? '', hasChildren: false }
    }
    const childElement = child as Element
    return {
      id: childId,
      type: 'element',
      tagName: childElement.tagName.toLowerCase(),
      attributes: Array.from(childElement.attributes).map(({ name, value }) => ({ name, value })),
      hasChildren: childElement.childNodes.length > 0
    }
  })
}

export function getInspectionMarkupChildrenExpression(
  target: InspectionTarget,
  nodeId: string
): string {
  return `(${createInspectionMarkupChildrenResolver.toString()})(${JSON.stringify(target)},${JSON.stringify(nodeId)})`
}

export function formatInspectionStatus(status: InspectionMatchStatus): string {
  if (status === 'not-found') return 'Not found'
  if (status === 'ambiguous') return 'Ambiguous'
  if (status === 'unavailable') return 'Unavailable'
  if (status === 'stale') return 'Stale'
  return 'Matched'
}

const GEOMETRY_FIELDS: Array<keyof InspectionGeometry> = ['x', 'y', 'width', 'height']
const LAYOUT_FIELDS: Array<keyof InspectionLayout> = [
  'display',
  'position',
  'width',
  'height',
  'overflow',
  'flex',
  'grid'
]
const STYLE_FIELDS: Array<keyof InspectionStyles> = [
  'margin',
  'padding',
  'color',
  'background',
  'font',
  'fontSize',
  'lineHeight',
  'fontWeight',
  'zIndex',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight'
]

function humanizeInspectionKey(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
}

function inspectionValue(value: unknown): string {
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

export function getInspectionDifferences(
  records: readonly InspectionRecord[]
): InspectionDifference[] {
  const source = records.find((record) => record.source && record.snapshot)
  if (!source?.snapshot) return []
  const matchedTargets = records.filter(
    (record) => !record.source && record.status === 'matched' && record.snapshot
  )
  if (!matchedTargets.length) return []

  const rows: InspectionDifference[] = []
  const addRows = <T extends object>(
    category: InspectionDifference['category'],
    sourceValues: T,
    targetValues: Array<{ paneId: PaneId; values: T }>,
    fields: readonly (keyof T)[]
  ): void => {
    for (const key of fields) {
      const sourceValue = inspectionValue(sourceValues[key])
      const targets = targetValues.map(({ paneId, values }) => ({
        paneId,
        value: inspectionValue(values[key])
      }))
      if (targets.some(({ value }) => value !== sourceValue)) {
        rows.push({
          category,
          key: String(key),
          label: humanizeInspectionKey(String(key)),
          sourceValue,
          targetValues: targets
        })
      }
    }
  }

  addRows(
    'geometry',
    source.snapshot.geometry,
    matchedTargets.map((record) => ({ paneId: record.paneId, values: record.snapshot!.geometry })),
    GEOMETRY_FIELDS
  )
  addRows(
    'layout',
    source.snapshot.layout,
    matchedTargets.map((record) => ({ paneId: record.paneId, values: record.snapshot!.layout })),
    LAYOUT_FIELDS
  )
  addRows(
    'styles',
    source.snapshot.styles,
    matchedTargets.map((record) => ({ paneId: record.paneId, values: record.snapshot!.styles })),
    STYLE_FIELDS
  )
  return rows
}

function formatInspectionGeometry(geometry: InspectionGeometry): string {
  return `x=${geometry.x}; y=${geometry.y}; width=${geometry.width}; height=${geometry.height}`
}

function formatInspectionVisibility(visibility: InspectionVisibility): string {
  return `visible=${visibility.visible}; clipped=${visibility.clipped}; offscreen=${visibility.offscreen}`
}

function formatInspectionLayout(layout: InspectionLayout): string {
  return [
    `display=${layout.display}`,
    `position=${layout.position}`,
    `width=${layout.width}`,
    `height=${layout.height}`,
    `overflow=${layout.overflow}`,
    `flex=${layout.flex ?? 'none'}`,
    `grid=${layout.grid ?? 'none'}`
  ].join('; ')
}

function formatInspectionStyles(styles: InspectionStyles): string {
  return [
    `margin=${styles.margin}`,
    `padding=${styles.padding}`,
    `color=${styles.color}`,
    `background=${styles.background}`,
    `font=${styles.font}`,
    `fontSize=${styles.fontSize}`,
    `lineHeight=${styles.lineHeight}`,
    `fontWeight=${styles.fontWeight}`,
    `zIndex=${styles.zIndex}`,
    `minWidth=${styles.minWidth}`,
    `maxWidth=${styles.maxWidth}`,
    `minHeight=${styles.minHeight}`,
    `maxHeight=${styles.maxHeight}`
  ].join('; ')
}

function formatInspectionRecordContext(record: InspectionRecord): string[] {
  const lines = [
    `- pane: ${record.paneId}${record.source ? ' (source)' : ''}`,
    `  status: ${formatInspectionStatus(record.status)}`,
    `  device: ${record.device.preset}`,
    `  viewport: ${record.device.viewport.width}x${record.device.viewport.height}`,
    `  dpr: ${record.device.dpr}`,
    `  touch: ${record.device.touch}`,
    `  url: ${record.device.url}`,
    `  observedAtEpochMs: ${record.device.capturedAt}`,
    `  matchProvenance: ${record.provenance ?? 'none'}`
  ]
  if (!record.snapshot) {
    lines.push(`  evidence: none (${formatInspectionStatus(record.status)})`)
    if (record.error) lines.push(`  error: ${record.error}`)
    return lines
  }

  lines.push(`  selector: ${record.snapshot.selector ?? 'none'}`)
  lines.push(`  domPath: ${record.snapshot.domPath ?? 'none'}`)
  lines.push(`  geometry: ${formatInspectionGeometry(record.snapshot.geometry)}`)
  lines.push(`  visibility: ${formatInspectionVisibility(record.snapshot.visibility)}`)
  lines.push(`  layout: ${formatInspectionLayout(record.snapshot.layout)}`)
  lines.push(`  styles: ${formatInspectionStyles(record.snapshot.styles)}`)
  lines.push('  markup:')
  lines.push(record.snapshot.outerHTML)
  lines.push(`  pageCapturedAtEpochMs: ${record.snapshot.capturedAt}`)
  return lines
}

export function formatInspectionContext(state: InspectionState): string {
  const source = state.records.find((record) => record.source) ?? state.record
  const target = source?.target
  const lines = [
    'Audit Screens inspection context',
    'Evidence type: observed page evidence; this is not a guaranteed diagnosis or remediation.',
    `Inspect mode: ${state.active ? 'active' : 'inactive'}`,
    `Selection status: ${source ? formatInspectionStatus(source.status) : 'Unavailable'}`,
    `Selected element: ${target ? `<${target.descriptor.tagName}>` : 'none'}`,
    `Readable label: ${target?.descriptor.accessibleName ?? target?.descriptor.visibleText ?? 'none'}`,
    `Strongest identity: ${target ? formatInspectionIdentity(target) : 'none'}`,
    `Selector: ${source?.snapshot?.selector ?? 'none'}`,
    `DOM path: ${source?.snapshot?.domPath ?? 'none'}`,
    `Source freshness epoch ms: ${source?.device.capturedAt ?? 'none'}`,
    '',
    'Visible pane results:'
  ]

  if (!state.records.length) {
    lines.push('- none (no selection)')
  } else {
    for (const record of state.records) lines.push(...formatInspectionRecordContext(record))
  }

  lines.push('', 'Cross-pane differences:')
  const differences = getInspectionDifferences(state.records)
  if (!differences.length) {
    lines.push('- none measured or no matched target evidence')
  } else {
    for (const difference of differences) {
      const targets = difference.targetValues
        .map(({ paneId, value }) => `${paneId}=${value}`)
        .join('; ')
      lines.push(
        `- ${difference.category}.${difference.key}: source=${difference.sourceValue}; ${targets}`
      )
    }
  }

  lines.push(
    '',
    'Remediation clues:',
    '- Audit Screens does not infer a fix. Use the observed identity, geometry, layout, styles, and explicit match statuses as evidence for further investigation.'
  )
  return lines.join('\n')
}

export function formatInspectionIdentity(target: InspectionTarget): string {
  const layer = target.strongestIdentity
  if (!layer) return 'No stable identity signal'
  if (layer.type === 'accessible-name') return `${layer.type}: ${layer.value}`
  if (layer.type === 'visible-text') return `${layer.type}: ${layer.value}`
  return `${layer.type}: ${layer.value}`
}
