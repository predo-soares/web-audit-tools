import { describe, expect, it } from 'vitest'
import { getMockupDimensions } from '../../src/shared/mockup-layout'
import { DEVICE_PRESETS } from '../../src/shared/device-presets'

describe('getMockupDimensions', () => {
  it('includes desktop toolbar spacing in the frame height', () => {
    const dimensions = getMockupDimensions('desktop')
    const profile = DEVICE_PRESETS.desktop

    expect(dimensions.screenHeight).toBe(profile.height - 4)
    expect(dimensions.frameHeight).toBe(
      dimensions.chrome.bezelTop +
        dimensions.chrome.headerHeight +
        dimensions.chrome.headerGap +
        dimensions.screenHeight +
        dimensions.chrome.bezelBottom
    )
  })
})
