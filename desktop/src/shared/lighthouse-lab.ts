import type { LighthouseProfile } from './lighthouse'

export type LighthouseNetworkId = 'slow-4g' | 'fast-4g' | 'cable' | 'none'
export type LighthouseMobileDeviceId = 'moto-g-power' | 'pixel-7' | 'iphone-14'
export type LighthouseDesktopDeviceId = 'desktop-1350' | 'desktop-1920'

export interface LighthouseThrottling {
  rttMs: number
  throughputKbps: number
  requestLatencyMs: number
  downloadThroughputKbps: number
  uploadThroughputKbps: number
  cpuSlowdownMultiplier: number
}

export interface LighthouseScreenEmulation {
  mobile: boolean
  width: number
  height: number
  deviceScaleFactor: number
  disabled: boolean
}

export interface LighthouseDevicePreset {
  id: string
  profile: LighthouseProfile
  label: string
  screenEmulation: LighthouseScreenEmulation
}

export interface LighthouseNetworkPreset {
  id: LighthouseNetworkId
  label: string
  shortLabel: string
  throttling: LighthouseThrottling | null
  throttlingMethod: 'simulate' | 'provided'
}

export interface LighthouseLabSpecSnapshot {
  deviceId: string
  deviceLabel: string
  networkId: LighthouseNetworkId
  networkLabel: string
  cpuLabel: string
  formFactor: LighthouseProfile
  screen: LighthouseScreenEmulation
  browserLabel: string
  lighthouseVersion: string
  completedAt: number
}

export interface LighthouseLabSelection {
  mobileDeviceId: LighthouseMobileDeviceId
  desktopDeviceId: LighthouseDesktopDeviceId
  mobileNetworkId: LighthouseNetworkId
  desktopNetworkId: LighthouseNetworkId
}

export const DEFAULT_LIGHTHOUSE_LAB_SELECTION: LighthouseLabSelection = {
  mobileDeviceId: 'moto-g-power',
  desktopDeviceId: 'desktop-1350',
  mobileNetworkId: 'slow-4g',
  desktopNetworkId: 'none'
}

export const LIGHTHOUSE_MOBILE_DEVICES: LighthouseDevicePreset[] = [
  {
    id: 'moto-g-power',
    profile: 'mobile',
    label: 'Moto G Power',
    screenEmulation: {
      mobile: true,
      width: 412,
      height: 823,
      deviceScaleFactor: 1.75,
      disabled: false
    }
  },
  {
    id: 'pixel-7',
    profile: 'mobile',
    label: 'Pixel 7',
    screenEmulation: {
      mobile: true,
      width: 412,
      height: 915,
      deviceScaleFactor: 2.625,
      disabled: false
    }
  },
  {
    id: 'iphone-14',
    profile: 'mobile',
    label: 'iPhone 14',
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      disabled: false
    }
  }
]

export const LIGHTHOUSE_DESKTOP_DEVICES: LighthouseDevicePreset[] = [
  {
    id: 'desktop-1350',
    profile: 'desktop',
    label: 'Desktop 1350×940',
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false
    }
  },
  {
    id: 'desktop-1920',
    profile: 'desktop',
    label: 'Desktop 1920×1080',
    screenEmulation: {
      mobile: false,
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      disabled: false
    }
  }
]

export const LIGHTHOUSE_NETWORK_PRESETS: LighthouseNetworkPreset[] = [
  {
    id: 'slow-4g',
    label: 'Slow 4G throttling',
    shortLabel: 'Slow 4G',
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      requestLatencyMs: 562.5,
      downloadThroughputKbps: 1638.4,
      uploadThroughputKbps: 675,
      cpuSlowdownMultiplier: 4
    }
  },
  {
    id: 'fast-4g',
    label: 'Fast 4G throttling',
    shortLabel: 'Fast 4G',
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 40,
      // ~9 Mbps down-ish for simulated fast mobile
      throughputKbps: 9000,
      requestLatencyMs: 150,
      downloadThroughputKbps: 9000,
      uploadThroughputKbps: 3000,
      cpuSlowdownMultiplier: 2
    }
  },
  {
    id: 'cable',
    label: 'Cable throttling',
    shortLabel: 'Cable',
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      requestLatencyMs: 0,
      downloadThroughputKbps: 10240,
      uploadThroughputKbps: 10240,
      cpuSlowdownMultiplier: 1
    }
  },
  {
    id: 'none',
    label: 'No network throttling',
    shortLabel: 'No throttling',
    throttlingMethod: 'provided',
    throttling: null
  }
]

const MOBILE_BY_ID = Object.fromEntries(
  LIGHTHOUSE_MOBILE_DEVICES.map((device) => [device.id, device])
) as Record<LighthouseMobileDeviceId, LighthouseDevicePreset>

const DESKTOP_BY_ID = Object.fromEntries(
  LIGHTHOUSE_DESKTOP_DEVICES.map((device) => [device.id, device])
) as Record<LighthouseDesktopDeviceId, LighthouseDevicePreset>

const NETWORK_BY_ID = Object.fromEntries(
  LIGHTHOUSE_NETWORK_PRESETS.map((network) => [network.id, network])
) as Record<LighthouseNetworkId, LighthouseNetworkPreset>

export function resolveLighthouseDevice(
  profile: LighthouseProfile,
  selection: LighthouseLabSelection
): LighthouseDevicePreset {
  if (profile === 'mobile') {
    return MOBILE_BY_ID[selection.mobileDeviceId] ?? MOBILE_BY_ID['moto-g-power']
  }
  return DESKTOP_BY_ID[selection.desktopDeviceId] ?? DESKTOP_BY_ID['desktop-1350']
}

export function resolveLighthouseNetwork(
  profile: LighthouseProfile,
  selection: LighthouseLabSelection
): LighthouseNetworkPreset {
  const id = profile === 'mobile' ? selection.mobileNetworkId : selection.desktopNetworkId
  return NETWORK_BY_ID[id] ?? NETWORK_BY_ID[profile === 'mobile' ? 'slow-4g' : 'none']
}

export function buildLabSpecSnapshot(input: {
  profile: LighthouseProfile
  selection: LighthouseLabSelection
  lighthouseVersion: string
  browserLabel: string
  completedAt: number
}): LighthouseLabSpecSnapshot {
  const device = resolveLighthouseDevice(input.profile, input.selection)
  const network = resolveLighthouseNetwork(input.profile, input.selection)
  const cpu = network.throttling?.cpuSlowdownMultiplier ?? 1
  return {
    deviceId: device.id,
    deviceLabel: device.label,
    networkId: network.id,
    networkLabel: network.label,
    cpuLabel: cpu === 1 ? 'No CPU throttling' : `${cpu}× CPU slowdown`,
    formFactor: input.profile,
    screen: device.screenEmulation,
    browserLabel: input.browserLabel,
    lighthouseVersion: input.lighthouseVersion,
    completedAt: input.completedAt
  }
}
