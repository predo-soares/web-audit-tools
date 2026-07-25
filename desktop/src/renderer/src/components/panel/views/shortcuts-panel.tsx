import { useEffect, useRef } from 'react'
import {
  APP_SHORTCUTS,
  formatShortcutKeys,
  SHORTCUT_GROUPS,
  type ShortcutPlatform
} from '../../../../../shared/shortcuts'
import type { PanelAction } from '../../../../../shared/panel-types'
import { Button } from '@renderer/components/ui/button'

function currentPlatform(): ShortcutPlatform {
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? 'mac' : 'other'
}

export function ShortcutsPanel({
  onAction
}: {
  onAction: (action: PanelAction) => void
}): React.JSX.Element {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const platform = currentPlatform()

  useEffect(() => {
    const focusClose = (): void => {
      window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    }
    focusClose()
    const unsubscribeShow = window.panelApi.onShow((message) => {
      if (message.panelId === 'shortcuts') focusClose()
    })
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return
      event.preventDefault()
      closeButtonRef.current?.focus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      unsubscribeShow()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      data-testid="shortcuts-dialog"
      className="w-[min(480px,calc(100vw-32px))] overflow-hidden rounded-xl border border-white/10 bg-background text-foreground shadow-2xl"
    >
      <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <h1 id="shortcuts-title" className="text-base font-semibold tracking-tight">
            Keyboard shortcuts
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {platform === 'mac' ? '⌘ is the Command key.' : 'Ctrl replaces ⌘ on this platform.'}
          </p>
        </div>
        <Button
          ref={closeButtonRef}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close keyboard shortcuts"
          data-testid="shortcuts-close"
          onClick={() => onAction({ type: 'close-panel' })}
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </Button>
      </header>

      <div className="max-h-[min(560px,calc(100vh-120px))] overflow-y-auto px-5 py-4">
        <div className="space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group} aria-labelledby={`shortcuts-${group.toLowerCase()}`}>
              <h2
                id={`shortcuts-${group.toLowerCase()}`}
                className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {group}
              </h2>
              <ul className="divide-y divide-white/5">
                {APP_SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
                  <li
                    key={shortcut.id}
                    data-testid={`shortcut-row-${shortcut.id}`}
                    className="flex min-h-11 items-center justify-between gap-4 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm">{shortcut.label}</p>
                      {shortcut.availability ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {shortcut.availability}
                        </p>
                      ) : null}
                    </div>
                    <span className="flex shrink-0 items-center gap-1" aria-label={shortcut.label}>
                      {formatShortcutKeys(shortcut, platform).map((key, index) => (
                        <kbd
                          key={`${key}-${index}`}
                          className="flex min-w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-xs font-medium text-foreground"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}
