import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { createElementMirror } from '../shared/element-mirror'
import {
  buildInspectionTarget,
  createInspectionMarkupNode,
  resolveInspectionTarget,
  type InspectionBoxModel,
  type InspectionElementDescriptor,
  type InspectionPageSnapshot,
  type InspectionTarget
} from '../shared/inspection'
import type { PaneId } from '../shared/pane-types'

function getPaneId(): PaneId {
  const arg = process.argv.find((value) => value.startsWith('--pane-id='))
  if (!arg) throw new Error('Missing --pane-id argument')
  return arg.replace('--pane-id=', '') as PaneId
}

const paneId = getPaneId()
const mirror = createElementMirror()
let disposeInspectionController: (() => void) | null = null
let applyRemoteInspectionSelection: ((target: InspectionTarget | null) => void) | null = null
let applyInspectionMismatch: ((missing: boolean) => void) | null = null

function isValueSyncControl(
  target: EventTarget | null
): target is HTMLInputElement | HTMLTextAreaElement {
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement))
    return false
  if (target instanceof HTMLInputElement) {
    const t = target.type
    if (
      t === 'checkbox' ||
      t === 'radio' ||
      t === 'hidden' ||
      t === 'button' ||
      t === 'submit' ||
      t === 'reset' ||
      t === 'file'
    ) {
      return false
    }
  }
  return true
}

function getValueSyncCandidates(): Array<
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
> {
  return Array.from(document.querySelectorAll(mirror.valueSyncSelector)).filter(
    (el): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
      if (
        !(el instanceof HTMLInputElement) &&
        !(el instanceof HTMLTextAreaElement) &&
        !(el instanceof HTMLSelectElement)
      ) {
        return false
      }
      if (el instanceof HTMLInputElement) {
        const t = el.type
        if (
          t === 'checkbox' ||
          t === 'radio' ||
          t === 'hidden' ||
          t === 'button' ||
          t === 'submit' ||
          t === 'reset' ||
          t === 'file'
        ) {
          return false
        }
      }
      return true
    }
  )
}

function reportScroll(): void {
  const doc = document.documentElement
  const max = doc.scrollHeight - doc.clientHeight
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max))
  const programmatic = Boolean(
    (window as Window & { __suppressScrollReport?: boolean }).__suppressScrollReport
  )

  if (!programmatic && max <= 0) return
  ipcRenderer.send(IPC.pane.scroll, paneId, ratio, programmatic, window.scrollY)
}

function normalizeInspectionText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function getInspectionStructuralPath(element: Element): string {
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

function describeInspectionElement(element: Element): InspectionElementDescriptor {
  const tagName = element.tagName.toLowerCase()
  const formField =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  const text =
    element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type)
      ? element.value
      : element instanceof HTMLElement
        ? element.innerText
        : element.textContent
  const ariaLabel = normalizeInspectionText(element.getAttribute('aria-label'))
  const labelledBy = normalizeInspectionText(element.getAttribute('aria-labelledby'))
  const labelledByText = labelledBy
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
  const label =
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? (element.labels?.[0]?.textContent ?? '')
      : ''
  const accessibleName =
    ariaLabel ||
    normalizeInspectionText(labelledByText) ||
    normalizeInspectionText(label) ||
    normalizeInspectionText(element.getAttribute('title')) ||
    null

  return {
    tagName,
    id: normalizeInspectionText(element.id) || null,
    testId:
      normalizeInspectionText(element.getAttribute('data-testid')) ||
      (formField ? normalizeInspectionText(element.getAttribute('name')) : '') ||
      null,
    accessibleName,
    role: normalizeInspectionText(element.getAttribute('role')) || tagName,
    visibleText: normalizeInspectionText(text) || null,
    structuralPath: getInspectionStructuralPath(element)
  }
}

function getInspectionSelector(descriptor: InspectionElementDescriptor): string | null {
  if (descriptor.id) return `#${descriptor.id}`
  if (descriptor.testId) return `[data-testid="${descriptor.testId}"]`
  return null
}

function captureInspectionBoxModel(style: CSSStyleDeclaration): InspectionBoxModel {
  return {
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
  }
}

