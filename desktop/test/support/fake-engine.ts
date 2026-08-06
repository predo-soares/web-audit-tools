import type { BrowserWindow, Input } from 'electron'
import type {
  DeviceProfile,
  MediaFeatureState,
  PaneId,
  PaneMount,
  ThemePreference
} from '../../src/shared/types'
import type { ElementFingerprint, MirrorFailureLog } from '../../src/shared/element-mirror'
import type {
  EngineView,
  EngineViewEventMap,
  MirroredKey,
  ValueSyncPayload
} from '../../src/main/engine/engine-view'
import type { ConsoleEvidenceEntry, NetworkEvidenceEntry } from '../../src/shared/runtime-evidence'

// Monotonic source of stable fake WebContents ids, so each FakeEngine gets a
// distinct id the way real WebContents do (used to key PaneManager's maps).
let nextFakeWebContentsId = 1

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
  // In-memory presentation state a real pane keeps on its native view: whether
  // the view is attached to the window's content view, whether it is visible,
  // and whether it holds keyboard focus.
  visible = false
  attached = false
  focused = false

  readonly calls = {
    mount: [] as PaneMount[],
    navigate: [] as string[],
    setDevice: [] as DeviceProfile[],
    setThemePreference: [] as ThemePreference[],
    setMediaFeatures: [] as MediaFeatureState[],
    syncScroll: [] as number[],
    resolveClickPoint: [] as ElementFingerprint[],
    applyValue: [] as Array<{ fingerprint: ElementFingerprint; payload: ValueSyncPayload }>,
    submitForm: [] as ElementFingerprint[],
    dispatchClick: [] as Array<{ x: number; y: number }>,
    dispatchKey: [] as MirroredKey[],
    evaluate: [] as string[],
    captureScreenshot: 0,
    goBack: 0,
    goForward: 0,
    setVisible: [] as boolean[],
    attach: 0,
    detach: 0,
    focus: 0,
    stop: 0,
    destroy: 0
  }

  // Scripted return value for evaluate() — tests set this to control what the
  // expression "returns" without a live page.
  evaluateResult: unknown = undefined
  // Scripted return value for captureScreenshot() — tests set this to a PNG
  // buffer when testing snapshot/screenshot paths.
  screenshotBuffer: Buffer = Buffer.alloc(1)

  // In-memory navigation history mirroring a real pane's per-pane Chromium
  // session history. `navigate` pushes a new entry (truncating any forward
  // entries), while goBack/goForward move the active index without dropping
  // entries — so canGoBack/canGoForward and getCurrentUrl stay consistent.
  private readonly history: string[] = ['about:blank']
  private historyIndex = 0

  // Simulate page-side effects a real pane would report back. Tests wire these
  // to drive echo/suppression scenarios (e.g. an applied value re-reported by
  // the target pane) that a live WebContents would produce.
  onApplyValue:
    ((fingerprint: ElementFingerprint, payload: ValueSyncPayload) => void | Promise<void>) | null =
    null
  onSubmitForm: ((fingerprint: ElementFingerprint) => void | Promise<void>) | null = null

  private readonly webContentsId = nextFakeWebContentsId++
  // In-memory event registry backing on()/emit helpers. Mirrors a real pane's
  // webContents event surface without a live browser.
  private readonly eventHandlers: {
    [E in keyof EngineViewEventMap]: Set<EngineViewEventMap[E]>
  } = {
    'did-navigate': new Set(),
    'did-navigate-in-page': new Set(),
    'did-start-loading': new Set(),
    'did-stop-loading': new Set(),
    'did-fail-load': new Set(),
    'page-title-updated': new Set(),
    'page-favicon-updated': new Set(),
    focus: new Set(),
    'before-input': new Set()
  }

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
    // Drop any forward entries, then push and land on the new entry.
    this.history.splice(this.historyIndex + 1)
    this.history.push(url)
    this.historyIndex = this.history.length - 1
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

  dispatchKey(key: MirroredKey): void {
    this.calls.dispatchKey.push(key)
  }

  getCurrentUrl(): string {
    return this.currentUrl
  }

  canGoBack(): boolean {
    return this.historyIndex > 0
  }

  canGoForward(): boolean {
    return this.historyIndex < this.history.length - 1
  }

  goBack(): void {
    this.calls.goBack += 1
    if (this.historyIndex === 0) return
    this.historyIndex -= 1
    this.currentUrl = this.history[this.historyIndex] ?? this.currentUrl
  }

  goForward(): void {
    this.calls.goForward += 1
    if (this.historyIndex >= this.history.length - 1) return
    this.historyIndex += 1
    this.currentUrl = this.history[this.historyIndex] ?? this.currentUrl
  }

  getPreviousEntryUrl(): string | null {
    return this.historyIndex > 0 ? (this.history[this.historyIndex - 1] ?? null) : null
  }

  setVisible(visible: boolean): void {
    this.calls.setVisible.push(visible)
    this.visible = visible
  }

  // Takes a window for interface parity with the real engine; the FakeEngine
  // only records that it was attached/detached. Safe to call in any order.
  attach(window: BrowserWindow): void {
    void window
    this.calls.attach += 1
    this.attached = true
  }

  detach(window: BrowserWindow): void {
    void window
    this.calls.detach += 1
    this.attached = false
  }

  focus(): void {
    this.calls.focus += 1
    this.focused = true
  }

  async setThemePreference(preference: ThemePreference): Promise<void> {
    this.calls.setThemePreference.push(preference)
  }

  async setMediaFeatures(state: MediaFeatureState): Promise<void> {
    this.calls.setMediaFeatures.push(state)
  }

  stop(): void {
    this.calls.stop += 1
  }

  async evaluate<T = unknown>(_expression: string): Promise<T> {
    this.calls.evaluate.push(_expression)
    // PaneManager drives per-pane history through the page history API rather
    // than the engine's goBack/goForward methods, so mirror those calls onto
    // the in-memory history model to keep the seam observable in tests.
    if (_expression === 'history.back()') {
      this.goBack()
    } else if (_expression === 'history.forward()') {
      this.goForward()
    }
    return this.evaluateResult as T
  }

  async captureScreenshot(): Promise<Buffer> {
    this.calls.captureScreenshot += 1
    return this.screenshotBuffer
  }

  on<E extends keyof EngineViewEventMap>(event: E, handler: EngineViewEventMap[E]): () => void {
    const handlers = this.eventHandlers[event]
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  }

  getWebContentsId(): number {
    return this.webContentsId
  }

  destroy(): void {
    this.calls.destroy += 1
    this.destroyed = true
    this.attached = false
    // After destroy a real pane's listeners no longer fire; drop every handler
    // so emit helpers and any late on() subscriptions deliver nothing.
    for (const handlers of Object.values(this.eventHandlers)) {
      handlers.clear()
    }
  }

  // --- Test-facing programming / emitter helpers ----------------------------

  // Dispatch to every subscriber, guarding on destroyed so emissions after
  // destroy() never reach handlers.
  private emit<E extends keyof EngineViewEventMap>(
    event: E,
    invoke: (handler: EngineViewEventMap[E]) => void
  ): void {
    if (this.destroyed) return
    for (const handler of this.eventHandlers[event]) {
      invoke(handler)
    }
  }

  /** Simulate a top-level navigation the pane would report. */
  emitDidNavigate(url: string): void {
    this.emit('did-navigate', (handler) => handler(url))
  }

  /** Simulate an in-page (hash/history.pushState) navigation. */
  emitDidNavigateInPage(url: string): void {
    this.emit('did-navigate-in-page', (handler) => handler(url))
  }

  /** Simulate the pane starting to load. */
  emitDidStartLoading(): void {
    this.emit('did-start-loading', (handler) => handler())
  }

  /** Simulate the pane finishing loading. */
  emitDidStopLoading(): void {
    this.emit('did-stop-loading', (handler) => handler())
  }

  /** Simulate a failed load. */
  emitDidFailLoad(): void {
    this.emit('did-fail-load', (handler) => handler())
  }

  /** Simulate a page title update. */
  emitTitleUpdated(title: string): void {
    this.emit('page-title-updated', (handler) => handler(title))
  }

  /** Simulate a favicon update. */
  emitFaviconUpdated(favicons: string[]): void {
    this.emit('page-favicon-updated', (handler) => handler(favicons))
  }

  /** Simulate the pane gaining focus. */
  emitFocus(): void {
    this.emit('focus', (handler) => handler())
  }

  /** Simulate a before-input keyboard event; preventDefault defaults to a no-op. */
  emitBeforeInput(input: Input, preventDefault: () => void = () => {}): void {
    this.emit('before-input', (handler) => handler(input, preventDefault))
  }

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
