import { Button, buttonVariants } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { usePreviewCanvas } from '@renderer/context/preview-canvas-context'
import type { Alignment } from '@renderer/context/preview-canvas-context'
import { clampZoom } from '../../../shared/mockup-layout'
import type { ThemePreference } from '../../../shared/types'
import { AlignCenter, AlignLeft, AlignRight, Check, Link2, Link2Off, Monitor, Moon, Palette, Sun, ZoomIn } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const ALIGNMENT_OPTIONS: Array<{ value: Alignment; icon: typeof AlignLeft; label: string }> = [
  { value: 'left', icon: AlignLeft, label: 'Align left' },
  { value: 'center', icon: AlignCenter, label: 'Align center' },
  { value: 'right', icon: AlignRight, label: 'Align right' }
]

type ToolbarPanel = 'zoom' | 'theme' | null

const THEME_STORAGE_KEY = 'audit-screens-theme-preference'
const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Monitor }> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon }
]
const ZOOM_OPTIONS = ['50%', '75%', '100%', '125%', '150%', '175%', '200%']

function readStoredThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }

  return 'system'
}

interface ToolbarProps {
  syncEnabled: boolean
  onSyncChange: (enabled: boolean) => void
}

export function Toolbar({
  syncEnabled,
  onSyncChange
}: ToolbarProps): React.JSX.Element {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const { zoom, alignment, setZoom, setAlignment } = usePreviewCanvas()
  const [openPanel, setOpenPanel] = useState<ToolbarPanel>(null)
  const [themePreference, setThemePreference] = useState<ThemePreference>(readStoredThemePreference)
  const zoomPercent = Math.round(zoom * 100)
  const zoomValue = `${zoomPercent}%`

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
    void window.api.setPaneThemePreference(themePreference)
  }, [themePreference])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setOpenPanel(null)
      }
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpenPanel(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div ref={toolbarRef} className="relative flex items-center gap-2">
      {openPanel ? (
        <div
          className="absolute top-1/2 right-full z-50 mr-2 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          data-testid="toolbar-custom-popover"
        >
          {openPanel === 'zoom' ? (
            <div className="flex items-center gap-1">
              <span className="px-1.5 text-xs font-medium text-muted-foreground">Zoom</span>
              {ZOOM_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    buttonVariants({
                      variant: option === zoomValue ? 'secondary' : 'ghost',
                      size: 'xs'
                    }),
                    'min-w-10'
                  )}
                  onClick={() => {
                    setZoom(clampZoom(Number.parseInt(option, 10) / 100))
                    setOpenPanel(null)
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="px-1.5 text-xs font-medium text-muted-foreground">Theme</span>
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon
                const selected = option.value === themePreference

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      buttonVariants({ variant: selected ? 'secondary' : 'ghost', size: 'xs' }),
                      'min-w-20 justify-start'
                    )}
                    onClick={() => {
                      setThemePreference(option.value)
                      setOpenPanel(null)
                    }}
                  >
                    <Icon />
                    {option.label}
                    {selected ? <Check /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Zoom level ${zoomPercent}%`}
        data-testid="zoom-combobox-trigger"
        aria-expanded={openPanel === 'zoom'}
        onClick={() => setOpenPanel((current) => (current === 'zoom' ? null : 'zoom'))}
      >
        <ZoomIn />
      </Button>
      <div className="flex items-center gap-0.5" role="group" aria-label="Layout alignment">
        {ALIGNMENT_OPTIONS.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            type="button"
            className={cn(
              buttonVariants({ variant: alignment === value ? 'default' : 'outline', size: 'icon-sm' })
            )}
            onClick={() => setAlignment(value)}
            aria-label={label}
            aria-pressed={alignment === value}
          >
            <Icon />
          </button>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        data-testid="theme-preferences-trigger"
        aria-label="Theme preferences"
        aria-expanded={openPanel === 'theme'}
        onClick={() => setOpenPanel((current) => (current === 'theme' ? null : 'theme'))}
      >
        <Palette />
        <span className="sr-only">Theme preferences</span>
      </Button>
      <button
        type="button"
        data-testid="sync-toggle"
        className={buttonVariants({ variant: syncEnabled ? 'default' : 'outline', size: 'icon-sm' })}
        onClick={() => onSyncChange(!syncEnabled)}
        aria-label={syncEnabled ? 'Disable interaction sync' : 'Enable interaction sync'}
        aria-pressed={syncEnabled}
      >
        {syncEnabled ? <Link2 /> : <Link2Off />}
      </button>
    </div>
  )
}
