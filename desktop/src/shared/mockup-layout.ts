import { DEVICE_PRESETS, PANE_IDS } from './device-presets'
import type { DeviceProfile, PaneId } from './types'

export const DEFAULT_ZOOM = 0.75
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 1.5
export const ZOOM_STEP = 0.05
export const CANVAS_GAP = 32
export const CANVAS_PADDING_X = 64
export const CANVAS_PADDING_Y = 48

interface MockupChrome {
  bezelX: number
  bezelTop: number
  bezelBottom: number
  headerHeight: number
  headerGap: number
  screenHeightReduction: number
}

const MOCKUP_CHROME: Record<PaneId, MockupChrome> = {
  iphone: {
    bezelX: 10,
    bezelTop: 10,
    bezelBottom: 10,
    headerHeight: 0,
    headerGap: 0,
    screenHeightReduction: 0
  },
  ipad: {
    bezelX: 12,
    bezelTop: 12,
    bezelBottom: 12,
    headerHeight: 0,
    headerGap: 0,
    screenHeightReduction: 0
  },
  desktop: {
    bezelX: 8,
    bezelTop: 8,
    bezelBottom: 8,
    headerHeight: 28,
    headerGap: 8,
    screenHeightReduction: 4
  }
}

export const SCREEN_CORNER_RADIUS: Record<PaneId, number> = {
  iphone: 36,
  ipad: 12,
  desktop: 6
}

export interface MockupDimensions {
  frameWidth: number
  frameHeight: number
  screenWidth: number
  screenHeight: number
  chrome: MockupChrome
  screenCornerRadius: number
}

export function getMockupDimensions(
  paneId: PaneId,
  profileOverride?: Pick<DeviceProfile, 'width' | 'height'>
): MockupDimensions {
  const profile = profileOverride ?? DEVICE_PRESETS[paneId]
  const chrome = MOCKUP_CHROME[paneId]
  const screenHeight = profile.height - chrome.screenHeightReduction

  return {
    frameWidth: profile.width + chrome.bezelX * 2,
    frameHeight:
      chrome.bezelTop + chrome.headerHeight + chrome.headerGap + screenHeight + chrome.bezelBottom,
    screenWidth: profile.width,
    screenHeight,
    chrome,
    screenCornerRadius: SCREEN_CORNER_RADIUS[paneId]
  }
}

export function scaleDimension(value: number, zoom: number): number {
  return value * zoom
}

export function getScaledScreenCornerRadius(paneId: PaneId, zoom: number): number {
  return scaleDimension(SCREEN_CORNER_RADIUS[paneId], zoom)
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function getCanvasContentSize(): { width: number; height: number } {
  const dimensions = PANE_IDS.map((paneId) => getMockupDimensions(paneId))
  const width =
    dimensions.reduce((sum, dimension) => sum + dimension.frameWidth, 0) +
    CANVAS_GAP * (PANE_IDS.length - 1)
  const height = Math.max(...dimensions.map((dimension) => dimension.frameHeight))

  return { width, height }
}

export function computeFitZoom(viewportWidth: number, viewportHeight: number): number {
  const { width, height } = getCanvasContentSize()
  const zoomX = (viewportWidth - CANVAS_PADDING_X) / width
  const zoomY = (viewportHeight - CANVAS_PADDING_Y) / height

  return clampZoom(Math.min(zoomX, zoomY))
}
