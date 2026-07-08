import type { DeviceProfile, PaneMount } from '../shared/types'
import type { ElementFingerprint } from '../shared/element-fingerprint'

export interface EngineView {
  mount(mount: PaneMount): void
  navigate(url: string): Promise<void>
  setDevice(profile: DeviceProfile): Promise<void>
  syncScroll(ratio: number): Promise<void>
  resolveClickPoint(fingerprint: ElementFingerprint): Promise<{ x: number; y: number } | null>
  applyValue(fingerprint: ElementFingerprint, value: string): Promise<void>
  dispatchClick(x: number, y: number): void
  destroy(): void
}
