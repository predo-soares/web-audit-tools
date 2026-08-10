import { contextBridge, ipcRenderer } from 'electron'
import { createElementMirror } from '../shared/element-mirror'
import {
  buildInspectionTarget,
  type InspectionElementDescriptor,
  type InspectionPageSnapshot
} from '../shared/inspection'
import type { PaneId } from '../shared/types'

function getPaneId(): PaneId {
  const arg = process.argv.find((value) => value.startsWith('--pane-id='))
  if (!arg) throw new Error('Missing --pane-id argument')
  return arg.replace('--pane-id=', '') as PaneId
}

const paneId = getPaneId()
const mirror = createElementMirror()
let disposeInspectionController: (() => void) | null = null

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
  ipcRenderer.send('pane:scroll', paneId, ratio, programmatic, window.scrollY)
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
      maxHeight: style.maxHeight
    },
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
  hover.setAttribute('data-audit-screens-inspection-hover', '')
  selected.setAttribute('data-audit-screens-inspection-selected', '')
  hover.style.cssText =
    'position:fixed;display:none;pointer-events:none;border:1px solid rgba(129,140,248,.9);background:transparent;box-sizing:border-box;'
  selected.style.cssText =
    'position:fixed;display:none;pointer-events:none;border:2px solid rgba(251,191,36,.95);background:transparent;box-sizing:border-box;'
  root.append(hover, selected)
  document.documentElement.append(root)

  let selectedElement: Element | null = null
  let hoverElement: Element | null = null
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
      paint(hoverElement, hover)
      paint(selectedElement, selected)
    })
  }

  const handlePointerMove = (event: PointerEvent): void => {
    const target = event.target
    hoverElement = target instanceof Element && target !== root ? target : null
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
    const snapshot = captureInspectionSnapshot(target)
    ipcRenderer.send('pane:inspection-select', paneId, snapshot.target, snapshot)
    schedulePaint()
  }

  const handleEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    ipcRenderer.send('pane:inspection-escape', paneId)
  }

  window.addEventListener('pointermove', handlePointerMove, true)
  window.addEventListener('pointerleave', handlePointerLeave, true)
  window.addEventListener('click', handleClick, true)
  window.addEventListener('keydown', handleEscape, true)
  window.addEventListener('scroll', schedulePaint, { passive: true })
  window.addEventListener('resize', schedulePaint)

  disposeInspectionController = () => {
    window.removeEventListener('pointermove', handlePointerMove, true)
    window.removeEventListener('pointerleave', handlePointerLeave, true)
    window.removeEventListener('click', handleClick, true)
    window.removeEventListener('keydown', handleEscape, true)
    window.removeEventListener('scroll', schedulePaint)
    window.removeEventListener('resize', schedulePaint)
    if (frame) cancelAnimationFrame(frame)
    root.remove()
    selectedElement = null
    hoverElement = null
    disposeInspectionController = null
  }
}

ipcRenderer.on('pane:inspection-mode', (_event, enabled: boolean) => {
  if (enabled) installInspectionController()
  else disposeInspectionController?.()
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
          ipcRenderer.send('pane:click', paneId, fingerprint)
        }, 0)
        return
      }
    }

    ipcRenderer.send('pane:click', paneId, fingerprint)
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
    ipcRenderer.send('pane:key', paneId, {
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
      ipcRenderer.send('pane:value', paneId, fingerprint, target.value)
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
    ipcRenderer.send('pane:select', paneId, fingerprint, target.value, target.selectedIndex)
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
    ipcRenderer.send('pane:submit', paneId, fingerprint)
  },
  true
)

contextBridge.exposeInMainWorld('__paneId', paneId)
