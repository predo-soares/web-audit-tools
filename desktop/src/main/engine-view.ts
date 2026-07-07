import type { DeviceProfile, PaneMount } from '../shared/types'

export interface EngineView {
  mount(mount: PaneMount): void
  navigate(url: string): Promise<void>
  setDevice(profile: DeviceProfile): Promise<void>
  syncScroll(ratio: number): Promise<void>
  dispatchClick(x: number, y: number): void
  destroy(): void
}
