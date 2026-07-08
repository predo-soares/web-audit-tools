import { buttonVariants } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { usePreviewCanvas } from '@renderer/context/preview-canvas-context'
import { UrlBar } from '@renderer/components/url-bar'
import { useNativePopover } from '@renderer/hooks/use-native-popover'
import type { ThemePreference } from '../../../shared/types'
import { Link2, Link2Off, Palette, ZoomIn } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const THEME_STORAGE_KEY = 'audit-screens-theme-preference'

function readStoredThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }

  return 'system'
}

interface ToolbarProps {
  url: string
  pageTitle: string
  faviconUrl: string | null
  navigating: boolean
  onUrlChange: (url: string) => void
  onNavigate: (url: string) => void
  onRefresh: () => void
  syncEnabled: boolean
  onSyncChange: (enabled: boolean) => void
}

export function Toolbar({
  url,
  pageTitle,
  faviconUrl,
  navigating,
  onUrlChange,
  onNavigate,
  onRefresh,
  syncEnabled,
  onSyncChange
}: ToolbarProps): React.JSX.Element {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const zoomTriggerRef = useRef<HTMLButtonElement>(null)
  const themeTriggerRef = useRef<HTMLButtonElement>(null)
  const { zoom, setZoom } = usePreviewCanvas()
  const { open, close, openPanelId } = useNativePopover(toolbarRef)
  const [themePreference, setThemePreference] = useState<ThemePreference>(readStoredThemePreference)
  const zoomPercent = Math.round(zoom * 100)

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
    void window.api.setPaneThemePreference(themePreference)
  }, [themePreference])

  useEffect(() => {
    const unsubscribeAction = window.api.onPopoverAction((action) => {
      if (action.type === 'set-zoom') {
        setZoom(action.zoom)
      }
    })
    const unsubscribeTheme = window.api.onPopoverThemeChanged((preference) => {
      setThemePreference(preference)
    })
    return () => {
      unsubscribeAction()
      unsubscribeTheme()
    }
  }, [setZoom])

  const toggleZoomPopover = (): void => {
    const trigger = zoomTriggerRef.current
    if (!trigger) return

    if (openPanelId === 'zoom') {
      void close()
      return
    }

    void open({
      panelId: 'zoom',
      anchorEl: trigger,
      placement: 'bottom',
      align: 'end',
      payload: { zoom }
    })
  }

  const toggleThemePopover = (): void => {
    const trigger = themeTriggerRef.current
    if (!trigger) return

    if (openPanelId === 'theme') {
      void close()
      return
    }

    void open({
      panelId: 'theme',
      anchorEl: trigger,
      placement: 'bottom',
      align: 'end',
      payload: { themePreference }
    })
  }

  return (
    <header
      className="grid shrink-0 grid-cols-[1fr_minmax(0,42rem)_1fr] items-center gap-3 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-xl"
      data-app-region="drag"
    >
      <div className="flex shrink-0 items-center gap-2 justify-self-start" data-app-region="no-drag">
        <button
          type="button"
          className="size-3 rounded-full bg-[#ff5f57] transition hover:brightness-110 active:brightness-90"
          aria-label="Close window"
          onClick={() => void window.api.closeWindow()}
        />
        <button
          type="button"
          className="size-3 rounded-full bg-[#ffbd2e] transition hover:brightness-110 active:brightness-90"
          aria-label="Minimize window"
          onClick={() => void window.api.minimizeWindow()}
        />
        <button
          type="button"
          className="size-3 rounded-full bg-[#28c840] transition hover:brightness-110 active:brightness-90"
          aria-label="Toggle fullscreen"
          onClick={() => void window.api.toggleMaximizeWindow()}
        />
      </div>
      <div className="min-w-0" data-app-region="no-drag">
        <UrlBar
          value={url}
          pageTitle={pageTitle}
          faviconUrl={faviconUrl}
          onChange={onUrlChange}
          onNavigate={onNavigate}
          onRefresh={onRefresh}
          disabled={navigating}
        />
      </div>
      <div
        ref={toolbarRef}
        className="relative flex items-center gap-2 justify-self-end"
        data-app-region="no-drag"
      >
        <button
          ref={zoomTriggerRef}
          type="button"
          className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }))}
          aria-label={`Zoom level ${zoomPercent}%`}
          data-testid="zoom-combobox-trigger"
          aria-expanded={openPanelId === 'zoom'}
          onClick={toggleZoomPopover}
        >
          <ZoomIn />
        </button>
        <button
          ref={themeTriggerRef}
          type="button"
          className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }))}
          data-testid="theme-preferences-trigger"
          aria-label="Theme preferences"
          aria-expanded={openPanelId === 'theme'}
          onClick={toggleThemePopover}
        >
          <Palette />
          <span className="sr-only">Theme preferences</span>
        </button>
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
    </header>
  )
}
