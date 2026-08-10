import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow, Input } from 'electron'
import type { ElementFingerprint } from '../../src/shared/element-mirror'
import { PaneManager } from '../../src/main/panes/pane-manager'
import { createRuntimeEvidenceBuffer } from '../../src/main/evidence/runtime-evidence-buffer'
import { RUNTIME_EVIDENCE_EMIT_WINDOW_MS } from '../../src/shared/runtime-evidence'
import type { EngineView } from '../../src/main/engine/engine-view'
import type { PaneId } from '../../src/shared/types'
import { FakeEngine } from '../support/fake-engine'
import { buildInspectionTarget, type InspectionPageSnapshot } from '../../src/shared/inspection'

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
} {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function createMockEngine(): ReturnType<typeof createMockEngineShape> {
  return createMockEngineShape()
}

// The mock shape is intentionally inferred so Vitest preserves each mock's
// call signatures; the public factory below is the typed test entry point.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createMockEngineShape() {
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
    dispatchKey: vi.fn(),
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
    setInspectionMismatch: vi.fn(),
    on: vi.fn(() => () => {}),
    getWebContentsId: vi.fn(() => Math.floor(Math.random() * 10000)),
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

type PaneManagerTestAccess = {
  engines: Map<PaneId, EngineView>
  runtimeEvidence: Map<PaneId, ReturnType<typeof createRuntimeEvidenceBuffer>>
  pendingProgrammaticNavigation: Set<PaneId>
  tracker: { didFocus: (paneId: PaneId) => void }
  mainWindow: BrowserWindow | null
  bumpPaneInteractionEpoch: (paneId: PaneId) => void
  attachNavigationListeners: (engine: EngineView, paneId: PaneId) => void
  attachLoadingListeners: (engine: EngineView, paneId: PaneId) => void
  notifyRuntimeEvidenceChanged: (paneId: PaneId) => void
  createEngine: (
    paneId: PaneId,
    mainWindow: BrowserWindow,
    restoreUrl: string | null
  ) => Promise<void>
}

function getPaneManagerTestAccess(paneManager: PaneManager): PaneManagerTestAccess {
  return paneManager as unknown as PaneManagerTestAccess
}

function createPaneManagerWithEngines(): {
  paneManager: PaneManager
  iphone: ReturnType<typeof createMockEngine>
  ipad: ReturnType<typeof createMockEngine>
  desktop: ReturnType<typeof createMockEngine>
} {
  const paneManager = new PaneManager()
  const iphone = createMockEngine()
  const ipad = createMockEngine()
  const desktop = createMockEngine()

  getPaneManagerTestAccess(paneManager).engines.set('iphone', iphone)
  getPaneManagerTestAccess(paneManager).engines.set('ipad', ipad)
  getPaneManagerTestAccess(paneManager).engines.set('desktop', desktop)

  return { paneManager, iphone, ipad, desktop }
}

// Injects real FakeEngine adapters instead of Electron-internal mocks — the
// tracer proving PaneManager runs against the EngineView seam, not webContents.
function createPaneManagerWithFakeEngines(): {
  paneManager: PaneManager
  iphone: FakeEngine
  ipad: FakeEngine
  desktop: FakeEngine
} {
  const paneManager = new PaneManager()
  const iphone = new FakeEngine('iphone')
  const ipad = new FakeEngine('ipad')
  const desktop = new FakeEngine('desktop')

  getPaneManagerTestAccess(paneManager).engines.set('iphone', iphone)
  getPaneManagerTestAccess(paneManager).engines.set('ipad', ipad)
  getPaneManagerTestAccess(paneManager).engines.set('desktop', desktop)

  return { paneManager, iphone, ipad, desktop }
}

function createInspectionSnapshot(): InspectionPageSnapshot {
  const descriptor = {
    tagName: 'div',
    id: 'inspection-target',
    testId: null,
    accessibleName: null,
    role: null,
    visibleText: 'Target',
    structuralPath: 'main > div:nth-child(1)'
  }
  const target = buildInspectionTarget(descriptor)
  return {
    target,
    selector: '#inspection-target',
    domPath: descriptor.structuralPath,
    geometry: { x: 0, y: 0, width: 120, height: 40 },
    visibility: { visible: true, clipped: false, offscreen: false },
    layout: {
      display: 'block',
      position: 'static',
      width: '120px',
      height: '40px',
      overflow: 'visible',
      flex: null,
      grid: null
    },
    styles: {
      margin: '0px',
      padding: '0px',
      color: 'white',
      background: 'black',
      font: '16px system-ui',
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: '400',
      zIndex: 'auto',
      minWidth: '0px',
      maxWidth: 'none',
      minHeight: '0px',
      maxHeight: 'none'
    },
    boxModel: {
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      border: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      padding: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      content: { width: '120px', height: '40px' },
      boxSizing: 'border-box'
    },
    markup: {
      id: 'root',
      type: 'element',
      tagName: 'div',
      attributes: [{ name: 'id', value: 'inspection-target' }],
      hasChildren: true
    },
    outerHTML: '<div id="inspection-target">Target</div>',
    url: 'https://example.com/',
    capturedAt: 1
  }
}

describe('PaneManager inspection lifecycle', () => {
  it('keeps partial target failures explicit and removes stale pane highlights', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()
    await Promise.all([
      iphone.navigate('https://example.com/'),
      ipad.navigate('https://example.com/'),
      desktop.navigate('https://example.com/')
    ])
    ipad.inspectionResolution = { status: 'ambiguous', snapshot: null, provenance: null }
    desktop.inspectionResolution = {
      status: 'matched',
      snapshot: createInspectionSnapshot(),
      provenance: 'id:inspection-target'
    }

    await paneManager.setInspectionMode(true)
    const snapshot = createInspectionSnapshot()
    await paneManager.selectInspectionElement('desktop', snapshot.target, snapshot)

    expect(paneManager.getInspectionState().records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ paneId: 'desktop', status: 'matched' }),
        expect.objectContaining({ paneId: 'ipad', status: 'ambiguous' }),
        expect.objectContaining({ paneId: 'iphone', status: 'unavailable' })
      ])
    )
    expect(ipad.calls.setInspectionSelection.at(-1)).toBeNull()
    expect(desktop.calls.setInspectionSelection.at(-1)).toEqual(snapshot.target)
    expect(ipad.calls.setInspectionMismatch.at(-1)).toBe(true)
    expect(desktop.calls.setInspectionMismatch.at(-1)).toBe(false)

    paneManager.markInspectionPaneStale('desktop')

    expect(paneManager.getInspectionState().record).toMatchObject({
      paneId: 'desktop',
      status: 'stale',
      snapshot: null
    })
    expect(desktop.calls.setInspectionSelection.at(-1)).toBeNull()
  })

  it('loads direct markup children from the matched pane on demand', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()
    await Promise.all([
      iphone.navigate('https://example.com/'),
      ipad.navigate('https://example.com/'),
      desktop.navigate('https://example.com/')
    ])
    const snapshot = createInspectionSnapshot()
    const resolution = { status: 'matched' as const, snapshot, provenance: 'fake' }
    iphone.inspectionResolution = resolution
    ipad.inspectionResolution = resolution
    desktop.inspectionResolution = resolution
    desktop.evaluateResult = [{ id: 'root.0', type: 'text', text: 'Target', hasChildren: false }]

    await paneManager.setInspectionMode(true)
    await paneManager.selectInspectionElement('desktop', snapshot.target, snapshot)

    await expect(paneManager.loadInspectionMarkupChildren('desktop', 'root')).resolves.toEqual([
      { id: 'root.0', type: 'text', text: 'Target', hasChildren: false }
    ])
    expect(desktop.calls.evaluate.at(-1)).toContain('root')
    await expect(
      paneManager.loadInspectionMarkupChildren('desktop', 'root.invalid')
    ).resolves.toEqual([])
  })
})

