import type { PopoverAlign, PopoverAnchor, PopoverPlacement } from '../shared/popover-types'
import type { Bounds, Size } from '../shared/types'

const POPOVER_GAP = 8

const PLACEMENT_ORDER: Record<PopoverPlacement, PopoverPlacement[]> = {
  bottom: ['bottom', 'top'],
  top: ['top', 'bottom'],
  left: ['left', 'right'],
  right: ['right', 'left']
}

export function crossAxisX(anchor: PopoverAnchor, popoverWidth: number, align: PopoverAlign): number {
  switch (align) {
    case 'start':
      return anchor.x
    case 'end':
      return anchor.x + anchor.width - popoverWidth
    case 'center':
      return anchor.x + anchor.width / 2 - popoverWidth / 2
  }
}

function placeForSide(
  anchor: PopoverAnchor,
  popoverSize: Size,
  placement: PopoverPlacement,
  align: PopoverAlign
): Bounds {
  switch (placement) {
    case 'left':
      return {
        x: anchor.x - popoverSize.width - POPOVER_GAP,
        y: anchor.y + anchor.height / 2 - popoverSize.height / 2,
        width: popoverSize.width,
        height: popoverSize.height
      }
    case 'right':
      return {
        x: anchor.x + anchor.width + POPOVER_GAP,
        y: anchor.y + anchor.height / 2 - popoverSize.height / 2,
        width: popoverSize.width,
        height: popoverSize.height
      }
    case 'top':
      return {
        x: crossAxisX(anchor, popoverSize.width, align),
        y: anchor.y - popoverSize.height - POPOVER_GAP,
        width: popoverSize.width,
        height: popoverSize.height
      }
    case 'bottom':
      return {
        x: crossAxisX(anchor, popoverSize.width, align),
        y: anchor.y + anchor.height + POPOVER_GAP,
        width: popoverSize.width,
        height: popoverSize.height
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
  anchor: PopoverAnchor,
  placement: PopoverPlacement,
  align: PopoverAlign,
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

export function computePopoverBounds(
  anchor: PopoverAnchor,
  popoverSize: Size,
  preferredPlacement: PopoverPlacement,
  windowWidth: number,
  windowHeight: number,
  align: PopoverAlign = 'end'
): Bounds {
  for (const placement of PLACEMENT_ORDER[preferredPlacement]) {
    const bounds = placeForSide(anchor, popoverSize, placement, align)
    if (fitsInWindow(bounds, windowWidth, windowHeight)) {
      return clampBounds(bounds, anchor, placement, align, windowWidth, windowHeight)
    }
  }

  const fallback = placeForSide(anchor, popoverSize, preferredPlacement, align)
  return clampBounds(fallback, anchor, preferredPlacement, align, windowWidth, windowHeight)
}
