import { describe, expect, it, vi } from 'vitest'
import type { ElementFingerprint } from '../../src/shared/element-mirror'
import { PaneManager } from '../../src/main/pane-manager'
import { createRuntimeEvidenceBuffer } from '../../src/main/runtime-evidence-buffer'
import { FakeEngine } from '../support/fake-engine'

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function createMockEngine() {
  return {
    resolveClickPoint:
      vi.fn<
        () => Promise<
          | { dispatched: true }
          | { handled: true }
          | { skipDispatch: true; navigateTo: string }
          | null
        >
      >(),
    dispatchClick: vi.fn<(x: number, y: number) => void>(),
    applyValue: vi.fn(),
    applyChecked: vi.fn(),
    submitForm: vi.fn(),
    getMirrorFailureLogs: vi.fn(() => []),
    mount: vi.fn(),
    navigate: vi.fn(),
    setDevice: vi.fn(),
    syncScroll: vi.fn(),
    getCurrentUrl: vi.fn(() => 'https://example.com'),
    canGoBack: vi.fn(() => false),
    canGoForward: vi.fn(() => false),
    goBack: vi.fn(),
    goForward: vi.fn(),
    getPreviousEntryUrl: vi.fn<() => string | null>(() => null),
    setVisible: vi.fn<(visible: boolean) => void>(),
    attach: vi.fn(),
    detach: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(),
    webContents: {
      id: Math.floor(Math.random() * 10000),
      getURL: vi.fn(() => 'https://example.com'),
      canGoBack: vi.fn(() => false),
      canGoForward: vi.fn(() => false),
      navigationHistory: {
        getActiveIndex: vi.fn(() => 0),
        getEntryAtIndex: vi.fn(() => null)
      }
    },
    view: {}
  }
}

function createFingerprint(): ElementFingerprint {
  return { layers: [{ type: 'id', id: 'semantic-primary' }] }
}

function createToggleFingerprint(checkedState: boolean): ElementFingerprint {
  return { ...createFingerprint(), checkedState }
}

function createPaneManagerWithEngines() {
  const paneManager = new PaneManager()
  const iphone = createMockEngine()
  const ipad = createMockEngine()
  const desktop = createMockEngine()

  ;(paneManager as any).engines.set('iphone', iphone)
  ;(paneManager as any).engines.set('ipad', ipad)
  ;(paneManager as any).engines.set('desktop', desktop)

  return { paneManager, iphone, ipad, desktop }
}

// Injects real FakeEngine adapters instead of Electron-internal mocks — the
// tracer proving PaneManager runs against the EngineView seam, not webContents.
function createPaneManagerWithFakeEngines() {
  const paneManager = new PaneManager()
  const iphone = new FakeEngine('iphone')
  const ipad = new FakeEngine('ipad')
  const desktop = new FakeEngine('desktop')

  ;(paneManager as any).engines.set('iphone', iphone)
  ;(paneManager as any).engines.set('ipad', ipad)
  ;(paneManager as any).engines.set('desktop', desktop)

  return { paneManager, iphone, ipad, desktop }
}

