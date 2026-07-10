import type { BrowserWindow, Input } from 'electron'
import type { DeviceProfile, PaneMount } from '../shared/types'
import type { ElementFingerprint, MirrorFailureLog } from '../shared/element-mirror'

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
  'did-fail-load': () => void
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
