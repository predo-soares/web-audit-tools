import { describe, expect, it } from 'vitest'
import { supportsSafariChrome, SAFARI_CHROME_PANE_IDS } from '../../src/shared/safari-chrome'

describe('safari-chrome', () => {
  it('covers iPhone, iPad, and desktop panes', () => {
    expect(SAFARI_CHROME_PANE_IDS).toEqual(['iphone', 'ipad', 'desktop'])
    expect(supportsSafariChrome('iphone')).toBe(true)
    expect(supportsSafariChrome('ipad')).toBe(true)
    expect(supportsSafariChrome('desktop')).toBe(true)
  })
})
