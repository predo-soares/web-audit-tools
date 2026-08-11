export type PaneId = 'iphone' | 'ipad' | 'desktop'
export type ThemePreference = 'system' | 'light' | 'dark'

/**
 * A CSS media feature override: `'no-override'` leaves the page's real value
 * untouched, any other member forces that value across every pane. Mirrors the
 * Chrome DevTools "Rendering" panel emulation choices.
 */
export type MediaOverride<T extends string> = 'no-override' | T

export type VisionDeficiency =
  | 'none'
  | 'blurredVision'
  | 'reducedContrast'
  | 'achromatopsia'
  | 'deuteranopia'
  | 'protanopia'
  | 'tritanopia'

/**
 * Emulated CSS media features applied to every pane, matching the DevTools
 * Rendering panel. `prefers-color-scheme` is intentionally excluded — it stays
 * modeled by {@link ThemePreference} so the toolbar theme toggle and this state
 * share one source of truth.
 */
export interface MediaFeatureState {
  reducedMotion: MediaOverride<'no-preference' | 'reduce'>
  reducedData: MediaOverride<'no-preference' | 'reduce'>
  reducedTransparency: MediaOverride<'no-preference' | 'reduce'>
  forcedColors: MediaOverride<'none' | 'active'>
  contrast: MediaOverride<'no-preference' | 'less' | 'more' | 'custom'>
  colorGamut: MediaOverride<'srgb' | 'p3' | 'rec2020'>
  mediaType: MediaOverride<'screen' | 'print'>
  autoDarkMode: boolean
  // Rendering overlay flags (DevTools Rendering panel checkboxes)
  paintFlashing: boolean
  layoutShiftRegions: boolean
  layerBorders: boolean
  frameRenderingStats: boolean
  scrollingPerf: boolean
  highlightAds: boolean
  disableLocalFonts: boolean
  focusedPage: boolean
  // Vision / accessibility emulation
  visionDeficiency: VisionDeficiency
  // OS text scale emulation (1 = no override)
  osTextScale: number
  // Image format disabling
  disableAvif: boolean
  disableWebp: boolean
}

export const DEFAULT_MEDIA_FEATURES: MediaFeatureState = {
  reducedMotion: 'no-override',
  reducedData: 'no-override',
  reducedTransparency: 'no-override',
  forcedColors: 'no-override',
  contrast: 'no-override',
  colorGamut: 'no-override',
  mediaType: 'no-override',
  autoDarkMode: false,
  paintFlashing: false,
  layoutShiftRegions: false,
  layerBorders: false,
  frameRenderingStats: false,
  scrollingPerf: false,
  highlightAds: false,
  disableLocalFonts: false,
  focusedPage: false,
  visionDeficiency: 'none',
  osTextScale: 1,
  disableAvif: false,
  disableWebp: false
}

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
}

export interface PaneLoadingState {
  paneId: PaneId
  loading: boolean
}

export interface PaneLoadError {
  code: number
  description: string
}

export interface PaneNavigationState {
  activePane: PaneId | null
  barUrl: string
  pageTitle: string
  faviconUrl: string | null
  canGoBack: boolean
  canGoForward: boolean
}

export interface PaneScrollReport {
  paneId: PaneId
  ratio: number
  programmatic: boolean
}