describe('PaneManager syncClick stale guards', () => {
  it('drops a resolved click when the target engine changes before dispatch', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithEngines()
    const deferred = createDeferred<{ dispatched: true } | null>()
    ipad.resolveClickPoint.mockReturnValue(deferred.promise)
    desktop.resolveClickPoint.mockResolvedValue(null)

    const sync = paneManager.syncClick('iphone', createFingerprint())

    const replacementIpad = createMockEngine()
    ;(paneManager as any).engines.set('ipad', replacementIpad)
    ;(paneManager as any).bumpPaneInteractionEpoch('ipad')

    deferred.resolve({ dispatched: true })
    await sync

    expect(ipad.dispatchClick).not.toHaveBeenCalled()
    expect(replacementIpad.dispatchClick).not.toHaveBeenCalled()
  })

  it('drops a resolved click when the target document changes before dispatch', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithEngines()
    const deferred = createDeferred<{ dispatched: true } | null>()
    ipad.resolveClickPoint.mockReturnValue(deferred.promise)
    desktop.resolveClickPoint.mockResolvedValue(null)

    const sync = paneManager.syncClick('iphone', createFingerprint())

    ;(paneManager as any).bumpPaneInteractionEpoch('ipad')

    deferred.resolve({ dispatched: true })
    await sync

    expect(ipad.dispatchClick).not.toHaveBeenCalled()
  })

  it('keeps normal click replay when the target engine and document stay stable', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithEngines()
    ipad.resolveClickPoint.mockResolvedValue({ dispatched: true })
    desktop.resolveClickPoint.mockResolvedValue(null)

    await paneManager.syncClick('iphone', createFingerprint())

    expect(ipad.resolveClickPoint).toHaveBeenCalled()
  })

  it('suppresses a click echo that fires while the target click is being resolved', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithEngines()
    desktop.resolveClickPoint.mockResolvedValue(null)
    ipad.resolveClickPoint.mockImplementation(async () => {
      await paneManager.syncClick('ipad', createFingerprint())
      return { handled: true }
    })

    await paneManager.syncClick('iphone', createFingerprint())

    expect(ipad.dispatchClick).not.toHaveBeenCalled()
    expect(desktop.resolveClickPoint).toHaveBeenCalledTimes(1)
  })

  it('does not leave a synthetic click reservation after an unresolved target', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()
    iphone.resolveClickPoint.mockResolvedValue(null)
    ipad.resolveClickPoint.mockResolvedValue(null)
    desktop.resolveClickPoint.mockResolvedValue(null)

    await paneManager.syncClick('iphone', createFingerprint())
    await paneManager.syncClick('ipad', createFingerprint())

    expect(desktop.resolveClickPoint).toHaveBeenCalledTimes(2)
  })

  it('does not suppress a later real click after a handled target click produces no echo', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()
    iphone.resolveClickPoint.mockResolvedValue(null)
    ipad.resolveClickPoint.mockResolvedValue({ handled: true })
    desktop.resolveClickPoint.mockResolvedValue(null)

    await paneManager.syncClick('iphone', createFingerprint())
    await paneManager.syncClick('ipad', createFingerprint())

    expect(iphone.resolveClickPoint).toHaveBeenCalledTimes(1)
    expect(desktop.resolveClickPoint).toHaveBeenCalledTimes(2)
  })

  it('preserves the source toggle state across mirrored checkbox clicks', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithEngines()
    ipad.resolveClickPoint.mockResolvedValue({ handled: true })
    desktop.resolveClickPoint.mockResolvedValue({ handled: true })

    await paneManager.syncClick('iphone', createToggleFingerprint(true))
    await paneManager.syncClick('iphone', createToggleFingerprint(false))

    expect(ipad.resolveClickPoint).toHaveBeenNthCalledWith(1, createToggleFingerprint(true))
    expect(ipad.resolveClickPoint).toHaveBeenNthCalledWith(2, createToggleFingerprint(false))
    expect(desktop.resolveClickPoint).toHaveBeenNthCalledWith(1, createToggleFingerprint(true))
    expect(desktop.resolveClickPoint).toHaveBeenNthCalledWith(2, createToggleFingerprint(false))
  })
})