function captureInspectionComputedProperties(
  element: Element,
  style: CSSStyleDeclaration
): Array<{ name: string; value: string; isAuthored: boolean }> {
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

function captureInspectionSnapshot(element: Element): InspectionPageSnapshot {
  const elements = Array.from(document.querySelectorAll('*'))
  const descriptors = elements.map(describeInspectionElement)
  const elementIndex = elements.indexOf(element)
  const descriptor = descriptors[elementIndex] ?? describeInspectionElement(element)
  const target = buildInspectionTarget(descriptor, descriptors, elementIndex)
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  const viewportWidth = document.documentElement.clientWidth
  const viewportHeight = document.documentElement.clientHeight
  const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0))
  const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0))

  return {
    target,
    selector: getInspectionSelector(descriptor),
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
      computedProperties: captureInspectionComputedProperties(element, style)
    },
    boxModel: captureInspectionBoxModel(style),
    markup: createInspectionMarkupNode(element, 'root', 2),
    outerHTML: element.outerHTML,
    url: window.location.href,
    capturedAt: Date.now()
  }
}

function installInspectionController(): void {
  disposeInspectionController?.()

  const root = document.createElement('div')
  root.setAttribute('data-audit-screens-inspection-layer', '')
  root.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:hidden;'
  const hover = document.createElement('div')
  const selected = document.createElement('div')
  const mismatch = document.createElement('div')
  hover.setAttribute('data-audit-screens-inspection-hover', '')
  selected.setAttribute('data-audit-screens-inspection-selected', '')
  mismatch.setAttribute('data-audit-screens-inspection-mismatch', '')
  mismatch.setAttribute('aria-hidden', 'true')
  hover.style.cssText =
    'position:fixed;display:none;pointer-events:none;border:1px solid rgba(129,140,248,.9);background:transparent;box-sizing:border-box;'
  selected.style.cssText =
    'position:fixed;display:none;pointer-events:none;border:2px solid rgba(251,191,36,.95);background:transparent;box-sizing:border-box;'
  mismatch.style.cssText =
    'position:fixed;inset:0;display:none;align-items:center;justify-content:center;pointer-events:none;background:rgba(9,9,11,.58);backdrop-filter:blur(1px);box-sizing:border-box;'
  const mismatchLabel = document.createElement('div')
  mismatchLabel.style.cssText =
    'border:1px solid rgba(255,255,255,.12);background:rgba(9,9,11,.72);padding:8px 12px;color:rgba(255,255,255,.58);font:500 11px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.04em;'
  mismatchLabel.textContent = 'Element not found'
  mismatch.append(mismatchLabel)
  root.append(mismatch, hover, selected)
  document.documentElement.append(root)

  let selectedElement: Element | null = null
  let hoverElement: Element | null = null
  let previewedElement: Element | null = null
  let previewTimer: number | null = null
  let staleReported = false
  let frame = 0

  const paint = (node: Element | null, outline: HTMLDivElement): void => {
    if (!node) {
      outline.style.display = 'none'
      return
    }
    const rect = node.getBoundingClientRect()
    outline.style.display = rect.width > 0 && rect.height > 0 ? 'block' : 'none'
    outline.style.left = `${rect.left}px`
    outline.style.top = `${rect.top}px`
    outline.style.width = `${rect.width}px`
    outline.style.height = `${rect.height}px`
  }

  const schedulePaint = (): void => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (selectedElement && !selectedElement.isConnected) {
        selectedElement = null
        if (!staleReported) {
          staleReported = true
          ipcRenderer.send(IPC.pane.inspectionStale, paneId)
        }
      }
      if (previewedElement && !previewedElement.isConnected) {
        previewedElement = null
        if (!staleReported) {
          staleReported = true
          ipcRenderer.send(IPC.pane.inspectionStale, paneId)
        }
      }
      paint(hoverElement, hover)
      paint(selectedElement, selected)
    })
  }

  const schedulePreview = (): void => {
    if (previewTimer !== null) window.clearTimeout(previewTimer)
    previewTimer = window.setTimeout(() => {
      previewTimer = null
      const target = hoverElement
      if (
        !target ||
        target === previewedElement ||
        !target.isConnected ||
        target === document.documentElement ||
        target === document.body
      ) {
        return
      }
      previewedElement = target
      staleReported = false
      const snapshot = captureInspectionSnapshot(target)
      ipcRenderer.send(IPC.pane.inspectionPreview, paneId, snapshot.target, snapshot)
    }, 60)
  }

  const handlePointerMove = (event: PointerEvent): void => {
    const target = event.target
    const nextElement =
      target instanceof Element &&
      target !== root &&
      target !== document.documentElement &&
      target !== document.body
        ? target
        : null
    if (nextElement !== hoverElement) {
      hoverElement = nextElement
      schedulePreview()
    }
    schedulePaint()
  }

  const handlePointerLeave = (): void => {
    hoverElement = null
    schedulePaint()
  }

  const handleClick = (event: MouseEvent): void => {
    const target = event.target
    if (
      window.location.href === 'about:blank' ||
      !(target instanceof Element) ||
      target === root ||
      target === document.documentElement ||
      target === document.body
    ) {
      return
    }
    selectedElement = target
    staleReported = false
    const snapshot = captureInspectionSnapshot(target)
    ipcRenderer.send(IPC.pane.inspectionSelect, paneId, snapshot.target, snapshot)
    schedulePaint()
  }

  const applySelection = (target: InspectionTarget | null): void => {
    if (!target) {
      selectedElement = null
      staleReported = false
      schedulePaint()
      return
    }
    const elements = Array.from(document.querySelectorAll('*'))
    const descriptors = elements.map(describeInspectionElement)
    const resolution = resolveInspectionTarget(target, descriptors)
    selectedElement =
      resolution.status === 'matched' && resolution.index !== null
        ? (elements[resolution.index] ?? null)
        : null
    staleReported = false
    schedulePaint()
  }

  const applyMismatch = (missing: boolean): void => {
    mismatch.style.display = missing ? 'flex' : 'none'
  }

  const handleEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    ipcRenderer.send(IPC.pane.inspectionEscape, paneId)
  }

  window.addEventListener('pointermove', handlePointerMove, true)
  window.addEventListener('pointerleave', handlePointerLeave, true)
  window.addEventListener('click', handleClick, true)
  window.addEventListener('keydown', handleEscape, true)
  window.addEventListener('scroll', schedulePaint, { passive: true })
  window.addEventListener('resize', schedulePaint)
  const mutationObserver = new MutationObserver(schedulePaint)
  mutationObserver.observe(document.documentElement, {
    subtree: true,
    childList: true
  })
  applyRemoteInspectionSelection = applySelection
  applyInspectionMismatch = applyMismatch

  disposeInspectionController = () => {
    window.removeEventListener('pointermove', handlePointerMove, true)
    window.removeEventListener('pointerleave', handlePointerLeave, true)
    window.removeEventListener('click', handleClick, true)
    window.removeEventListener('keydown', handleEscape, true)
    window.removeEventListener('scroll', schedulePaint)
    window.removeEventListener('resize', schedulePaint)
    mutationObserver.disconnect()
    if (frame) cancelAnimationFrame(frame)
    root.remove()
    if (previewTimer !== null) window.clearTimeout(previewTimer)
    selectedElement = null
    hoverElement = null
    previewedElement = null
    applyRemoteInspectionSelection = null
    applyInspectionMismatch = null
    disposeInspectionController = null
  }
}

