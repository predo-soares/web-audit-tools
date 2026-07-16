import { describe, expect, it } from 'vitest'
import {
  buildLabSpecSnapshot,
  DEFAULT_LIGHTHOUSE_LAB_SELECTION,
  resolveLighthouseDevice,
  resolveLighthouseNetwork
} from '../../src/shared/lighthouse-lab'

describe('Lighthouse lab specs', () => {
  it('resolves PSI-like mobile defaults', () => {
    const device = resolveLighthouseDevice('mobile', DEFAULT_LIGHTHOUSE_LAB_SELECTION)
    const network = resolveLighthouseNetwork('mobile', DEFAULT_LIGHTHOUSE_LAB_SELECTION)
    expect(device.label).toBe('Moto G Power')
    expect(network.id).toBe('slow-4g')
    expect(network.throttling?.cpuSlowdownMultiplier).toBe(4)
  })

  it('resolves unthrottled desktop defaults', () => {
    const device = resolveLighthouseDevice('desktop', DEFAULT_LIGHTHOUSE_LAB_SELECTION)
    const network = resolveLighthouseNetwork('desktop', DEFAULT_LIGHTHOUSE_LAB_SELECTION)
    expect(device.screenEmulation.width).toBe(1350)
    expect(network.id).toBe('none')
    expect(network.throttling).toBeNull()
  })

  it('builds a lab snapshot for the result bar', () => {
    const snapshot = buildLabSpecSnapshot({
      profile: 'mobile',
      selection: {
        ...DEFAULT_LIGHTHOUSE_LAB_SELECTION,
        mobileDeviceId: 'pixel-7',
        mobileNetworkId: 'fast-4g'
      },
      lighthouseVersion: '13.4.0',
      browserLabel: 'Headless Chromium',
      completedAt: 100
    })
    expect(snapshot.deviceLabel).toBe('Pixel 7')
    expect(snapshot.networkLabel).toBe('Fast 4G throttling')
    expect(snapshot.cpuLabel).toBe('2× CPU slowdown')
  })
})