describe('PaneManager syncClick stale guards', () => {
  it('drops a resolved click when the target engine changes before dispatch', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithEngines()
    const deferred = createDeferred<{ dispatched: true } | null>()
    ipad.resolveClickPoint.mockReturnValue(deferred.promise)
    desktop.resolveClickPoint.mockResolvedValue(null)

    const sync = paneManager.syncClick('iphone', createFingerprint())

    const replacementIpad = createMockEngine()
    getPaneManagerTestAccess(paneManager).engines.set('ipad', replacementIpad)
    getPaneManagerTestAccess(paneManager).bumpPaneInteractionEpoch('ipad')

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

    getPaneManagerTestAccess(paneManager).bumpPaneInteractionEpoch('ipad')

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

  it('does nothing when the source pane is unlinked and forgets stale expectations on toggle', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithEngines()

    await paneManager.syncScroll('iphone', 0.4, false)
    ipad.syncScroll.mockClear()
    desktop.syncScroll.mockClear()

    paneManager.setPaneLinked('iphone', false)
    await paneManager.syncScroll('iphone', 0.5, false)
    expect(ipad.syncScroll).not.toHaveBeenCalled()
    expect(desktop.syncScroll).not.toHaveBeenCalled()

    // Re-link: the pre-toggle expectation on ipad must not swallow its scroll
    paneManager.setPaneLinked('iphone', true)
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
    const { paneManager, ipad, desktop } = createPaneManagerWithEngines()
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
    const { paneManager, ipad, desktop } = createPaneManagerWithEngines()
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

describe('PaneManager key sync', () => {
  const shortcut = {
    key: 'k',
    code: 'KeyK',
    ctrlKey: false,
    metaKey: true,
    shiftKey: false,
    altKey: false
  }

  it('mirrors a shortcut to the other panes but not the source', () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()

    paneManager.syncKey('iphone', shortcut)

    expect(iphone.calls.dispatchKey).toHaveLength(0)
    expect(ipad.calls.dispatchKey).toEqual([shortcut])
    expect(desktop.calls.dispatchKey).toEqual([shortcut])
  })

  it('suppresses the echo report from a mirrored shortcut', () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()

    // iphone's ⌘K mirrors to ipad + desktop; each pane re-reports the injected
    // keydown, which must be swallowed rather than re-broadcast.
    paneManager.syncKey('iphone', shortcut)
    paneManager.syncKey('ipad', shortcut)
    paneManager.syncKey('desktop', shortcut)

    // Only the original fan-out reached each target once; no ping-pong.
    expect(ipad.calls.dispatchKey).toHaveLength(1)
    expect(desktop.calls.dispatchKey).toHaveLength(1)
    expect(iphone.calls.dispatchKey).toHaveLength(0)
  })

  it('does nothing when the source pane is unlinked', () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithFakeEngines()
    paneManager.setPaneLinked('iphone', false)

    paneManager.syncKey('iphone', shortcut)

    expect(ipad.calls.dispatchKey).toHaveLength(0)
    expect(desktop.calls.dispatchKey).toHaveLength(0)
  })
})

describe('PaneManager value/select/submit stale guards', () => {
  const otherFingerprint: ElementFingerprint = { layers: [{ type: 'id', id: 'other-field' }] }

  it('drops the value echo reservation when the target engine is recreated mid-apply', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithFakeEngines()
    const fingerprint = createFingerprint()
    ipad.onApplyValue = async () => {
      getPaneManagerTestAccess(paneManager).engines.set('ipad', new FakeEngine('ipad'))
    }

    await paneManager.syncValue('iphone', fingerprint, 'hello')

    // ipad now reports a genuine user edit; with the reservation dropped it must
    // mirror to the other panes rather than be swallowed as an echo.
    await paneManager.syncValue('ipad', otherFingerprint, 'real')
    expect(desktop.calls.applyValue.some((c) => c.payload.value === 'real')).toBe(true)
  })

  it('drops the value echo reservation when the target document changes mid-apply', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithFakeEngines()
    const fingerprint = createFingerprint()
    ipad.onApplyValue = async () => {
      getPaneManagerTestAccess(paneManager).bumpPaneInteractionEpoch('ipad')
    }

    await paneManager.syncValue('iphone', fingerprint, 'hello')

    await paneManager.syncValue('ipad', otherFingerprint, 'real')
    expect(desktop.calls.applyValue.some((c) => c.payload.value === 'real')).toBe(true)
  })

  it('drops the select echo reservation when the target document changes mid-apply', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithFakeEngines()
    const fingerprint = createFingerprint()
    ipad.onApplyValue = async () => {
      getPaneManagerTestAccess(paneManager).bumpPaneInteractionEpoch('ipad')
    }

    await paneManager.syncSelectValue('iphone', fingerprint, 'us', 1)

    await paneManager.syncSelectValue('ipad', otherFingerprint, 'jp', 2)
    expect(desktop.calls.applyValue.some((c) => c.payload.value === 'jp')).toBe(true)
  })

  it('does not falsely drop a value reservation when engine and document stay stable', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithFakeEngines()
    const fingerprint = createFingerprint()
    // The stable apply's echo must still be suppressed.
    ipad.onApplyValue = async () => {
      await paneManager.syncValue('ipad', fingerprint, 'echo')
    }

    await paneManager.syncValue('iphone', fingerprint, 'hello')

    // Only the original 'hello' reached desktop; the echo was swallowed.
    expect(desktop.calls.applyValue).toHaveLength(1)
    expect(desktop.calls.applyValue[0].payload.value).toBe('hello')
  })

  it('drops the submit reservation and pending navigation when the engine is recreated mid-submit', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithFakeEngines()
    const fingerprint = createFingerprint()
    ipad.onSubmitForm = async () => {
      getPaneManagerTestAccess(paneManager).engines.set('ipad', new FakeEngine('ipad'))
    }

    await paneManager.syncSubmit('iphone', fingerprint)

    expect(getPaneManagerTestAccess(paneManager).pendingProgrammaticNavigation.has('ipad')).toBe(
      false
    )

    // ipad reports a real submit → must mirror to desktop, not be suppressed.
    await paneManager.syncSubmit('ipad', fingerprint)
    expect(desktop.calls.submitForm.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps the submit reservation when the target only navigates (epoch bump is not staleness)', async () => {
    const { paneManager, ipad, desktop } = createPaneManagerWithFakeEngines()
    const fingerprint = createFingerprint()
    // A successful submit navigates: simulate the epoch bump a real load causes.
    ipad.onSubmitForm = async () => {
      getPaneManagerTestAccess(paneManager).bumpPaneInteractionEpoch('ipad')
    }

    await paneManager.syncSubmit('iphone', fingerprint)

    // The pending-navigation marker must survive so the resulting navigation is
    // not cascaded back as a user action, and the echo reservation must remain.
    expect(getPaneManagerTestAccess(paneManager).pendingProgrammaticNavigation.has('ipad')).toBe(
      true
    )

    ipad.onSubmitForm = null
    await paneManager.syncSubmit('ipad', fingerprint)
    // ipad's re-reported submit is suppressed as an echo → desktop saw only one.
    expect(desktop.calls.submitForm).toHaveLength(1)
  })
})

