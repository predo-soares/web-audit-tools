import type { DeviceProfile, PaneId } from './types'

export const PANE_IDS: PaneId[] = ['iphone', 'ipad', 'desktop']

export const DEVICE_PRESETS: Record<PaneId, DeviceProfile> = {
  iphone: {
    id: 'iphone',
    name: 'iPhone 16 Pro',
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    touch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  },
  ipad: {
    id: 'ipad',
    name: 'iPad Pro 11"',
    width: 834,
    height: 1210,
    deviceScaleFactor: 2,
    touch: true,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  },
  desktop: {
    id: 'desktop',
    name: 'Desktop',
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
    touch: false,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  }
}
