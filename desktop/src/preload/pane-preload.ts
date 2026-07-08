import { contextBridge, ipcRenderer } from 'electron'
import {
  buildElementFingerprintInContext,
  buildElementFingerprint,
  normalizeVisibleText,
  type ElementDescriptor
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

function isCheckboxOrRadioInput(element: Element): element is HTMLInputElement {
  return (
    element instanceof HTMLInputElement &&
    (element.type === 'checkbox' || element.type === 'radio')
  )
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

  const testIdFromName = isFormField ? (element as HTMLInputElement).name || null : null

  return {
    tagName,
    id: element.id || null,
    visibleText: getVisibleText(element),
    testId: element.getAttribute('data-testid') || testIdFromName || null,
    ariaLabel: element.getAttribute('aria-label') || null,
    role: element.getAttribute('role') || null,
    structuralPath: getStructuralPath(element)
  }
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
    const interactive = findInteractiveAncestor(e.target)
    if (!interactive) return
    if (isCheckboxOrRadioInput(interactive)) return

    const allInteractive = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR)).filter(
      (el) => el instanceof HTMLElement && !(el as HTMLInputElement).disabled
    )
    const allDescriptors = allInteractive.map(describeElement)

    const interactiveIndex = allInteractive.indexOf(interactive)
    const descriptorForContext =
      interactiveIndex !== -1 ? allDescriptors[interactiveIndex] : describeElement(interactive)

    const fingerprint = buildElementFingerprintInContext(descriptorForContext, allDescriptors)
    if (!fingerprint) return

    ipcRenderer.send('pane:click', paneId, fingerprint)
  },
  true
)

const inputTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>()

window.addEventListener(
  'input',
  (e: Event) => {
    const target = e.target
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return
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
      )
        return
    }
    if ((window as Window & { __suppressValueReport?: boolean }).__suppressValueReport) return

    const prev = inputTimers.get(target)
    if (prev !== undefined) clearTimeout(prev)

    const timer = setTimeout(() => {
      inputTimers.delete(target)
      const fingerprint = buildElementFingerprint(describeElement(target))
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
    if (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')) {
      if ((window as Window & { __suppressCheckedReport?: boolean }).__suppressCheckedReport) return

      const fingerprint = buildElementFingerprint(describeElement(target))
      if (!fingerprint) return
      ipcRenderer.send('pane:checked', paneId, fingerprint, target.checked)
      return
    }
    if (!(target instanceof HTMLSelectElement)) return
    if ((window as Window & { __suppressValueReport?: boolean }).__suppressValueReport) return

    const fingerprint = buildElementFingerprint(describeElement(target))
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

    const fingerprint = buildElementFingerprint(describeElement(form))
    if (!fingerprint) return
    ipcRenderer.send('pane:submit', paneId, fingerprint)
  },
  true
)

contextBridge.exposeInMainWorld('__paneId', paneId)
