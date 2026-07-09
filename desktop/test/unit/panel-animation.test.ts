import { describe, expect, it } from 'vitest'
import { getPanelEnterTransform, getPanelTransformOrigin } from '../../src/shared/panel-animation'

describe('panel animation helpers', () => {
  it('anchors bottom panels to the trigger edge above', () => {
    expect(getPanelTransformOrigin('bottom', 'end')).toBe('100% 0%')
    expect(getPanelEnterTransform('bottom')).toBe('scale(0.95) translateY(-4px)')
  })

  it('anchors flipped top panels to the trigger edge below', () => {
    expect(getPanelTransformOrigin('top', 'end')).toBe('100% 100%')
    expect(getPanelEnterTransform('top')).toBe('scale(0.95) translateY(4px)')
  })
})
