import type { BrowserWindow, Input } from 'electron'
import type {
  DeviceProfile,
  MediaFeatureState,
  PaneMount,
  ThemePreference
} from '../../shared/types'
import type { ElementFingerprint, MirrorFailureLog } from '../../shared/element-mirror'
import type { ConsoleEvidenceEntry, NetworkEvidenceEntry } from '../../shared/runtime-evidence'

export interface ValueSyncPayload {
  value: string
  selectedIndex?: number
  generation?: number
}

/**
 * The pane-engine events an {@link EngineView} exposes to its consumers. These
 * are the Electron `webContents` events PaneManager used to attach raw
 * listeners for — moved behind the seam so the Electron wiring lives inside the
 * real engine and tests can drive them through the FakeEngine's emit helpers.
 */
export interface EngineViewEventMap {
  'did-navigate': (url: string) => void
  'did-navigate-in-page': (url: string) => void
  'did-start-loading': () => void
  'did-stop-loading': () => void
  'did-fail-load': (errorCode: number, errorDescription: string, isMainFrame: boolean) => void
  'page-title-updated': (title: string) => void
  'page-favicon-updated': (favicons: string[]) => void
  focus: () => void
  // Carries the Electron input plus a preventDefault callback so consumers can
  // suppress the key without reaching into the raw before-input-event.
  'before-input': (input: Input, preventDefault: () => void) => void
}

export interface EngineView {
  mount(mount: PaneMount): void
  navigate(url: string): Promise<void>
  setDevice(profile: DeviceProfile): Promise<void>
  syncScroll(ratio: number): Promise<void>
  /** The pane's current committed URL (per-pane Chromium session history). */
  getCurrentUrl(): string
  /** Whether the pane has a back entry in its navigation history. */
  canGoBack(): boolean
  /** Whether the pane has a forward entry in its navigation history. */
  canGoForward(): boolean
  /** Navigate back one entry in the pane's history; a no-op on empty history. */
  goBack(): void
  /** Navigate forward one entry in the pane's history; a no-op on empty history. */
  goForward(): void
  /**
   * URL of the entry immediately behind the active history entry, or null when
   * the active entry is first. Lets callers apply the about:blank initial-entry
   * rule (Electron counts the initial about:blank → real-page load as history)
   * without reaching into the raw navigation history.
   */
  getPreviousEntryUrl(): string | null
  resolveClickPoint(
    fingerprint: ElementFingerprint
  ): Promise<
    { dispatched: true } | { handled: true } | { skipDispatch: true; navigateTo: string } | null
  >
  applyValue(fingerprint: ElementFingerprint, payload: ValueSyncPayload): Promise<void>
  submitForm(fingerprint: ElementFingerprint): Promise<void>
  getMirrorFailureLogs(): MirrorFailureLog[]
  dispatchClick(x: number, y: number): void
  /** Show or hide the pane's view without detaching it from the window. */
  setVisible(visible: boolean): void
  /** Add the pane's view to the window's content view. */
  attach(window: BrowserWindow): void
  /**
   * Remove the pane's view from the window's content view. Safe to call when
   * the view is already detached (Electron may detach during teardown).
   */
  detach(window: BrowserWindow): void
  /** Move keyboard focus to the pane. */
  focus(): void
  /** Apply the user's theme preference to the pane. */
  setThemePreference(preference: ThemePreference): Promise<void>
  /** Apply the emulated CSS media features (DevTools Rendering panel) to the pane. */
  setMediaFeatures(state: MediaFeatureState): Promise<void>
  /** Stop any in-progress load; a no-op when the pane is not loading. */
  stop(): void
  /**
   * Evaluate a JavaScript expression inside the pane's page context.
   * Equivalent to `webContents.executeJavaScript` without the raw reach-through.
   */
  evaluate<T = unknown>(expression: string): Promise<T>
  /**
   * Capture a full-resolution screenshot of the pane's page at its logical
   * device size. Returns a PNG-encoded `Buffer`.
   */
  captureScreenshot(): Promise<Buffer>
  /**
   * Bind evidence push handlers so console and network entries captured inside
   * the pane are forwarded to the caller's buffer. The evidence pipeline calls
   * this once per engine lifetime; calling again replaces the previous binding.
   */
  bindRuntimeEvidence(handlers: {
    pushConsole: (entry: Omit<ConsoleEvidenceEntry, 'id' | 'timestamp'>) => void
    pushNetwork: (
      entry: Omit<NetworkEvidenceEntry, 'id' | 'timestamp' | 'failed'> &
        Partial<Pick<NetworkEvidenceEntry, 'failed'>>
    ) => void
  }): void
  /**
   * Subscribe to a pane-engine event. Returns an unsubscribe function that
   * detaches the underlying listener(s). After {@link destroy}, handlers must
   * not fire.
   */
  on<E extends keyof EngineViewEventMap>(event: E, handler: EngineViewEventMap[E]): () => void
  /**
   * Stable per-engine identity for the pane's underlying WebContents. Lets
   * callers key maps by pane without reaching into `webContents.id` directly.
   */
  getWebContentsId(): number
  destroy(): void
}
