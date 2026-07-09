import type { DeviceProfile, PaneMount } from '../shared/types'
import type { ElementFingerprint, MirrorFailureLog } from '../shared/element-mirror'

export interface ValueSyncPayload {
  value: string
  selectedIndex?: number
  generation?: number
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
  destroy(): void
}
