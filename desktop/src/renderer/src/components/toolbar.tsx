import { buttonVariants } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { usePreviewCanvas } from '@renderer/context/preview-canvas-context'
import { UrlBar } from '@renderer/components/url-bar'
import { useNativePopover } from '@renderer/hooks/use-native-popover'
import type { ThemePreference } from '../../../shared/types'
import {
  SIDEBAR_TRANSITION_MS,
  SIDEBAR_WIDTH_PX,
  TOOLBAR_HEIGHT_PX
} from '../../../shared/sidebar'
import { useSidebar, useSidebarInternals } from '@renderer/context/sidebar-context'
import { WindowControls } from '@renderer/components/window-controls'
import { Link2, Link2Off, Palette, PanelLeft, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react'
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
  canGoBack: boolean
  canGoForward: boolean
  canSaveProject: boolean
  isSavedProject: boolean
  saveSuggestedName: string
  onSaveProject: (name: string) => void
  onUrlChange: (url: string) => void
  onNavigate: (url: string) => void
  onRefresh: () => void
  onGoBack: () => void
  onGoForward: () => void
  syncEnabled: boolean
  onSyncChange: (enabled: boolean) => void
}

export function Toolbar({
  url,
  pageTitle,
  faviconUrl,
  navigating,
  canGoBack,
  canGoForward,
  canSaveProject,
  isSavedProject,
  saveSuggestedName,
  onSaveProject,
  onUrlChange,
  onNavigate,
  onRefresh,
  onGoBack,
  onGoForward,
  syncEnabled,
  onSyncChange
}: ToolbarProps): React.JSX.Element {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const zoomTriggerRef = useRef<HTMLButtonElement>(null)
  const themeTriggerRef = useRef<HTMLButtonElement>(null)
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebar()
  const { toggleButtonRef } = useSidebarInternals()
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
      className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-transparent px-4"
      style={{ height: TOOLBAR_HEIGHT_PX }}
      data-app-region="drag"
    >
      <div className="relative z-10 flex shrink-0 items-center gap-2" data-app-region="no-drag">
        <WindowControls />
        <button
          ref={toggleButtonRef}
          type="button"
          data-testid="sidebar-toggle"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'ml-1')}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={sidebarOpen}
          aria-controls="sidebar"
          aria-keyshortcuts="Meta+B"
          onClick={toggleSidebar}
        >
          <PanelLeft />
        </button>
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 flex items-center px-4"
        style={{
          left: sidebarOpen ? SIDEBAR_WIDTH_PX : 0,
          right: 0,
          transition: `left ${SIDEBAR_TRANSITION_MS}ms ease`
        }}
      >
        <div
          className="pointer-events-auto mx-auto flex w-full min-w-0 max-w-[42rem] items-center gap-1"
          data-app-region="no-drag"
        >
          <button
            type="button"
            data-testid="toolbar-back"
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
            aria-label="Back"
            aria-keyshortcuts="Meta+["
            disabled={!canGoBack || navigating}
            onClick={() => onGoBack()}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            data-testid="toolbar-forward"
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
            aria-label="Forward"
            aria-keyshortcuts="Meta+]"
            disabled={!canGoForward || navigating}
            onClick={() => onGoForward()}
          >
            <ChevronRight />
          </button>
          <UrlBar
            value={url}
            pageTitle={pageTitle}
            faviconUrl={faviconUrl}
            onChange={onUrlChange}
            onNavigate={onNavigate}
            onRefresh={onRefresh}
            disabled={navigating}
            canSaveProject={canSaveProject}
            isSavedProject={isSavedProject}
            saveSuggestedName={saveSuggestedName}
            onSaveProject={onSaveProject}
            className="min-w-0 flex-1"
          />
        </div>
      </div>
      <div
        ref={toolbarRef}
        className="relative z-10 flex shrink-0 items-center gap-2"
        data-app-region="no-drag"
      >
        <button
          ref={zoomTriggerRef}
          type="button"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
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
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
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
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
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
