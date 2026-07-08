import type { PopoverOverlayApi } from '../../preload/popover-preload'

declare global {
  interface Window {
    popoverApi: PopoverOverlayApi
  }
}

export {}
