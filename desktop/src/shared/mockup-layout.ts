import { DEVICE_PRESETS } from './device-presets'
import type { PaneId } from './types'

export const DEFAULT_ZOOM = 0.75
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 1.5
export const ZOOM_STEP = 0.05
export const CANVAS_GAP = 32

interface MockupChrome {
  bezelX: number
  bezelTop: number
  bezelBottom: number
  headerHeight: number
}

const MOCKUP_CHROME: Record<PaneId, MockupChrome> = {
  iphone: { bezelX: 10, bezelTop: 10, bezelBottom: 10, headerHeight: 0 },
  ipad: { bezelX: 12, bezelTop: 12, bezelBottom: 12, headerHeight: 0 },
  desktop: { bezelX: 8, bezelTop: 8, bezelBottom: 8, headerHeight: 28 }
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

export function getMockupDimensions(paneId: PaneId): MockupDimensions {
  const profile = DEVICE_PRESETS[paneId]
  const chrome = MOCKUP_CHROME[paneId]

  return {
    frameWidth: profile.width + chrome.bezelX * 2,
    frameHeight: chrome.bezelTop + chrome.headerHeight + profile.height + chrome.bezelBottom,
    screenWidth: profile.width,
    screenHeight: profile.height,
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

export function getCanvasSize(): { width: number; height: number } {
  const panes = (['iphone', 'ipad', 'desktop'] as PaneId[]).map((paneId) => getMockupDimensions(paneId))
  const width =
    panes.reduce((total, pane) => total + pane.frameWidth, 0) + CANVAS_GAP * (panes.length - 1)
  const height = Math.max(...panes.map((pane) => pane.frameHeight))
  return { width, height: height + 40 }
}