describe('PaneManager scroll sync', () => {
  it('propagates a user scroll to the other panes', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()

    await paneManager.syncScroll('iphone', 0.4, false)

    expect(iphone.syncScroll).not.toHaveBeenCalled()
    expect(ipad.syncScroll).toHaveBeenCalledWith(0.4)
    expect(desktop.syncScroll).toHaveBeenCalledWith(0.4)
  })

  it('suppresses the echo report from a broadcast scroll', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()

    await paneManager.syncScroll('iphone', 0.4, false)
    ipad.syncScroll.mockClear()
    desktop.syncScroll.mockClear()

    // ipad reports the applied scroll back (programmatic via the in-page flag)
    await paneManager.syncScroll('ipad', 0.4, true)

    expect(iphone.syncScroll).not.toHaveBeenCalled()
    expect(ipad.syncScroll).not.toHaveBeenCalled()
    expect(desktop.syncScroll).not.toHaveBeenCalled()
  })

  it('handles rapid alternating scrolls without stale echo expectations', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()

    await paneManager.syncScroll('iphone', 0.2, false)
    await paneManager.syncScroll('ipad', 0.2, true)
    await paneManager.syncScroll('desktop', 0.2, true)
    ipad.syncScroll.mockClear()
    desktop.syncScroll.mockClear()

    await paneManager.syncScroll('desktop', 0.8, false)

    expect(iphone.syncScroll).toHaveBeenCalledWith(0.8)
    expect(ipad.syncScroll).toHaveBeenCalledWith(0.8)
    expect(desktop.syncScroll).not.toHaveBeenCalled()
  })

  it('does nothing when sync is disabled and forgets stale expectations on toggle', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()

    await paneManager.syncScroll('iphone', 0.4, false)
    ipad.syncScroll.mockClear()
    desktop.syncScroll.mockClear()

    paneManager.setSyncEnabled(false)
    await paneManager.syncScroll('iphone', 0.5, false)
    expect(ipad.syncScroll).not.toHaveBeenCalled()
    expect(desktop.syncScroll).not.toHaveBeenCalled()

    // Re-enable: the pre-toggle expectation on ipad must not swallow its scroll
    paneManager.setSyncEnabled(true)
    await paneManager.syncScroll('ipad', 0.6, false)
    expect(iphone.syncScroll).toHaveBeenCalledWith(0.6)
    expect(desktop.syncScroll).toHaveBeenCalledWith(0.6)
  })

  it('does not broadcast the scroll echo produced by resolveClickPoint scrollIntoView', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()
    ipad.resolveClickPoint.mockResolvedValue({ handled: true })
    desktop.resolveClickPoint.mockResolvedValue({ handled: true })

    await paneManager.syncClick('iphone', createFingerprint())
    // The scrollIntoView inside resolveClickPoint surfaces as a scroll report
    // from each target pane; neither may cascade to the other panes.
    await paneManager.syncScroll('ipad', 0.3, false)
    await paneManager.syncScroll('desktop', 0.3, false)

    expect(iphone.syncScroll).not.toHaveBeenCalled()
    expect(ipad.syncScroll).not.toHaveBeenCalled()
    expect(desktop.syncScroll).not.toHaveBeenCalled()
  })

  it('does not broadcast source-pane scroll while a mirrored click is in flight', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()
    const deferred = createDeferred<{ dispatched: true } | null>()
    ipad.resolveClickPoint.mockReturnValue(deferred.promise)
    desktop.resolveClickPoint.mockResolvedValue(null)

    const sync = paneManager.syncClick('iphone', createFingerprint())
    await paneManager.syncScroll('iphone', 0.5, false)

    expect(ipad.syncScroll).not.toHaveBeenCalled()
    expect(desktop.syncScroll).not.toHaveBeenCalled()

    deferred.resolve({ dispatched: true })
    await sync
    expect(ipad.resolveClickPoint).toHaveBeenCalled()
  })

  it('navigates mirrored navigation links on target panes without dispatching a click', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()
    const url = 'http://127.0.0.1:4173/semantic-destination'
    ipad.resolveClickPoint.mockResolvedValue({
      skipDispatch: true,
      navigateTo: url
    })
    desktop.resolveClickPoint.mockResolvedValue({
      skipDispatch: true,
      navigateTo: url
    })

    await paneManager.syncClick('iphone', createFingerprint())

    expect(ipad.navigate).toHaveBeenCalledWith(url)
    expect(desktop.navigate).toHaveBeenCalledWith(url)
    expect(ipad.dispatchClick).not.toHaveBeenCalled()
    expect(desktop.dispatchClick).not.toHaveBeenCalled()
  })
})

