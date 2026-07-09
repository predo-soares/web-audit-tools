import { ZoomPanel } from '@renderer/components/panel/views/zoom-panel'
import { SidebarPanel } from '@renderer/components/panel/views/sidebar-panel'
import { ToolbarPanel } from '@renderer/components/panel/views/toolbar-panel'
import type { PanelViewComponent, PanelViewRegistry } from '@renderer/components/panel/types'

export const PANEL_VIEW_REGISTRY: PanelViewRegistry = {
  zoom: ZoomPanel as PanelViewComponent,
  'sidebar-left': SidebarPanel as PanelViewComponent,
  'toolbar-top': ToolbarPanel as PanelViewComponent
}
