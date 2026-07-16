import type { ThemePreference } from './types'
import type { Size } from './types'
import { DIAGNOSTICS_DRAWER_WIDTH_PX, type RuntimeEvidenceChannel } from './runtime-evidence'
import type { HistoryEntry } from './history'

export type PanelId =
  | 'zoom'
  | 'theme'
  | 'sidebar-left'
  | 'diagnostics-right'
  | 'toolbar-top'
  | 'url-history'

export type PanelMode = 'anchored' | 'docked'

export type PanelEdge = 'left' | 'right' | 'top' | 'bottom'

export type PanelPlacement = 'left' | 'right' | 'top' | 'bottom'
export type PanelAlign = 'start' | 'center' | 'end'

export interface PanelAnchor {
  x: number
  y: number
  width: number
  height: number
}

export interface ZoomPanelPayload {
  zoom: number
}

export interface ThemePanelPayload {
  themePreference: ThemePreference
}

export interface DiagnosticsPanelPayload {
  initialTab: RuntimeEvidenceChannel
}

export interface UrlHistoryPanelPayload {
  items: HistoryEntry[]
  activeIndex: number
  /** Width of the anchoring URL bar, so the panel matches it instead of overflowing. */
  width?: number
}

export type PanelPayload =
  | ZoomPanelPayload
  | ThemePanelPayload
  | DiagnosticsPanelPayload
  | UrlHistoryPanelPayload

export interface PanelOpenOptions {
  panelId: PanelId
  mode: PanelMode
  anchor?: PanelAnchor
  placement?: PanelPlacement
  align?: PanelAlign
  payload?: PanelPayload
  edge?: PanelEdge
  width?: number
}

export interface PanelShowMessage {
  panelId: PanelId
  mode: PanelMode
  payload?: PanelPayload
  placement?: PanelPlacement
  align?: PanelAlign
  resolvedPlacement?: PanelPlacement
  edge?: PanelEdge
}

export type PanelAction =
  | { type: 'set-zoom'; zoom: number }
  | { type: 'fit-zoom' }
  | { type: 'set-theme'; preference: ThemePreference }
  | { type: 'navigate'; url: string }
  | { type: 'delete-history'; url: string }
  | { type: 'clear-history' }
  | {
      type: 'toggle-project'
      name: string
      url: string
      faviconUrl: string | null
      pageTitle: string
    }
  | { type: 'toggle-sidebar' }
  | { type: 'toggle-diagnostics' }
  | { type: 'go-back' }
  | { type: 'go-forward' }
  | { type: 'reload' }
  | { type: 'stop-loading' }
  | { type: 'set-sync-enabled'; enabled: boolean }
  | { type: 'enter-seo-view' }
  | { type: 'enter-lighthouse-view' }
  | { type: 'enter-devices-view' }

export const PANEL_MIN_SIZE: Record<PanelId, Size> = {
  zoom: { width: 144, height: 224 },
  theme: { width: 176, height: 120 },
  'sidebar-left': { width: 280, height: 400 },
  'diagnostics-right': { width: DIAGNOSTICS_DRAWER_WIDTH_PX, height: 400 },
  'toolbar-top': { width: 400, height: 52 },
  'url-history': { width: 400, height: 48 }
}

export const PANEL_FIXED_SIZE: Partial<Record<PanelId, Size>> = {
  zoom: { width: 144, height: 224 }
}

export const ANCHORED_POPOVER_VIEW_OWNER: PanelId = 'zoom'

export function getPanelFixedSize(panelId: PanelId): Size | null {
  return PANEL_FIXED_SIZE[panelId] ?? null
}

export const PANEL_STAGING_SIZE: Size = { width: 280, height: 400 }