// Migrated from Electron-internal mocks to injected FakeEngine adapters:
// assertions read FakeEngine-observable recorded calls instead of vi.fn spies.
describe('PaneManager value sync', () => {
  it('mirrors value to other panes but not the source', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()
    const fingerprint = createFingerprint()

    await paneManager.syncValue('iphone', fingerprint, 'hello')

    expect(iphone.calls.applyValue).toHaveLength(0)
    expect(ipad.calls.applyValue).toEqual([
      { fingerprint, payload: { value: 'hello', generation: 1 } }
    ])
    expect(desktop.calls.applyValue).toEqual([
      { fingerprint, payload: { value: 'hello', generation: 1 } }
    ])
  })

  it('suppresses value echo from a mirrored apply', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()
    const fingerprint = createFingerprint()
    // The applied value is re-reported by the target pane, exactly as a live
    // WebContents would echo it; PaneManager must swallow that echo.
    ipad.onApplyValue = async () => {
      await paneManager.syncValue('ipad', fingerprint, 'echo')
    }

    await paneManager.syncValue('iphone', fingerprint, 'hello')

    expect(ipad.calls.applyValue).toHaveLength(1)
    expect(desktop.calls.applyValue).toHaveLength(1)
    expect(desktop.calls.applyValue[0]).toEqual({
      fingerprint,
      payload: { value: 'hello', generation: 1 }
    })
    expect(iphone.calls.applyValue).toHaveLength(0)
  })

  it('bumps generation for rapid successive updates to the same field', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()
    const fingerprint = createFingerprint()

    await paneManager.syncValue('iphone', fingerprint, 'a')
    await paneManager.syncValue('iphone', fingerprint, 'ab')

    expect(ipad.calls.applyValue).toEqual([
      { fingerprint, payload: { value: 'a', generation: 1 } },
      { fingerprint, payload: { value: 'ab', generation: 2 } }
    ])
    expect(desktop.calls.applyValue[1]).toEqual({
      fingerprint,
      payload: { value: 'ab', generation: 2 }
    })
    expect(iphone.calls.applyValue).toHaveLength(0)
  })
})

// Navigation history routed through the EngineView seam: assertions read
// FakeEngine-observable history state instead of Electron webContents spies.
describe('PaneManager navigation history through the seam', () => {
  it('goes back on the active pane and updates its current URL', async () => {
    const { paneManager, desktop } = createPaneManagerWithFakeEngines()
    ;(paneManager as any).tracker.didFocus('desktop')

    await desktop.navigate('https://example.com/one')
    await desktop.navigate('https://example.com/two')

    await paneManager.goBack()

    expect(desktop.calls.goBack).toBe(1)
    expect(desktop.getCurrentUrl()).toBe('https://example.com/one')
  })

  it('does not go back when the pane has no back entry', async () => {
    const { paneManager, desktop } = createPaneManagerWithFakeEngines()
    ;(paneManager as any).tracker.didFocus('desktop')

    await paneManager.goBack()

    expect(desktop.calls.goBack).toBe(0)
  })

  it('goes forward after going back', async () => {
    const { paneManager, desktop } = createPaneManagerWithFakeEngines()
    ;(paneManager as any).tracker.didFocus('desktop')

    await desktop.navigate('https://example.com/one')
    await desktop.navigate('https://example.com/two')
    await paneManager.goBack()

    await paneManager.goForward()

    expect(desktop.calls.goForward).toBe(1)
    expect(desktop.getCurrentUrl()).toBe('https://example.com/two')
  })

  it('reports navigation capabilities from the active pane, skipping the initial about:blank entry', async () => {
    const { paneManager, desktop } = createPaneManagerWithFakeEngines()
    ;(paneManager as any).tracker.didFocus('desktop')

    // Only the initial about:blank → first real page: canGoBack must be false
    // because the sole previous entry is the blank initial entry.
    await desktop.navigate('https://example.com/one')
    expect(paneManager.getNavigationState().canGoBack).toBe(false)
    expect(paneManager.getNavigationState().canGoForward).toBe(false)

    // A second real navigation puts a meaningful (non-blank) entry behind.
    await desktop.navigate('https://example.com/two')
    expect(paneManager.getNavigationState().canGoBack).toBe(true)

    await paneManager.goBack()
    expect(paneManager.getNavigationState().canGoForward).toBe(true)
  })
})

