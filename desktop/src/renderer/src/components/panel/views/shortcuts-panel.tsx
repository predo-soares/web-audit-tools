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
      className="flex max-h-[min(640px,calc(100vh-96px))] w-[min(520px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/4 bg-background text-popover-foreground shadow-2xl ring-1 ring-black/40 duration-150 animate-in fade-in-0 zoom-in-95"
    >
      <header className="flex items-start justify-between gap-4 border-b border-white/4 bg-linear-to-b from-white/1 to-transparent px-4 py-4">
        <div className="min-w-0">
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
          className="-mr-1.5 -mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Close keyboard shortcuts"
          data-testid="shortcuts-close"
          onClick={() => onAction({ type: 'close-panel' })}
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pt-5 pb-1">
        <div className="space-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group} aria-labelledby={`shortcuts-${group.toLowerCase()}`}>
              <h2
                id={`shortcuts-${group.toLowerCase()}`}
                className="mb-1 text-[11px] px-3 font-medium uppercase tracking-wider text-muted-foreground"
              >
                {group}
              </h2>
              <ul className="">
                {APP_SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
                  <li
                    key={shortcut.id}
                    data-testid={`shortcut-row-${shortcut.id}`}
                    className="flex min-h-11 items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]"
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
                          className="flex min-w-6 h-6.5 items-center justify-center rounded-md border border-white/10 border-b-white/2 bg-linear-to-b from-white/8 to-white/2 px-1.5 py-1 text-sm font-medium text-foreground shadow-sm"
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
