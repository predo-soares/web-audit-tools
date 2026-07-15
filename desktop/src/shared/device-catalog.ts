import type { PaneId } from './types'

export interface CatalogEntry {
  presetId: string
  paneId: PaneId
  category: 'mobile' | 'tablet' | 'desktop'
  name: string
  width: number
  height: number
  deviceScaleFactor: number
  touch: boolean
  userAgent: string
}

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const TABLET_UA =
  'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const DEVICE_CATALOG: CatalogEntry[] = [
  // Mobile
  { presetId: 'iphone-se', paneId: 'iphone', category: 'mobile', name: 'iPhone SE', width: 375, height: 667, deviceScaleFactor: 2, touch: true, userAgent: MOBILE_UA },
  { presetId: 'iphone-16', paneId: 'iphone', category: 'mobile', name: 'iPhone 16', width: 390, height: 844, deviceScaleFactor: 3, touch: true, userAgent: MOBILE_UA },
  { presetId: 'iphone-16-pro', paneId: 'iphone', category: 'mobile', name: 'iPhone 16 Pro', width: 393, height: 852, deviceScaleFactor: 3, touch: true, userAgent: MOBILE_UA },
  { presetId: 'iphone-16-pro-max', paneId: 'iphone', category: 'mobile', name: 'iPhone 16 Pro Max', width: 430, height: 932, deviceScaleFactor: 3, touch: true, userAgent: MOBILE_UA },

  // Tablet
  { presetId: 'ipad-mini', paneId: 'ipad', category: 'tablet', name: 'iPad mini', width: 744, height: 1133, deviceScaleFactor: 2, touch: true, userAgent: TABLET_UA },
  { presetId: 'ipad-air-11', paneId: 'ipad', category: 'tablet', name: 'iPad Air 11"', width: 820, height: 1180, deviceScaleFactor: 2, touch: true, userAgent: TABLET_UA },
  { presetId: 'ipad-pro-11', paneId: 'ipad', category: 'tablet', name: 'iPad Pro 11"', width: 834, height: 1210, deviceScaleFactor: 2, touch: true, userAgent: TABLET_UA },
  { presetId: 'ipad-pro-13', paneId: 'ipad', category: 'tablet', name: 'iPad Pro 13"', width: 1032, height: 1376, deviceScaleFactor: 2, touch: true, userAgent: TABLET_UA },

  // Desktop
  { presetId: 'laptop-13', paneId: 'desktop', category: 'desktop', name: 'Laptop 13"', width: 1280, height: 832, deviceScaleFactor: 2, touch: false, userAgent: DESKTOP_UA },
  { presetId: 'desktop-1440', paneId: 'desktop', category: 'desktop', name: 'Desktop 1440', width: 1440, height: 900, deviceScaleFactor: 2, touch: false, userAgent: DESKTOP_UA },
  { presetId: 'desktop-fhd', paneId: 'desktop', category: 'desktop', name: 'Desktop FHD', width: 1920, height: 1080, deviceScaleFactor: 1, touch: false, userAgent: DESKTOP_UA },
  { presetId: 'desktop-qhd', paneId: 'desktop', category: 'desktop', name: 'Desktop QHD', width: 2560, height: 1440, deviceScaleFactor: 1, touch: false, userAgent: DESKTOP_UA },
]

export const CATALOG_BY_PRESET: Record<string, CatalogEntry> = Object.fromEntries(
  DEVICE_CATALOG.map((e) => [e.presetId, e])
)

export const DEFAULT_PRESET_IDS: Record<PaneId, string> = {
  iphone: 'iphone-16-pro',
  ipad: 'ipad-pro-11',
  desktop: 'desktop-1440',
}
