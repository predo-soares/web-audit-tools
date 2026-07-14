import { describe, expect, it } from 'vitest'
import {
  getSafariBottomHeight,
  getSafariTopHeight,
  SAFARI_CHROME_HEIGHTS
} from '../../src/shared/safari-chrome'

describe('safari-chrome layout', () => {
  it('returns iPhone top height for expanded and compact states', () => {
    const heights = SAFARI_CHROME_HEIGHTS.iphone!
    expect(getSafariTopHeight('iphone', false)).toBe(heights.status + heights.urlExpanded)
    expect(getSafariTopHeight('iphone', true)).toBe(heights.status + heights.urlCompact)
    expect(getSafariBottomHeight('iphone')).toBe(heights.bottom)
  })

  it('returns iPad heights for the tablet skin', () => {
    const heights = SAFARI_CHROME_HEIGHTS.ipad!
    expect(getSafariTopHeight('ipad', false)).toBe(heights.status + heights.urlExpanded)
    expect(getSafariBottomHeight('ipad')).toBe(heights.bottom)
  })

  it('returns zero heights for panes without a skin yet', () => {
    expect(getSafariTopHeight('desktop', false)).toBe(0)
    expect(getSafariBottomHeight('desktop')).toBe(0)
  })
})