ipcRenderer.on(IPC.pane.inspectionMode, (_event, enabled: boolean) => {
  if (enabled) installInspectionController()
  else disposeInspectionController?.()
})

ipcRenderer.on(IPC.pane.inspectionSelection, (_event, target: InspectionTarget | null) => {
  applyRemoteInspectionSelection?.(target)
})

ipcRenderer.on(IPC.pane.inspectionMismatch, (_event, missing: boolean) => {
  applyInspectionMismatch?.(missing)
})

window.addEventListener(
  'scroll',
  () => {
    if ((window as Window & { __scrollRaf?: number }).__scrollRaf) return
    ;(window as Window & { __scrollRaf?: number }).__scrollRaf = requestAnimationFrame(() => {
      ;(window as Window & { __scrollRaf?: number }).__scrollRaf = undefined
      reportScroll()
    })
  },
  { passive: true }
)

window.addEventListener(
  'click',
  (e: MouseEvent) => {
    if ((window as Window & { __suppressClickReport?: boolean }).__suppressClickReport) return
    const rawTarget = e.target
    const interactive = mirror.findClickableAncestor(e.target)
    if (!interactive) return

    const allInteractive = mirror.collectClickableCandidates()

    const fingerprint = mirror.buildFingerprint(interactive, allInteractive, {
      disambiguateAcrossLayers: true
    })
    if (!fingerprint) return

    const inputTarget =
      rawTarget instanceof HTMLInputElement
        ? rawTarget
        : interactive instanceof HTMLInputElement
          ? interactive
          : null
    if (inputTarget) {
      const duplicateIndex = mirror.getInputGroupMatchIndex(inputTarget)
      if (duplicateIndex !== null) {
        fingerprint.indexAmongMatches = duplicateIndex
      }
      if (inputTarget.type === 'checkbox' || inputTarget.type === 'radio') {
        setTimeout(() => {
          fingerprint.checkedState = inputTarget.checked
          ipcRenderer.send(IPC.pane.click, paneId, fingerprint)
        }, 0)
        return
      }
    }

    ipcRenderer.send(IPC.pane.click, paneId, fingerprint)
  },
  true
)

