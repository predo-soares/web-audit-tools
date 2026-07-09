import type { PanelAlign, PanelPlacement } from './panel-types'

export const PANEL_ENTER_MS = 180
export const PANEL_EXIT_MS = 120

export function getPanelTransformOrigin(placement: PanelPlacement, align: PanelAlign): string {
  const crossAxis = align === 'start' ? '0%' : align === 'center' ? '50%' : '100%'

  switch (placement) {
    case 'bottom':
      return `${crossAxis} 0%`
    case 'top':
      return `${crossAxis} 100%`
    case 'left':
      return `100% ${crossAxis}`
    case 'right':
      return `0% ${crossAxis}`
  }
}

export function getPanelEnterTransform(placement: PanelPlacement): string {
  switch (placement) {
    case 'bottom':
      return 'scale(0.95) translateY(-4px)'
    case 'top':
      return 'scale(0.95) translateY(4px)'
    case 'left':
      return 'scale(0.95) translateX(4px)'
    case 'right':
      return 'scale(0.95) translateX(-4px)'
  }
}
