import { describe, expect, it } from 'vitest'
import type { EngineView } from '../../src/main/engine-view'
import type { MirrorFailureLog } from '../../src/shared/element-mirror'
import type { ConsoleEvidenceEntry } from '../../src/shared/runtime-evidence'
import type { InspectionTarget } from '../../src/shared/inspection'

/**
 * Observation port the contract suite uses to inspect an adapter's state
 * through a common shape, so any {@link EngineView} adapter factory plugs into
 * `describeEngineViewContract` unchanged. The FakeEngine harness reads its
 * in-memory fields; a future real-engine harness would read the live backend
 * (e.g. `webContents.getURL()`).
 */
export interface EngineViewContractHarness {
  engine: EngineView
  /** The adapter's observable current URL after navigation. */
  currentUrl(): string
  /** Record a mirror failure the way the real engine would during resolution. */
  simulateMirrorFailure(log: MirrorFailureLog): void
  /** The adapter's observable visibility, as {@link EngineView.setVisible} sets it. */
  isVisible(): boolean
  /** Whether the adapter's view is currently attached to a window. */
  isAttached(): boolean
  /**
   * Drive a `did-navigate` event through the adapter's real event source. The
   * FakeEngine harness calls its emit helper; a future real-engine harness
   * would trigger an actual page navigation.
   */
  emitNavigate(url: string): void
  /**
   * Program the value `evaluate()` will return for the next call. The
   * FakeEngine harness stores it in `evaluateResult`; a real-engine harness
   * would inject it via a page script.
   */
  scriptEvaluate(result: unknown): void
  /**
   * Program the `Buffer` `captureScreenshot()` will return. The FakeEngine
   * harness stores it in `screenshotBuffer`; a real-engine harness would
   * populate the visible page.
   */
  scriptScreenshot(buffer: Buffer): void
  /**
   * Simulate a console evidence entry the page would push through the bound
   * evidence handler.
   */
  emitConsoleEvidence(entry: Omit<ConsoleEvidenceEntry, 'id' | 'timestamp'>): void
}

// A stand-in BrowserWindow for attach/detach in the contract. The FakeEngine
// ignores it; a future real-engine harness would pass a live BrowserWindow.
const contractWindow = {} as unknown as import('electron').BrowserWindow

function sampleFailure(reason: MirrorFailureLog['reason'] = 'not-found'): MirrorFailureLog {
  return {
    fingerprint: { layers: [{ type: 'id', id: 'semantic-primary' }] },
    paneId: 'desktop',
    reason
  }
}

/**
 * The EngineView contract: interface semantics every adapter must satisfy.
 * Parameterized by a harness factory so the same spec pins the FakeEngine now
 * and any future backend adapter (WKWebView overlay, streamed WebKit) later.
 */
