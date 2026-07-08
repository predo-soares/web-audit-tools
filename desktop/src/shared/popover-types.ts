import type { ThemePreference } from './types'
import type { Size } from './types'

export type PopoverPanelId = 'zoom' | 'theme'
export type PopoverPlacement = 'left' | 'right' | 'top' | 'bottom'
export type PopoverAlign = 'start' | 'center' | 'end'

export interface PopoverAnchor {
  x: number
  y: number
  width: number
  height: number
}

export interface ZoomPopoverPayload {
  zoom: number
}

export interface ThemePopoverPayload {
  themePreference: ThemePreference
}

export type PopoverPayload = ZoomPopoverPayload | ThemePopoverPayload

export interface PopoverOpenOptions {
  panelId: PopoverPanelId
  anchor: PopoverAnchor
  placement?: PopoverPlacement
  align?: PopoverAlign
  payload: PopoverPayload
}

export interface PopoverShowMessage {
  panelId: PopoverPanelId
  payload: PopoverPayload
}

export type PopoverAction =
  | { type: 'set-zoom'; zoom: number }
  | { type: 'set-theme'; preference: ThemePreference }

export const POPOVER_PANEL_MIN_SIZE: Record<PopoverPanelId, Size> = {
  zoom: { width: 144, height: 200 },
  theme: { width: 176, height: 120 }
}

export const POPOVER_STAGING_SIZE: Size = { width: 280, height: 400 }
