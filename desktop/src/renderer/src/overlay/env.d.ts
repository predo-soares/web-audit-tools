import type { PanelOverlayApi } from '../../preload/panel-preload'

declare global {
  interface Window {
    panelApi: PanelOverlayApi
  }
}

export {}