// Presentation routed through the EngineView seam: assertions read
// FakeEngine-observable visible/attached state instead of touching a raw view.
describe('PaneManager presentation through the seam', () => {
  it('toggles pane visibility through the seam', () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()

    paneManager.setPanesVisible(true)

    expect(iphone.visible).toBe(true)
    expect(ipad.visible).toBe(true)
    expect(desktop.visible).toBe(true)

    paneManager.setPanesVisible(false)

    expect(iphone.visible).toBe(false)
    expect(ipad.visible).toBe(false)
    expect(desktop.visible).toBe(false)
  })

  it('detaches each pane through the seam on recreateAll', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()
    const fakeWindow = { isDestroyed: () => false } as any
    ;(paneManager as any).mainWindow = fakeWindow
    // webContents is still a raw path in recreateAll (removed in issue 04); give
    // the fakes a minimal id so the webContentsToPane cleanup does not throw.
    for (const [i, engine] of [iphone, ipad, desktop].entries()) {
      ;(engine as any).webContents = { id: 1000 + i }
    }
    // Make createEngine a no-op so recreateAll only exercises the detach path
    // (real engine construction needs Electron).
    ;(paneManager as any).createEngine = vi.fn(async () => {})

    await paneManager.recreateAll()

    expect(iphone.calls.detach).toBe(1)
    expect(ipad.calls.detach).toBe(1)
    expect(desktop.calls.detach).toBe(1)
    expect(iphone.attached).toBe(false)
  })

  it('detaches and destroys each pane through the seam on destroy', () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()
    ;(paneManager as any).mainWindow = { isDestroyed: () => false } as any

    iphone.attach({} as any)
    ipad.attach({} as any)
    desktop.attach({} as any)

    paneManager.destroy()

    expect(iphone.calls.detach).toBe(1)
    expect(iphone.attached).toBe(false)
    expect(iphone.destroyed).toBe(true)
    expect(ipad.destroyed).toBe(true)
    expect(desktop.destroyed).toBe(true)
  })

  it('focuses a pane through the seam', () => {
    const { paneManager, iphone } = createPaneManagerWithFakeEngines()

    paneManager.focusPane('iphone')

    expect(iphone.focused).toBe(true)
    expect(iphone.calls.focus).toBe(1)
  })
})

describe('PaneManager evidence clear on navigation', () => {
  function createPaneManagerWithBufferAndListeners() {
    // createPaneManagerWithEngines sets up all three mock engines which
    // attachNavigationListeners needs (via getNavigationCapabilities/emitNavigationState)
    const { paneManager } = createPaneManagerWithEngines()
    const buffer = createRuntimeEvidenceBuffer()

    ;(paneManager as any).runtimeEvidence.set('desktop', buffer)
    ;(paneManager as any).tracker.didFocus('desktop')

    const listeners: Record<string, ((...args: any[]) => void)[]> = {}
    const fakeWebContents = {
      id: 99,
      on(event: string, handler: (...args: any[]) => void) {
        listeners[event] = listeners[event] ?? []
        listeners[event].push(handler)
      }
    }

    ;(paneManager as any).attachNavigationListeners(fakeWebContents, 'desktop')

    const emit = (event: string, ...args: any[]): void => {
      for (const fn of listeners[event] ?? []) {
        fn({}, ...args)
      }
    }

    return { paneManager, buffer, emit }
  }

  it('clears console and network evidence on top-level navigation', () => {
    const { buffer, emit } = createPaneManagerWithBufferAndListeners()

    buffer.pushConsole({ level: 'error', message: 'before nav' })
    buffer.pushNetwork({ method: 'GET', url: 'http://localhost/req', path: '/req', failed: false })

    emit('did-navigate', 'http://localhost/page2')

    expect(buffer.getConsole()).toHaveLength(0)
    expect(buffer.getNetwork()).toHaveLength(0)
  })

  it('does not clear evidence on in-page navigation', () => {
    const { buffer, emit } = createPaneManagerWithBufferAndListeners()

    buffer.pushConsole({ level: 'error', message: 'kept' })
    buffer.pushNetwork({ method: 'GET', url: 'http://localhost/req', path: '/req', failed: false })

    emit('did-navigate-in-page', 'http://localhost/page2#section')

    expect(buffer.getConsole()).toHaveLength(1)
    expect(buffer.getNetwork()).toHaveLength(1)
  })

  it('does not clear evidence for other panes when one pane navigates', () => {
    const { paneManager } = createPaneManagerWithEngines()
    const iphoneBuffer = createRuntimeEvidenceBuffer()
    const desktopBuffer = createRuntimeEvidenceBuffer()

    ;(paneManager as any).runtimeEvidence.set('iphone', iphoneBuffer)
    ;(paneManager as any).runtimeEvidence.set('desktop', desktopBuffer)

    const listeners: Record<string, ((...args: any[]) => void)[]> = {}
    const fakeWebContents = {
      id: 99,
      on(event: string, handler: (...args: any[]) => void) {
        listeners[event] = listeners[event] ?? []
        listeners[event].push(handler)
      }
    }

    ;(paneManager as any).attachNavigationListeners(fakeWebContents, 'desktop')

    iphoneBuffer.pushConsole({ level: 'warn', message: 'iphone log' })
    desktopBuffer.pushConsole({ level: 'error', message: 'desktop error' })

    for (const fn of listeners['did-navigate'] ?? []) {
      fn({}, 'http://localhost/newpage')
    }

    expect(desktopBuffer.getConsole()).toHaveLength(0)
    expect(iphoneBuffer.getConsole()).toHaveLength(1)
  })
})

