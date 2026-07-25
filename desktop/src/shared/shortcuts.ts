export type ShortcutPlatform = 'mac' | 'other'

export interface AppShortcut {
  id: string
  group: 'Navigation' | 'Interface' | 'Capture'
  label: string
  keys: readonly string[]
  availability?: string
}

export const APP_SHORTCUTS: readonly AppShortcut[] = [
  { id: 'back', group: 'Navigation', label: 'Back', keys: ['Mod', '['] },
  { id: 'forward', group: 'Navigation', label: 'Forward', keys: ['Mod', ']'] },
  { id: 'sidebar', group: 'Interface', label: 'Toggle sidebar', keys: ['Mod', 'B'] },
  { id: 'diagnostics', group: 'Interface', label: 'Toggle diagnostics', keys: ['Mod', 'J'] },
  {
    id: 'immersive',
    group: 'Interface',
    label: 'Toggle immersive mode',
    keys: ['Mod', 'Shift', 'H'],
    availability: 'Browser workspace only'
  },
  {
    id: 'dismiss',
    group: 'Interface',
    label: 'Close overlay or exit immersive mode',
    keys: ['Escape']
  },
  {
    id: 'share',
    group: 'Capture',
    label: 'Share with agent',
    keys: ['Mod', 'Shift', 'S'],
    availability: 'Requires an active page'
  }
]

export const SHORTCUT_GROUPS = ['Navigation', 'Interface', 'Capture'] as const

export type AppShortcutId = (typeof APP_SHORTCUTS)[number]['id']

export function matchesAppShortcut(
  id: AppShortcutId,
  input: { key: string; mod: boolean; shift?: boolean; alt?: boolean }
): boolean {
  const shortcut = APP_SHORTCUTS.find((item) => item.id === id)
  if (!shortcut) return false

  const expectedKey = shortcut.keys.at(-1)
  const expectedMod = shortcut.keys.includes('Mod')
  const expectedShift = shortcut.keys.includes('Shift')
  const expectedAlt = shortcut.keys.includes('Alt')

  return (
    input.key.toLowerCase() === expectedKey?.toLowerCase() &&
    input.mod === expectedMod &&
    Boolean(input.shift) === expectedShift &&
    Boolean(input.alt) === expectedAlt
  )
}

export function electronAccelerator(id: AppShortcutId): string {
  const shortcut = APP_SHORTCUTS.find((item) => item.id === id)
  if (!shortcut) throw new Error(`Unknown shortcut: ${id}`)

  return shortcut.keys
    .map((key) => {
      if (key === 'Mod') return 'CommandOrControl'
      if (key === 'Shift') return 'Shift'
      if (key === 'Escape') return 'Escape'
      return key
    })
    .join('+')
}

export function formatShortcutKeys(shortcut: AppShortcut, platform: ShortcutPlatform): string[] {
  return shortcut.keys.map((key) => {
    if (key === 'Mod') return platform === 'mac' ? '⌘' : 'Ctrl'
    if (key === 'Shift') return platform === 'mac' ? '⇧' : 'Shift'
    if (key === 'Escape') return 'Esc'
    return key
  })
}
