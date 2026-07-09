import { describe, expect, it } from 'vitest'
import {
  CANVAS_GAP,
  CANVAS_PADDING_X,
  CANVAS_PADDING_Y,
  computeFitZoom,
  getCanvasContentSize,
  getMockupDimensions,
  MAX_ZOOM,
  MIN_ZOOM
} from '../../src/shared/mockup-layout'
import { DEVICE_PRESETS, PANE_IDS } from '../../src/shared/device-presets'

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

describe('computeFitZoom', () => {
  it('returns the limiting axis when fitting all devices into the viewport', () => {
    const { width, height } = getCanvasContentSize()
    const viewportWidth = width + CANVAS_PADDING_X
    const viewportHeight = height * 2 + CANVAS_PADDING_Y

    expect(computeFitZoom(viewportWidth, viewportHeight)).toBeCloseTo(1, 5)
  })

  it('uses width as the limiting axis on narrow viewports', () => {
    const { width } = getCanvasContentSize()
    const viewportWidth = width / 2 + CANVAS_PADDING_X
    const viewportHeight = 4000

    expect(computeFitZoom(viewportWidth, viewportHeight)).toBeCloseTo(0.5, 5)
  })

  it('clamps to the configured zoom bounds', () => {
    expect(computeFitZoom(10_000, 10_000)).toBe(MAX_ZOOM)
    expect(computeFitZoom(1, 1)).toBe(MIN_ZOOM)
  })

  it('accounts for every device pane in the canvas width', () => {
    const { width } = getCanvasContentSize()
    const expectedWidth = PANE_IDS.reduce((sum, paneId, index) => {
      const frameWidth = getMockupDimensions(paneId).frameWidth
      const gap = index === 0 ? 0 : CANVAS_GAP
      return sum + frameWidth + gap
    }, 0)

    expect(width).toBe(expectedWidth)
  })
})
