import { contextBridge, ipcRenderer } from 'electron'
import {
  buildElementFingerprintInContext,
  normalizeVisibleText,
  type ElementDescriptor,
  type ElementFingerprintLayer
} from '../shared/element-fingerprint'
import type { PaneId } from '../shared/types'

function getPaneId(): PaneId {
  const arg = process.argv.find((value) => value.startsWith('--pane-id='))
  if (!arg) throw new Error('Missing --pane-id argument')
  return arg.replace('--pane-id=', '') as PaneId
}

const paneId = getPaneId()
const INTERACTIVE_SELECTOR = [
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

function findInteractiveAncestor(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null
  return target.closest(INTERACTIVE_SELECTOR)
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
  if (!(element instanceof HTMLInputElement) && !isFormField) return null
  if (!(element instanceof HTMLInputElement)) {
    return isFormField ? (element as HTMLInputElement).name || null : null
  }

  if ((element.type === 'checkbox' || element.type === 'radio') && element.name) {
    const groupIndex = getInputGroupMatchIndex(element)
    if (groupIndex !== null) {
      return `${element.type}:${element.name}:${groupIndex}`
    }
  }

  return element.name || null
}

function getLayerMatchIndices(
  layer: ElementFingerprintLayer,
  candidates: readonly ElementDescriptor[]
): number[] {
  return candidates.flatMap((candidate, index) => {
    if (layer.type === 'id') {
      return candidate.id === layer.id ? [index] : []
    }
    if (layer.type === 'testid') {
      return candidate.testId === layer.testId ? [index] : []
    }
    if (layer.type === 'accessible-name') {
      return candidate.tagName.toLowerCase() === layer.tagName &&
        (candidate.role?.trim() || candidate.tagName.toLowerCase()) === layer.role &&
        normalizeVisibleText(candidate.ariaLabel) === layer.name
        ? [index]
        : []
    }
    if (layer.type === 'text-tag') {
      return candidate.tagName.toLowerCase() === layer.tagName &&
        normalizeVisibleText(candidate.visibleText) === layer.text
        ? [index]
        : []
    }
    return candidate.structuralPath === layer.path ? [index] : []
  })
}

function getStructuralPath(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el
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

function isValueSyncControl(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return false
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

function getValueSyncCandidates(): Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
  return Array.from(document.querySelectorAll('input:not([type="hidden"]),textarea,select')).filter(
    (
      el
    ): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
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

function buildFingerprintFromCandidates(target: Element, candidates: Element[]): ReturnType<typeof buildElementFingerprintInContext> {
  const descriptors = candidates.map(describeElement)
  const targetIndex = candidates.indexOf(target)
  const descriptorForContext = targetIndex !== -1 ? descriptors[targetIndex] : describeElement(target)
  return buildElementFingerprintInContext(descriptorForContext, descriptors, targetIndex)
}

function reportScroll(): void {
  const doc = document.documentElement
  const max = doc.scrollHeight - doc.clientHeight
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max))
  const programmatic = Boolean(
    (window as Window & { __suppressScrollReport?: boolean }).__suppressScrollReport
  )

  if (!programmatic && max <= 0) return
  ipcRenderer.send('pane:scroll', paneId, ratio, programmatic)
}

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
    const interactive = findInteractiveAncestor(e.target)
    if (!interactive) return

    const allInteractive = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR)).filter(
      (el) => el instanceof HTMLElement && !(el as HTMLInputElement).disabled
    )
    const allDescriptors = allInteractive.map(describeElement)

    const interactiveIndex = allInteractive.indexOf(interactive)
    const descriptorForContext =
      interactiveIndex !== -1 ? allDescriptors[interactiveIndex] : describeElement(interactive)

    const fingerprint = buildElementFingerprintInContext(
      descriptorForContext,
      allDescriptors,
      interactiveIndex
    )
    if (!fingerprint) return
    if (fingerprint.indexAmongMatches === undefined && interactiveIndex !== -1) {
      for (const layer of fingerprint.layers) {
        const matchIndices = getLayerMatchIndices(layer, allDescriptors)
        if (matchIndices.length <= 1) continue
        const position = matchIndices.indexOf(interactiveIndex)
        if (position !== -1) {
          fingerprint.indexAmongMatches = position
          break
        }
      }
    }
    const inputTarget =
      rawTarget instanceof HTMLInputElement
        ? rawTarget
        : interactive instanceof HTMLInputElement
          ? interactive
          : null
    if (inputTarget) {
      const duplicateIndex = getInputGroupMatchIndex(inputTarget)
      if (duplicateIndex !== null) {
        fingerprint.indexAmongMatches = duplicateIndex
      }
    }

    ipcRenderer.send('pane:click', paneId, fingerprint)
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
      const fingerprint = buildFingerprintFromCandidates(target, getValueSyncCandidates())
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

    const fingerprint = buildFingerprintFromCandidates(target, getValueSyncCandidates())
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

    const fingerprint = buildFingerprintFromCandidates(form, Array.from(document.querySelectorAll('form')))
    if (!fingerprint) return
    ipcRenderer.send('pane:submit', paneId, fingerprint)
  },
  true
)

contextBridge.exposeInMainWorld('__paneId', paneId)
