import type { PanelAlign, PanelAnchor, PanelPlacement } from '../../shared/panel-types'
import type { Bounds, Size } from '../../shared/types'

const PANEL_GAP = 0

const PLACEMENT_ORDER: Record<PanelPlacement, PanelPlacement[]> = {
  bottom: ['bottom', 'top'],
  top: ['top', 'bottom'],
  left: ['left', 'right'],
  right: ['right', 'left']
}

export function crossAxisX(anchor: PanelAnchor, panelWidth: number, align: PanelAlign): number {
  switch (align) {
    case 'start':
      return anchor.x
    case 'end':
      return anchor.x + anchor.width - panelWidth
    case 'center':
      return anchor.x + anchor.width / 2 - panelWidth / 2
  }
}

function placeForSide(
  anchor: PanelAnchor,
  panelSize: Size,
  placement: PanelPlacement,
  align: PanelAlign
): Bounds {
  switch (placement) {
    case 'left':
      return {
        x: anchor.x - panelSize.width - PANEL_GAP,
        y: anchor.y + anchor.height / 2 - panelSize.height / 2,
        width: panelSize.width,
        height: panelSize.height
      }
    case 'right':
      return {
        x: anchor.x + anchor.width + PANEL_GAP,
        y: anchor.y + anchor.height / 2 - panelSize.height / 2,
        width: panelSize.width,
        height: panelSize.height
      }
    case 'top':
      return {
        x: crossAxisX(anchor, panelSize.width, align),
        y: anchor.y - panelSize.height - PANEL_GAP,
        width: panelSize.width,
        height: panelSize.height
      }
    case 'bottom':
      return {
        x: crossAxisX(anchor, panelSize.width, align),
        y: anchor.y + anchor.height + PANEL_GAP,
        width: panelSize.width,
        height: panelSize.height
      }
  }
}

function fitsInWindow(bounds: Bounds, windowWidth: number, windowHeight: number): boolean {
  return (
    bounds.x >= 0 &&
    bounds.y >= 0 &&
    bounds.x + bounds.width <= windowWidth &&
    bounds.y + bounds.height <= windowHeight
  )
}

function clampBounds(
  bounds: Bounds,
  anchor: PanelAnchor,
  placement: PanelPlacement,
  align: PanelAlign,
  windowWidth: number,
  windowHeight: number
): Bounds {
  const width = bounds.width
  const height = bounds.height
  let x = bounds.x
  let y = bounds.y

  if (placement === 'bottom' || placement === 'top') {
    x = crossAxisX(anchor, width, align)
  }

  x = Math.max(0, Math.min(x, windowWidth - width))
  y = Math.max(0, Math.min(y, windowHeight - height))

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  }
}

export interface PanelBoundsResult {
  bounds: Bounds
  placement: PanelPlacement
}

export function computePanelBounds(
  anchor: PanelAnchor,
  panelSize: Size,
  preferredPlacement: PanelPlacement,
  windowWidth: number,
  windowHeight: number,
  align: PanelAlign = 'end'
): PanelBoundsResult {
  for (const placement of PLACEMENT_ORDER[preferredPlacement]) {
    const bounds = placeForSide(anchor, panelSize, placement, align)
    if (fitsInWindow(bounds, windowWidth, windowHeight)) {
      return {
        bounds: clampBounds(bounds, anchor, placement, align, windowWidth, windowHeight),
        placement
      }
    }
  }

  const fallback = placeForSide(anchor, panelSize, preferredPlacement, align)
  return {
    bounds: clampBounds(fallback, anchor, preferredPlacement, align, windowWidth, windowHeight),
    placement: preferredPlacement
  }
}
