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
    resolveClickPoint: vi.fn<() => Promise<{ x: number; y: number } | null>>(),
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
})
