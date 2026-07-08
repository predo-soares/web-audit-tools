import { ThemePanel } from '@renderer/components/popover/panels/theme-panel'
import { ZoomPanel } from '@renderer/components/popover/panels/zoom-panel'
import type { PopoverPanelRegistry, PopoverPanelComponent } from '@renderer/components/popover/types'

export const POPOVER_PANEL_REGISTRY: PopoverPanelRegistry = {
  zoom: ZoomPanel as PopoverPanelComponent,
  theme: ThemePanel as PopoverPanelComponent
}
