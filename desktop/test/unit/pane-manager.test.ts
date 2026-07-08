import { describe, expect, it, vi } from 'vitest'
import type { ElementFingerprint } from '../../src/shared/element-fingerprint'
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
        | { x: number; y: number }
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
    const deferred = createDeferred<{ x: number; y: number } | null>()
    ipad.resolveClickPoint.mockReturnValue(deferred.promise)
    desktop.resolveClickPoint.mockResolvedValue(null)

    const sync = paneManager.syncClick('iphone', createFingerprint())

    const replacementIpad = createMockEngine()
    ;(paneManager as any).engines.set('ipad', replacementIpad)
    ;(paneManager as any).bumpPaneInteractionEpoch('ipad')

    deferred.resolve({ x: 40, y: 80 })
    await sync

    expect(ipad.dispatchClick).not.toHaveBeenCalled()
    expect(replacementIpad.dispatchClick).not.toHaveBeenCalled()
  })

  it('drops a resolved click when the target document changes before dispatch', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithEngines()
    const deferred = createDeferred<{ x: number; y: number } | null>()
    ipad.resolveClickPoint.mockReturnValue(deferred.promise)
    desktop.resolveClickPoint.mockResolvedValue(null)

    const sync = paneManager.syncClick('iphone', createFingerprint())

    ;(paneManager as any).bumpPaneInteractionEpoch('ipad')

    deferred.resolve({ x: 120, y: 240 })
    await sync

    expect(ipad.dispatchClick).not.toHaveBeenCalled()
  })

  it('keeps normal click replay when the target engine and document stay stable', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithEngines()
    ipad.resolveClickPoint.mockResolvedValue({ x: 10, y: 20 })
    desktop.resolveClickPoint.mockResolvedValue(null)

    await paneManager.syncClick('iphone', createFingerprint())

    expect(ipad.dispatchClick).toHaveBeenCalledWith(10, 20)
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