export function describeEngineViewContract(
  name: string,
  createHarness: () => EngineViewContractHarness
): void {
  describe(`EngineView contract: ${name}`, () => {
    it('navigate resolves and updates the observable current URL', async () => {
      const harness = createHarness()

      await expect(harness.engine.navigate('https://example.com/')).resolves.toBeUndefined()

      expect(harness.currentUrl()).toBe('https://example.com/')
    })

    it('canGoBack is false before any navigation', () => {
      const harness = createHarness()

      expect(harness.engine.canGoBack()).toBe(false)
      expect(harness.engine.canGoForward()).toBe(false)
    })

    it('goBack on empty history is a no-op', async () => {
      const harness = createHarness()

      expect(() => harness.engine.goBack()).not.toThrow()
      expect(() => harness.engine.goForward()).not.toThrow()
      expect(harness.currentUrl()).toBe(harness.engine.getCurrentUrl())
    })

    it('getCurrentUrl reflects the last committed navigation', async () => {
      const harness = createHarness()

      await harness.engine.navigate('https://example.com/one')

      expect(harness.engine.getCurrentUrl()).toBe('https://example.com/one')
      expect(harness.engine.canGoBack()).toBe(true)
      expect(harness.engine.canGoForward()).toBe(false)
    })

    it('goBack returns the current URL to the previous entry', async () => {
      const harness = createHarness()

      await harness.engine.navigate('https://example.com/one')
      await harness.engine.navigate('https://example.com/two')
      harness.engine.goBack()

      expect(harness.engine.getCurrentUrl()).toBe('https://example.com/one')
      expect(harness.engine.canGoForward()).toBe(true)
    })

    it('attach then detach is safe', () => {
      const harness = createHarness()

      expect(() => harness.engine.attach(contractWindow)).not.toThrow()
      expect(harness.isAttached()).toBe(true)

      expect(() => harness.engine.detach(contractWindow)).not.toThrow()
      expect(harness.isAttached()).toBe(false)
    })

    it('detach without a prior attach is a no-op, not a throw', () => {
      const harness = createHarness()

      expect(() => harness.engine.detach(contractWindow)).not.toThrow()
      expect(harness.isAttached()).toBe(false)
    })

    it('visibility is togglable and observable', () => {
      const harness = createHarness()

      harness.engine.setVisible(true)
      expect(harness.isVisible()).toBe(true)

      harness.engine.setVisible(false)
      expect(harness.isVisible()).toBe(false)
    })

    it('destroy while attached is safe', () => {
      const harness = createHarness()
      harness.engine.attach(contractWindow)

      expect(() => harness.engine.destroy()).not.toThrow()
    })

    it('destroy is idempotent', () => {
      const harness = createHarness()

      harness.engine.destroy()

      expect(() => harness.engine.destroy()).not.toThrow()
    })

    it('getMirrorFailureLogs returns a copy that cannot mutate engine state', () => {
      const harness = createHarness()
      harness.simulateMirrorFailure(sampleFailure())

      const returned = harness.engine.getMirrorFailureLogs()
      expect(returned).toHaveLength(1)

      returned.push(sampleFailure('ambiguous'))

      expect(harness.engine.getMirrorFailureLogs()).toHaveLength(1)
    })

    it('getMirrorFailureLogs starts empty', () => {
      const harness = createHarness()

      expect(harness.engine.getMirrorFailureLogs()).toEqual([])
    })

    it('on delivers emitted events to the subscribed handler', () => {
      const harness = createHarness()
      const urls: string[] = []

      harness.engine.on('did-navigate', (url) => urls.push(url))
      harness.emitNavigate('https://example.com/subscribed')

      expect(urls).toEqual(['https://example.com/subscribed'])
    })

    it('unsubscribe stops further delivery', () => {
      const harness = createHarness()
      const urls: string[] = []

      const unsubscribe = harness.engine.on('did-navigate', (url) => urls.push(url))
      harness.emitNavigate('https://example.com/one')
      unsubscribe()
      harness.emitNavigate('https://example.com/two')

      expect(urls).toEqual(['https://example.com/one'])
    })

    it('events after destroy are not delivered', () => {
      const harness = createHarness()
      const urls: string[] = []

      harness.engine.on('did-navigate', (url) => urls.push(url))
      harness.engine.destroy()
      harness.emitNavigate('https://example.com/after-destroy')

      expect(urls).toEqual([])
    })

    it('getWebContentsId returns a stable value across calls', () => {
      const harness = createHarness()

      expect(harness.engine.getWebContentsId()).toBe(harness.engine.getWebContentsId())
    })

    it('evaluate resolves to the scripted result', async () => {
      const harness = createHarness()
      harness.scriptEvaluate(42)

      const result = await harness.engine.evaluate<number>('40 + 2')

      expect(result).toBe(42)
    })

    it('captureScreenshot resolves to the scripted Buffer', async () => {
      const harness = createHarness()
      const expected = Buffer.from([1, 2, 3])
      harness.scriptScreenshot(expected)

      const result = await harness.engine.captureScreenshot()

      expect(result).toEqual(expected)
    })

    it('captureScreenshot returns a Buffer instance', async () => {
      const harness = createHarness()

      const result = await harness.engine.captureScreenshot()

      expect(Buffer.isBuffer(result)).toBe(true)
    })

    it('inspection mode has a typed no-live-page contract', async () => {
      const harness = createHarness()
      const target: InspectionTarget = {
        descriptor: {
          tagName: 'button',
          id: 'inspect-me',
          testId: null,
          accessibleName: 'Inspect me',
          role: 'button',
          visibleText: 'Inspect me',
          structuralPath: 'body > button:nth-child(1)'
        },
        layers: [{ type: 'id', value: 'inspect-me' }],
        strongestIdentity: { type: 'id', value: 'inspect-me' }
      }

      await expect(harness.engine.setInspectionMode(true)).resolves.toBeUndefined()
      await expect(harness.engine.inspectElement(target)).resolves.toBeNull()
      await expect(harness.engine.setInspectionMode(false)).resolves.toBeUndefined()
    })

    it('bindRuntimeEvidence delivers pushConsole entries through the binding', () => {
      const harness = createHarness()
      const received: Omit<ConsoleEvidenceEntry, 'id' | 'timestamp'>[] = []

      harness.engine.bindRuntimeEvidence({
        pushConsole: (entry) => received.push(entry),
        pushNetwork: () => {}
      })
      harness.emitConsoleEvidence({ level: 'error', message: 'test error', args: [] })

      expect(received).toHaveLength(1)
      expect(received[0]).toMatchObject({ level: 'error', message: 'test error' })
    })

    it('bindRuntimeEvidence delivers nothing before the binding is set', () => {
      const harness = createHarness()
      const received: Omit<ConsoleEvidenceEntry, 'id' | 'timestamp'>[] = []

      harness.emitConsoleEvidence({ level: 'warn', message: 'before bind', args: [] })

      harness.engine.bindRuntimeEvidence({
        pushConsole: (entry) => received.push(entry),
        pushNetwork: () => {}
      })

      expect(received).toHaveLength(0)
    })
  })
}
