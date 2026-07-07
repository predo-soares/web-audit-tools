export type PaneId = 'iphone' | 'ipad' | 'desktop'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface DeviceProfile {
  id: PaneId
  name: string
  width: number
  height: number
  deviceScaleFactor: number
  touch: boolean
  userAgent: string
}

export interface PaneMount {
  screenBounds: Bounds
  logicalSize: Size
  cornerRadius: number
  zoom: number
  webviewScale: number
}

export interface PaneLoadingState {
  paneId: PaneId
  loading: boolean
}

export interface PaneScrollReport {
  paneId: PaneId
  ratio: number
  programmatic: boolean
}
