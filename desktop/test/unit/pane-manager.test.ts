import { describe, expect, it, vi } from 'vitest'
import type { ElementFingerprint } from '../../src/shared/element-mirror'
import { PaneManager } from '../../src/main/pane-manager'

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function createMockEngine() {
  return {
    resolveClickPoint: vi.fn<
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
    destroy: vi.fn(),
    webContents: {
      id: Math.floor(Math.random() * 10000),
      getURL: vi.fn(() => 'https://example.com')
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

describe('PaneManager value sync', () => {
  it('mirrors value to other panes but not the source', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()
    const fingerprint = createFingerprint()

    await paneManager.syncValue('iphone', fingerprint, 'hello')

    expect(iphone.applyValue).not.toHaveBeenCalled()
    expect(ipad.applyValue).toHaveBeenCalledWith(fingerprint, { value: 'hello', generation: 1 })
    expect(desktop.applyValue).toHaveBeenCalledWith(fingerprint, { value: 'hello', generation: 1 })
  })

  it('suppresses value echo from a mirrored apply', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()
    const fingerprint = createFingerprint()
    ipad.applyValue.mockImplementation(async () => {
      await paneManager.syncValue('ipad', fingerprint, 'echo')
    })
    desktop.applyValue.mockResolvedValue(undefined)

    await paneManager.syncValue('iphone', fingerprint, 'hello')

    expect(ipad.applyValue).toHaveBeenCalledTimes(1)
    expect(desktop.applyValue).toHaveBeenCalledTimes(1)
    expect(desktop.applyValue).toHaveBeenCalledWith(fingerprint, { value: 'hello', generation: 1 })
  })

  it('bumps generation for rapid successive updates to the same field', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()
    const fingerprint = createFingerprint()

    await paneManager.syncValue('iphone', fingerprint, 'a')
    await paneManager.syncValue('iphone', fingerprint, 'ab')

    expect(ipad.applyValue).toHaveBeenNthCalledWith(1, fingerprint, { value: 'a', generation: 1 })
    expect(ipad.applyValue).toHaveBeenNthCalledWith(2, fingerprint, { value: 'ab', generation: 2 })
    expect(desktop.applyValue).toHaveBeenNthCalledWith(2, fingerprint, { value: 'ab', generation: 2 })
    expect(iphone.applyValue).not.toHaveBeenCalled()
  })
})
