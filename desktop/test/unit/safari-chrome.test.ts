import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { supportsSafariChrome, SAFARI_CHROME_PANE_IDS } from '../../src/shared/safari-chrome'

describe('safari-chrome', () => {
  it('covers iPhone, iPad, and desktop panes', () => {
    expect(SAFARI_CHROME_PANE_IDS).toEqual(['iphone', 'ipad', 'desktop'])
    expect(supportsSafariChrome('iphone')).toBe(true)
    expect(supportsSafariChrome('ipad')).toBe(true)
    expect(supportsSafariChrome('desktop')).toBe(true)
  })

  it('does not call setIgnoreMouseEvents on WebContentsView overlays', () => {
    const source = readFileSync(
      join(__dirname, '../../src/main/chrome/safari-chrome-manager.ts'),
      'utf8'
    )
    expect(source).not.toMatch(/setIgnoreMouseEvents/)
  })
})