// Navigation history routed through the EngineView seam: assertions read
// FakeEngine-observable history state instead of Electron webContents spies.
describe('PaneManager navigation history through the seam', () => {
  it('goes back on the active pane and updates its current URL', async () => {
    const { paneManager, desktop } = createPaneManagerWithFakeEngines()
    getPaneManagerTestAccess(paneManager).tracker.didFocus('desktop')

    await desktop.navigate('https://example.com/one')
    await desktop.navigate('https://example.com/two')

    await paneManager.goBack()

    expect(desktop.calls.goBack).toBe(1)
    expect(desktop.getCurrentUrl()).toBe('https://example.com/one')
  })

  it('does not go back when the pane has no back entry', async () => {
    const { paneManager, desktop } = createPaneManagerWithFakeEngines()
    getPaneManagerTestAccess(paneManager).tracker.didFocus('desktop')

    await paneManager.goBack()

    expect(desktop.calls.goBack).toBe(0)
  })

  it('goes forward after going back', async () => {
    const { paneManager, desktop } = createPaneManagerWithFakeEngines()
    getPaneManagerTestAccess(paneManager).tracker.didFocus('desktop')

    await desktop.navigate('https://example.com/one')
    await desktop.navigate('https://example.com/two')
    await paneManager.goBack()

    await paneManager.goForward()

    expect(desktop.calls.goForward).toBe(1)
    expect(desktop.getCurrentUrl()).toBe('https://example.com/two')
  })

  it('reports navigation capabilities from the active pane, skipping the initial about:blank entry', async () => {
    const { paneManager, desktop } = createPaneManagerWithFakeEngines()
    getPaneManagerTestAccess(paneManager).tracker.didFocus('desktop')

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

  it('shows only the focused pane and restores all on clear', () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()

    paneManager.setPanesVisible(true)
    paneManager.setFocusedPane('iphone')

    expect(iphone.visible).toBe(true)
    expect(ipad.visible).toBe(false)
    expect(desktop.visible).toBe(false)

    paneManager.setFocusedPane(null)

    expect(iphone.visible).toBe(true)
    expect(ipad.visible).toBe(true)
    expect(desktop.visible).toBe(true)
  })

  it('keeps focus while all panes are hidden and honours it when reshown', () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()

    paneManager.setFocusedPane('desktop')
    paneManager.setPanesVisible(false)

    expect(desktop.visible).toBe(false)

    // Navigation / workspace switches call setPanesVisible(true); focus must survive.
    paneManager.setPanesVisible(true)

    expect(iphone.visible).toBe(false)
    expect(ipad.visible).toBe(false)
    expect(desktop.visible).toBe(true)
  })

  it('detaches each pane through the seam on recreateAll', async () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()
    const fakeWindow = { isDestroyed: () => false } as unknown as BrowserWindow
    getPaneManagerTestAccess(paneManager).mainWindow = fakeWindow
    // webContents is still a raw path in recreateAll (removed in issue 04); give
    // the fakes a minimal id so the webContentsToPane cleanup does not throw.
    for (const [i, engine] of [iphone, ipad, desktop].entries()) {
      Object.assign(engine, { webContents: { id: 1000 + i } })
    }
    // Make createEngine a no-op so recreateAll only exercises the detach path
    // (real engine construction needs Electron).
    getPaneManagerTestAccess(paneManager).createEngine = vi.fn(async () => {})

    await paneManager.recreateAll()

    expect(iphone.calls.detach).toBe(1)
    expect(ipad.calls.detach).toBe(1)
    expect(desktop.calls.detach).toBe(1)
    expect(iphone.attached).toBe(false)
  })

  it('detaches and destroys each pane through the seam on destroy', () => {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()
    getPaneManagerTestAccess(paneManager).mainWindow = {
      isDestroyed: () => false
    } as unknown as BrowserWindow

    iphone.attach({} as BrowserWindow)
    ipad.attach({} as BrowserWindow)
    desktop.attach({} as BrowserWindow)

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

// Pane-engine events routed through the EngineView seam: tests emit real
// FakeEngine events (via emit helpers) instead of hand-rolling a webContents
// listener recorder. attachNavigationListeners now subscribes via engine.on().
describe('PaneManager evidence clear on navigation', () => {
  function setupNavListeners(): {
    paneManager: PaneManager
    buffer: ReturnType<typeof createRuntimeEvidenceBuffer>
    iphone: FakeEngine
    ipad: FakeEngine
    desktop: FakeEngine
  } {
    const { paneManager, iphone, ipad, desktop } = createPaneManagerWithFakeEngines()
    const buffer = createRuntimeEvidenceBuffer()

    getPaneManagerTestAccess(paneManager).runtimeEvidence.set('desktop', buffer)
    getPaneManagerTestAccess(paneManager).tracker.didFocus('desktop')
    getPaneManagerTestAccess(paneManager).attachNavigationListeners(desktop, 'desktop')

    return { paneManager, buffer, iphone, ipad, desktop }
  }

  it('clears console and network evidence on top-level navigation', () => {
    const { buffer, desktop } = setupNavListeners()

    buffer.pushConsole({ level: 'error', message: 'before nav' })
    buffer.pushNetwork({ method: 'GET', url: 'http://localhost/req', path: '/req', failed: false })

    desktop.emitDidNavigate('http://localhost/page2')

    expect(buffer.getConsole()).toHaveLength(0)
    expect(buffer.getNetwork()).toHaveLength(0)
  })

  it('does not clear evidence on in-page navigation', () => {
    const { buffer, desktop } = setupNavListeners()

    buffer.pushConsole({ level: 'error', message: 'kept' })
    buffer.pushNetwork({ method: 'GET', url: 'http://localhost/req', path: '/req', failed: false })

    desktop.emitDidNavigateInPage('http://localhost/page2#section')

    expect(buffer.getConsole()).toHaveLength(1)
    expect(buffer.getNetwork()).toHaveLength(1)
  })

  it('does not clear evidence for other panes when one pane navigates', () => {
    const { paneManager, desktop } = createPaneManagerWithFakeEngines()
    const iphoneBuffer = createRuntimeEvidenceBuffer()
    const desktopBuffer = createRuntimeEvidenceBuffer()

    getPaneManagerTestAccess(paneManager).runtimeEvidence.set('iphone', iphoneBuffer)
    getPaneManagerTestAccess(paneManager).runtimeEvidence.set('desktop', desktopBuffer)
    getPaneManagerTestAccess(paneManager).attachNavigationListeners(desktop, 'desktop')

    iphoneBuffer.pushConsole({ level: 'warn', message: 'iphone log' })
    desktopBuffer.pushConsole({ level: 'error', message: 'desktop error' })

    desktop.emitDidNavigate('http://localhost/newpage')

    expect(desktopBuffer.getConsole()).toHaveLength(0)
    expect(iphoneBuffer.getConsole()).toHaveLength(1)
  })
})

// Loading + focus broadcasts routed through the seam: emitting FakeEngine
// loading/focus events drives PaneManager exactly as a live pane would.
describe('PaneManager pane-engine events through the seam', () => {
  it('sets pane loading state from emitted loading events', () => {
    const { paneManager, desktop } = createPaneManagerWithFakeEngines()
    getPaneManagerTestAccess(paneManager).attachLoadingListeners(desktop, 'desktop')

    desktop.emitDidStartLoading()
    expect(paneManager.getLoadingStates().desktop).toBe(true)
    expect(paneManager.isAnyPaneLoading()).toBe(true)

    desktop.emitDidStopLoading()
    expect(paneManager.getLoadingStates().desktop).toBe(false)
    expect(paneManager.isAnyPaneLoading()).toBe(false)
  })

  it('clears pane loading state on a failed load', () => {
    const { paneManager, desktop } = createPaneManagerWithFakeEngines()
    getPaneManagerTestAccess(paneManager).attachLoadingListeners(desktop, 'desktop')

    desktop.emitDidStartLoading()
    expect(paneManager.getLoadingStates().desktop).toBe(true)

    desktop.emitDidFailLoad()
    expect(paneManager.getLoadingStates().desktop).toBe(false)
  })

  it('marks the focused pane active from an emitted focus event', () => {
    const { paneManager, ipad } = createPaneManagerWithFakeEngines()
    getPaneManagerTestAccess(paneManager).attachNavigationListeners(ipad, 'ipad')

    ipad.emitFocus()

    expect(paneManager.getNavigationState().activePane).toBe('ipad')
  })

  it('forwards a before-input event to onPaneBeforeInput subscribers', () => {
    const { paneManager, desktop } = createPaneManagerWithFakeEngines()
    const received: Array<{ key: string; prevented: boolean }> = []

    paneManager.onPaneBeforeInput((input, preventDefault) => {
      let prevented = false
      preventDefault()
      prevented = true
      received.push({ key: input.key, prevented })
    })

    const preventDefault = vi.fn()
    desktop.emitBeforeInput({ type: 'keyDown', key: 'j' } as Input, preventDefault)

    expect(received).toEqual([{ key: 'j', prevented: true }])
    expect(preventDefault).toHaveBeenCalledTimes(1)
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

describe('PaneManager runtime evidence broadcasts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function createPaneManagerWithEvidence(): {
    paneManager: PaneManager
    buffer: ReturnType<typeof createRuntimeEvidenceBuffer>
    overlayEvents: Array<{ channel: string; payload: unknown }>
    shellSend: ReturnType<typeof vi.fn>
    sinkSnapshots: unknown[]
    setDiagnosticsOpen: (open: boolean) => void
  } {
    const paneManager = new PaneManager()
    const buffer = createRuntimeEvidenceBuffer()

    getPaneManagerTestAccess(paneManager).runtimeEvidence.set('desktop', buffer)
    getPaneManagerTestAccess(paneManager).tracker.didFocus('desktop')

    const overlayEvents: { channel: string; payload: unknown }[] = []
    paneManager.setOverlayBroadcast((channel, ...args) => {
      overlayEvents.push({ channel, payload: args[0] })
    })

    let diagnosticsOpen = false
    const sinkSnapshots: unknown[] = []
    paneManager.setDiagnosticsEvidenceSink({
      isOpen: () => diagnosticsOpen,
      send: (snapshot) => {
        sinkSnapshots.push(snapshot)
      }
    })

    const shellSend = vi.fn()
    getPaneManagerTestAccess(paneManager).mainWindow = {
      isDestroyed: () => false,
      webContents: { isDestroyed: () => false, send: shellSend }
    }

    return {
      paneManager,
      buffer,
      overlayEvents,
      shellSend,
      sinkSnapshots,
      setDiagnosticsOpen: (open: boolean) => {
        diagnosticsOpen = open
      }
    }
  }

  it('emits a problem-count payload with no entry arrays to overlay panels', () => {
    const { paneManager, buffer, overlayEvents } = createPaneManagerWithEvidence()

    buffer.pushConsole({ level: 'error', message: 'boom' })
    buffer.pushNetwork({
      method: 'GET',
      url: 'http://localhost/missing',
      path: '/missing',
      status: 404,
      failed: true
    })
    getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('desktop')

    const countEvents = overlayEvents.filter((e) => e.channel === 'runtime-evidence:problem-count')
    expect(countEvents).toHaveLength(1)
    expect(countEvents[0].payload).toEqual({ paneId: 'desktop', problemCount: 2 })

    const fullSnapshots = overlayEvents.filter((e) => e.channel === 'runtime-evidence:changed')
    expect(fullSnapshots).toEqual([])
  })

  it('sends full snapshots to the diagnostics sink only while the drawer is open', () => {
    const { paneManager, buffer, sinkSnapshots, setDiagnosticsOpen } =
      createPaneManagerWithEvidence()

    buffer.pushConsole({ level: 'error', message: 'while closed' })
    getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('desktop')
    expect(sinkSnapshots).toEqual([])

    setDiagnosticsOpen(true)
    buffer.pushConsole({ level: 'error', message: 'while open' })
    getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('desktop')
    vi.advanceTimersByTime(RUNTIME_EVIDENCE_EMIT_WINDOW_MS)

    expect(sinkSnapshots).toHaveLength(1)
    expect(sinkSnapshots[0]).toMatchObject({ paneId: 'desktop', problemCount: 2 })
  })

  it('does not assemble a snapshot while the drawer is closed', () => {
    const { paneManager, buffer } = createPaneManagerWithEvidence()
    const snapshotSpy = vi.spyOn(buffer, 'snapshot')

    buffer.pushConsole({ level: 'error', message: 'boom' })
    getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('desktop')

    expect(snapshotSpy).not.toHaveBeenCalled()
  })

  it('does not send evidence broadcasts to the shell window', () => {
    const { paneManager, buffer, shellSend } = createPaneManagerWithEvidence()

    buffer.pushConsole({ level: 'error', message: 'boom' })
    getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('desktop')
    paneManager.clearRuntimeEvidence('console')

    const evidenceChannels = shellSend.mock.calls.filter(([channel]) =>
      String(channel).startsWith('runtime-evidence:')
    )
    expect(evidenceChannels).toEqual([])
  })

  it('does not emit for evidence on an inactive pane', () => {
    const { paneManager, overlayEvents } = createPaneManagerWithEvidence()
    const iphoneBuffer = createRuntimeEvidenceBuffer()
    getPaneManagerTestAccess(paneManager).runtimeEvidence.set('iphone', iphoneBuffer)

    iphoneBuffer.pushConsole({ level: 'error', message: 'inactive pane' })
    getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('iphone')

    expect(overlayEvents).toEqual([])
  })

  it('emits both channels after a clear so the badge converges', () => {
    const { paneManager, buffer, overlayEvents } = createPaneManagerWithEvidence()

    buffer.pushConsole({ level: 'error', message: 'boom' })
    paneManager.clearRuntimeEvidence('console')
    vi.advanceTimersByTime(RUNTIME_EVIDENCE_EMIT_WINDOW_MS)

    const countEvents = overlayEvents.filter((e) => e.channel === 'runtime-evidence:problem-count')
    expect(countEvents.at(-1)?.payload).toEqual({ paneId: 'desktop', problemCount: 0 })
  })

  it('collapses a burst into one leading and one trailing emission with the final state', () => {
    const { paneManager, buffer, overlayEvents } = createPaneManagerWithEvidence()

    for (let i = 0; i < 50; i += 1) {
      buffer.pushConsole({ level: 'error', message: `burst ${i}` })
      getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('desktop')
    }

    const countEvents = (): Array<{ channel: string; payload: unknown }> =>
      overlayEvents.filter((e) => e.channel === 'runtime-evidence:problem-count')

    expect(countEvents()).toHaveLength(1)
    expect(countEvents()[0].payload).toEqual({ paneId: 'desktop', problemCount: 1 })

    vi.advanceTimersByTime(RUNTIME_EVIDENCE_EMIT_WINDOW_MS)

    expect(countEvents()).toHaveLength(2)
    expect(countEvents()[1].payload).toEqual({ paneId: 'desktop', problemCount: 50 })
  })

  it('emits immediately for a sparse event after an idle window', () => {
    const { paneManager, buffer, overlayEvents } = createPaneManagerWithEvidence()

    buffer.pushConsole({ level: 'error', message: 'first' })
    getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('desktop')
    expect(overlayEvents).toHaveLength(1)

    vi.advanceTimersByTime(RUNTIME_EVIDENCE_EMIT_WINDOW_MS * 2)

    buffer.pushConsole({ level: 'error', message: 'second' })
    getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('desktop')
    expect(overlayEvents).toHaveLength(2)
    expect(overlayEvents[1].payload).toEqual({ paneId: 'desktop', problemCount: 2 })
  })

  it('clear returns the post-clear snapshot synchronously while an emission is pending', () => {
    const { paneManager, buffer } = createPaneManagerWithEvidence()

    buffer.pushConsole({ level: 'error', message: 'boom' })
    getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('desktop')
    buffer.pushConsole({ level: 'error', message: 'pending burst' })
    getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('desktop')

    const cleared = paneManager.clearRuntimeEvidence('console')

    expect(cleared.console).toEqual([])
    expect(cleared.problemCount).toBe(0)
  })

  it('pull-based snapshot reads live evidence regardless of pending emissions', () => {
    const { paneManager, buffer } = createPaneManagerWithEvidence()

    buffer.pushConsole({ level: 'error', message: 'first' })
    getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('desktop')
    buffer.pushConsole({ level: 'error', message: 'second (still pending)' })
    getPaneManagerTestAccess(paneManager).notifyRuntimeEvidenceChanged('desktop')

    expect(paneManager.getRuntimeEvidenceSnapshot().console).toHaveLength(2)
  })
})