// Mirror command-style keyboard shortcuts (⌘K, Ctrl+B, ⌥↑) across panes so a
// global page handler fires everywhere. Only key events with a non-shift
// modifier are forwarded: plain typing and Shift+letter (capitals) are text
// entry, already handled by value sync, and must not be mirrored here. App-level
// shortcuts (e.g. ⌘J) are preventDefault'd upstream via before-input, so they
// never reach this listener. Echo suppression is done in the main process by the
// echo ledger, so no in-page suppress flag is needed.
window.addEventListener(
  'keydown',
  (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey || e.altKey)) return
    if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift') return
    ipcRenderer.send(IPC.pane.key, paneId, {
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey
    })
  },
  true
)

const inputTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>()

window.addEventListener(
  'input',
  (e: Event) => {
    const target = e.target
    if (!isValueSyncControl(target)) return
    if ((window as Window & { __suppressValueReport?: boolean }).__suppressValueReport) return

    const prev = inputTimers.get(target)
    if (prev !== undefined) clearTimeout(prev)

    const timer = setTimeout(() => {
      inputTimers.delete(target)
      if ((window as Window & { __suppressValueReport?: boolean }).__suppressValueReport) return
      const fingerprint = mirror.buildFingerprint(target, getValueSyncCandidates())
      if (!fingerprint) return
      ipcRenderer.send(IPC.pane.value, paneId, fingerprint, target.value)
    }, 100)

    inputTimers.set(target, timer)
  },
  true
)

window.addEventListener(
  'change',
  (e: Event) => {
    const target = e.target
    if (!(target instanceof HTMLSelectElement)) return
    if ((window as Window & { __suppressValueReport?: boolean }).__suppressValueReport) return

    const fingerprint = mirror.buildFingerprint(target, getValueSyncCandidates())
    if (!fingerprint) return
    ipcRenderer.send(IPC.pane.select, paneId, fingerprint, target.value, target.selectedIndex)
  },
  true
)

window.addEventListener(
  'submit',
  (e: SubmitEvent) => {
    if ((window as Window & { __suppressSubmitReport?: boolean }).__suppressSubmitReport) return

    const form = e.target
    if (!(form instanceof HTMLFormElement)) return

    const fingerprint = mirror.buildFingerprint(form, Array.from(document.querySelectorAll('form')))
    if (!fingerprint) return
    ipcRenderer.send(IPC.pane.submit, paneId, fingerprint)
  },
  true
)

contextBridge.exposeInMainWorld('__paneId', paneId)
