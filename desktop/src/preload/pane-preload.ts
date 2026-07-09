import { contextBridge, ipcRenderer } from 'electron'
import { createElementMirror } from '../shared/element-mirror'
import type { PaneId } from '../shared/types'

function getPaneId(): PaneId {
  const arg = process.argv.find((value) => value.startsWith('--pane-id='))
  if (!arg) throw new Error('Missing --pane-id argument')
  return arg.replace('--pane-id=', '') as PaneId
}

const paneId = getPaneId()
const mirror = createElementMirror()

function findInteractiveAncestor(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null
  return target.closest(mirror.interactiveSelector)
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
  return Array.from(document.querySelectorAll(mirror.valueSyncSelector)).filter(
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

    const allInteractive = Array.from(document.querySelectorAll(mirror.interactiveSelector)).filter(
      (el) => el instanceof HTMLElement && !(el as HTMLInputElement).disabled
    )

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