describe('PaneManager runtime evidence', () => {
  it('returns console evidence for the active pane', () => {
    const paneManager = new PaneManager()
    const iphoneBuffer = createRuntimeEvidenceBuffer()
    const desktopBuffer = createRuntimeEvidenceBuffer()

    iphoneBuffer.pushConsole({ level: 'error', message: 'iphone error' })
    desktopBuffer.pushConsole({ level: 'error', message: 'desktop error' })

    ;(
      paneManager as unknown as {
        runtimeEvidence: Map<string, ReturnType<typeof createRuntimeEvidenceBuffer>>
      }
    ).runtimeEvidence.set('iphone', iphoneBuffer)
    ;(
      paneManager as unknown as {
        runtimeEvidence: Map<string, ReturnType<typeof createRuntimeEvidenceBuffer>>
      }
    ).runtimeEvidence.set('desktop', desktopBuffer)
    ;(
      paneManager as unknown as { tracker: { didFocus: (paneId: string) => void } }
    ).tracker.didFocus('iphone')

    expect(paneManager.getRuntimeEvidenceSnapshot().console[0]?.message).toBe('iphone error')

    ;(
      paneManager as unknown as { tracker: { didFocus: (paneId: string) => void } }
    ).tracker.didFocus('desktop')

    expect(paneManager.getRuntimeEvidenceSnapshot().console[0]?.message).toBe('desktop error')
  })

  it('clears only the requested channel for the active pane', () => {
    const paneManager = new PaneManager()
    const buffer = createRuntimeEvidenceBuffer()

    buffer.pushConsole({ level: 'error', message: 'console error' })
    buffer.pushNetwork({
      method: 'GET',
      url: 'http://localhost/missing',
      path: '/missing',
      status: 404,
      failed: true
    })

    ;(
      paneManager as unknown as {
        runtimeEvidence: Map<string, ReturnType<typeof createRuntimeEvidenceBuffer>>
      }
    ).runtimeEvidence.set('desktop', buffer)
    ;(
      paneManager as unknown as { tracker: { didFocus: (paneId: string) => void } }
    ).tracker.didFocus('desktop')

    paneManager.clearRuntimeEvidence('console')

    expect(paneManager.getRuntimeEvidenceSnapshot().console).toEqual([])
    expect(paneManager.getRuntimeEvidenceSnapshot().network).toHaveLength(1)

    paneManager.clearRuntimeEvidence('network')

    expect(paneManager.getRuntimeEvidenceSnapshot().network).toEqual([])
  })
})
