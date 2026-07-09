import { describe, expect, it } from 'vitest'
import type { EngineView } from '../../src/main/engine-view'
import type { MirrorFailureLog } from '../../src/shared/element-mirror'

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
}

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
  })
}
