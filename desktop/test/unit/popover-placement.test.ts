import { describe, expect, it } from 'vitest'
import { computePopoverBounds, crossAxisX } from '../../src/main/popover-placement'

describe('computePopoverBounds', () => {
  const anchor = { x: 900, y: 20, width: 28, height: 28 }

  it('aligns the popover end edge with the anchor end edge below the trigger', () => {
    const popoverSize = { width: 128, height: 200 }
    const bounds = computePopoverBounds(anchor, popoverSize, 'bottom', 1200, 800, 'end')

    expect(bounds.x).toBe(crossAxisX(anchor, popoverSize.width, 'end'))
    expect(bounds.y).toBe(56)
    expect(bounds.x + bounds.width).toBe(anchor.x + anchor.width)
  })

  it('flips to top when bottom placement overflows vertically', () => {
    const bounds = computePopoverBounds(
      { x: 900, y: 760, width: 28, height: 28 },
      { width: 128, height: 200 },
      'bottom',
      1200,
      800,
      'end'
    )

    expect(bounds.y).toBe(552)
    expect(bounds.x + bounds.width).toBe(928)
  })
})
