import type { PaneId } from './types'

export const SAFARI_CHROME_COMPACT_SCROLL_Y = 40
export const SAFARI_CHROME_EXPAND_SCROLL_Y = 8

export interface SafariChromeHeights {
  status: number
  urlExpanded: number
  urlCompact: number
  bottom: number
}

export const SAFARI_CHROME_HEIGHTS: Partial<Record<PaneId, SafariChromeHeights>> = {
  iphone: {
    status: 54,
    urlExpanded: 52,
    urlCompact: 0,
    bottom: 83
  },
  ipad: {
    status: 24,
    urlExpanded: 50,
    urlCompact: 0,
    bottom: 50
  }
}

export const SAFARI_CHROME_PANE_IDS: PaneId[] = ['iphone', 'ipad']

export function getSafariTopHeight(paneId: PaneId, compact: boolean): number {
  const heights = SAFARI_CHROME_HEIGHTS[paneId]
  if (!heights) return 0
  return heights.status + (compact ? heights.urlCompact : heights.urlExpanded)
}

export function getSafariBottomHeight(paneId: PaneId): number {
  return SAFARI_CHROME_HEIGHTS[paneId]?.bottom ?? 0
}

export function supportsSafariChrome(paneId: PaneId): boolean {
  return SAFARI_CHROME_PANE_IDS.includes(paneId)
}

export type SafariChromeStrip = 'top' | 'bottom'

export interface SafariChromeStripState {
  paneId: PaneId
  strip: SafariChromeStrip
  url: string
  compact: boolean
  visible: boolean
}
