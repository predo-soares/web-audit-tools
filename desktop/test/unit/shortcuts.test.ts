import { describe, expect, it } from 'vitest'
import {
  APP_SHORTCUTS,
  electronAccelerator,
  formatShortcutKeys,
  matchesAppShortcut,
  SHORTCUT_GROUPS
} from '../../src/shared/shortcuts'

describe('app shortcut catalog', () => {
  it('keeps the seven implemented shortcuts in their agreed groups', () => {
    expect(SHORTCUT_GROUPS).toEqual(['Navigation', 'Interface', 'Capture'])
    expect(APP_SHORTCUTS.map(({ id }) => id)).toEqual([
      'back',
      'forward',
      'sidebar',
      'diagnostics',
      'immersive',
      'dismiss',
      'share'
    ])
  })

  it('formats platform labels from the same definitions used for matching', () => {
    const share = APP_SHORTCUTS.find(({ id }) => id === 'share')
    expect(share).toBeDefined()
    expect(formatShortcutKeys(share!, 'mac')).toEqual(['⌘', '⇧', 'S'])
    expect(formatShortcutKeys(share!, 'other')).toEqual(['Ctrl', 'Shift', 'S'])
    expect(electronAccelerator('share')).toBe('CommandOrControl+Shift+S')
    expect(matchesAppShortcut('share', { key: 's', mod: true, shift: true })).toBe(true)
    expect(matchesAppShortcut('share', { key: 's', mod: true })).toBe(false)
  })
})
