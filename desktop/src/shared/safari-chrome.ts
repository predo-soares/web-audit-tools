import type { PaneId } from './pane-types'

export const SAFARI_CHROME_COMPACT_SCROLL_Y = 40
export const SAFARI_CHROME_EXPAND_SCROLL_Y = 8

export const SAFARI_CHROME_PANE_IDS: PaneId[] = ['iphone', 'ipad', 'desktop']

export function supportsSafariChrome(paneId: PaneId): boolean {
  return SAFARI_CHROME_PANE_IDS.includes(paneId)
}

export interface SafariChromeState {
  paneId: PaneId
  url: string
  compact: boolean
  visible: boolean
}
