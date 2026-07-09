import type { DeviceProfile, PaneId, PaneMount } from '../../src/shared/types'
import type { ElementFingerprint, MirrorFailureLog } from '../../src/shared/element-mirror'
import type { EngineView, ValueSyncPayload } from '../../src/main/engine-view'
import type { ConsoleEvidenceEntry, NetworkEvidenceEntry } from '../../src/shared/runtime-evidence'

export type ClickResolution =
  { dispatched: true } | { handled: true } | { skipDispatch: true; navigateTo: string } | null

type ClickResolver = ClickResolution | ((fingerprint: ElementFingerprint) => ClickResolution)

/**
 * In-memory {@link EngineView} adapter for unit tests. Keeps observable state
 * (current URL, last mount, device profile), records every interface call, and
 * exposes emitter-style helpers so tests can simulate page-side effects
 * (navigation echoes, evidence pushes) without a real browser. The second
 * adapter that makes the EngineView seam real — see `.scratch/engine-view-seam/`.
 */
export class FakeEngine implements EngineView {
  currentUrl = 'about:blank'
  lastMount: PaneMount | null = null
  deviceProfile: DeviceProfile | null = null
  destroyed = false

  readonly calls = {
    mount: [] as PaneMount[],
    navigate: [] as string[],
    setDevice: [] as DeviceProfile[],
    syncScroll: [] as number[],
    resolveClickPoint: [] as ElementFingerprint[],
    applyValue: [] as Array<{ fingerprint: ElementFingerprint; payload: ValueSyncPayload }>,
    submitForm: [] as ElementFingerprint[],
    dispatchClick: [] as Array<{ x: number; y: number }>,
    destroy: 0
  }

  // Simulate page-side effects a real pane would report back. Tests wire these
  // to drive echo/suppression scenarios (e.g. an applied value re-reported by
  // the target pane) that a live WebContents would produce.
  onApplyValue:
    ((fingerprint: ElementFingerprint, payload: ValueSyncPayload) => void | Promise<void>) | null =
    null
  onSubmitForm: ((fingerprint: ElementFingerprint) => void | Promise<void>) | null = null

  private clickResolver: ClickResolver = null
  private readonly mirrorFailureLogs: MirrorFailureLog[] = []
  private runtimeEvidence: {
    pushConsole: (entry: Omit<ConsoleEvidenceEntry, 'id' | 'timestamp'>) => void
    pushNetwork: (
      entry: Omit<NetworkEvidenceEntry, 'id' | 'timestamp' | 'failed'> &
        Partial<Pick<NetworkEvidenceEntry, 'failed'>>
    ) => void
  } | null = null

  constructor(readonly paneId: PaneId = 'desktop') {}

  // --- EngineView interface -------------------------------------------------

  mount(mount: PaneMount): void {
    this.lastMount = mount
    this.calls.mount.push(mount)
  }

  async navigate(url: string): Promise<void> {
    this.calls.navigate.push(url)
    this.currentUrl = url
  }

  async setDevice(profile: DeviceProfile): Promise<void> {
    this.deviceProfile = profile
    this.calls.setDevice.push(profile)
  }

  async syncScroll(ratio: number): Promise<void> {
    this.calls.syncScroll.push(ratio)
  }

  async resolveClickPoint(fingerprint: ElementFingerprint): Promise<ClickResolution> {
    this.calls.resolveClickPoint.push(fingerprint)
    const resolution =
      typeof this.clickResolver === 'function'
        ? this.clickResolver(fingerprint)
        : this.clickResolver
    if (resolution && 'dispatched' in resolution) {
      // Mirror the real engine, which dispatches the resolved click itself.
      this.dispatchClick(0, 0)
    }
    return resolution
  }

  async applyValue(fingerprint: ElementFingerprint, payload: ValueSyncPayload): Promise<void> {
    this.calls.applyValue.push({ fingerprint, payload })
    await this.onApplyValue?.(fingerprint, payload)
  }

  async submitForm(fingerprint: ElementFingerprint): Promise<void> {
    this.calls.submitForm.push(fingerprint)
    await this.onSubmitForm?.(fingerprint)
  }

  getMirrorFailureLogs(): MirrorFailureLog[] {
    return [...this.mirrorFailureLogs]
  }

  dispatchClick(x: number, y: number): void {
    this.calls.dispatchClick.push({ x, y })
  }

  destroy(): void {
    this.calls.destroy += 1
    this.destroyed = true
  }

  // --- Test-facing programming / emitter helpers ----------------------------

  /** Program what {@link resolveClickPoint} returns (value or per-fingerprint fn). */
  setClickResolution(resolver: ClickResolver): void {
    this.clickResolver = resolver
  }

  /** Simulate a mirror-failure the real engine would record for later inspection. */
  simulateMirrorFailure(log: MirrorFailureLog): void {
    this.mirrorFailureLogs.push(log)
  }

  bindRuntimeEvidence(handlers: {
    pushConsole: (entry: Omit<ConsoleEvidenceEntry, 'id' | 'timestamp'>) => void
    pushNetwork: (
      entry: Omit<NetworkEvidenceEntry, 'id' | 'timestamp' | 'failed'> &
        Partial<Pick<NetworkEvidenceEntry, 'failed'>>
    ) => void
  }): void {
    this.runtimeEvidence = handlers
  }

  /** Simulate a console entry the page would push through the evidence binding. */
  emitConsoleEvidence(entry: Omit<ConsoleEvidenceEntry, 'id' | 'timestamp'>): void {
    this.runtimeEvidence?.pushConsole(entry)
  }

  /** Simulate a network entry the page would push through the evidence binding. */
  emitNetworkEvidence(
    entry: Omit<NetworkEvidenceEntry, 'id' | 'timestamp' | 'failed'> &
      Partial<Pick<NetworkEvidenceEntry, 'failed'>>
  ): void {
    this.runtimeEvidence?.pushNetwork(entry)
  }
}
