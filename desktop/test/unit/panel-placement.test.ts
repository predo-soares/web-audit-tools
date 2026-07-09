import { describe, expect, it } from 'vitest'
import { computePanelBounds, crossAxisX } from '../../src/main/panel-placement'

describe('computePanelBounds', () => {
  const anchor = { x: 900, y: 20, width: 28, height: 28 }

  it('aligns the panel end edge with the anchor end edge below the trigger', () => {
    const panelSize = { width: 128, height: 200 }
    const { bounds } = computePanelBounds(anchor, panelSize, 'bottom', 1200, 800, 'end')

    expect(bounds.x).toBe(crossAxisX(anchor, panelSize.width, 'end'))
    expect(bounds.y).toBe(56)
    expect(bounds.x + bounds.width).toBe(anchor.x + anchor.width)
  })

  it('flips to top when bottom placement overflows vertically', () => {
    const { bounds, placement } = computePanelBounds(
      { x: 900, y: 760, width: 28, height: 28 },
      { width: 128, height: 200 },
      'bottom',
      1200,
      800,
      'end'
    )

    expect(placement).toBe('top')
    expect(bounds.y).toBe(552)
    expect(bounds.x + bounds.width).toBe(928)
  })
})
