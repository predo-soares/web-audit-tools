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
  resolveClickPoint(
    fingerprint: ElementFingerprint
  ): Promise<
    | { dispatched: true }
    | { handled: true }
    | { skipDispatch: true; navigateTo: string }
    | null
  >
  applyValue(fingerprint: ElementFingerprint, payload: ValueSyncPayload): Promise<void>
  submitForm(fingerprint: ElementFingerprint): Promise<void>
  getMirrorFailureLogs(): MirrorFailureLog[]
  dispatchClick(x: number, y: number): void
  destroy(): void
}
