import { buttonVariants } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { UrlBar } from '@renderer/components/url-bar'
import { useOverlayPanel } from '@renderer/hooks/use-overlay-panel'
import type { ThemePreference } from '../../../../../shared/types'
import { TOOLBAR_HEIGHT_PX } from '../../../../../shared/sidebar'
import {
  hasProjectForUrl,
  isCommittedPageUrl,
  suggestProjectName
} from '../../../../../shared/project'
import type { Project } from '../../../../../shared/project'
import type { PaneId } from '../../../../../shared/types'
import { WindowControls } from '@renderer/components/window-controls'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Link01Icon,
  Monitor,
  Moon01Icon,
  PanelLeftIcon,
  Sun01Icon,
  Unlink01Icon,
  ZoomInAreaIcon
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { Icon } from '@renderer/components/ui/icon'
import { useCallback, useEffect, useRef, useState } from 'react'

const THEME_STORAGE_KEY = 'audit-screens-theme-preference'

const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark']

const THEME_ICON: Record<ThemePreference, IconSvgElement> = {
  system: Monitor,
  light: Sun01Icon,
  dark: Moon01Icon
}

const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme'
}

function readStoredThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }

  return 'system'
}

function nextThemePreference(current: ThemePreference): ThemePreference {
  const index = THEME_CYCLE.indexOf(current)
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length]
}

export function ToolbarPanel(): React.JSX.Element {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const zoomTriggerRef = useRef<HTMLButtonElement>(null)
  const toggleButtonRef = useRef<HTMLButtonElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [url, setUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [navigating, setNavigating] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [loadingStates, setLoadingStates] = useState<Record<PaneId, boolean>>({
    iphone: false,
    ipad: false,
    desktop: false
  })
  const [syncEnabled, setSyncEnabled] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [committedUrl, setCommittedUrl] = useState('')
  const [zoom, setZoom] = useState(1)
  const [themePreference, setThemePreference] = useState<ThemePreference>(readStoredThemePreference)
  const [zoomOpen, setZoomOpen] = useState(false)

  const { isOpen: isZoomOpen } = useOverlayPanel(
    'zoom',
    {
      mode: 'anchored',
      open: zoomOpen,
      anchorEl: zoomTriggerRef,
      placement: 'bottom',
      align: 'end',
      payload: { zoom },
      onOpenChange: setZoomOpen
    },
    toolbarRef
  )
  const zoomPercent = Math.round(zoom * 100)

  const anyPaneLoading = Object.values(loadingStates).some(Boolean)
  const isLoading = navigating || anyPaneLoading
  const canSaveProject = isCommittedPageUrl(committedUrl) && !navigating && !anyPaneLoading
  const saveSuggestedName = canSaveProject ? suggestProjectName(pageTitle, committedUrl) : ''
  const isSavedProject = canSaveProject ? hasProjectForUrl(projects, committedUrl) : false

  useEffect(() => {
    void window.panelApi.getNavigationState().then((state) => {
      setUrl(state.barUrl)
      setPageTitle(state.pageTitle)
      setFaviconUrl(state.faviconUrl)
      setCanGoBack(state.canGoBack)
      setCanGoForward(state.canGoForward)
      if (isCommittedPageUrl(state.barUrl)) {
        setCommittedUrl(state.barUrl)
      }
    })
    void window.panelApi.getLoadingStates().then(setLoadingStates)
    void window.panelApi.getSyncEnabled().then(setSyncEnabled)
    void window.panelApi.listProjects().then(setProjects)
    void window.panelApi.getOpenPanels().then((openPanels) => {
      setSidebarOpen(openPanels.includes('sidebar-left'))
    })

    const unsubscribeNavigation = window.panelApi.onPaneNavigation((state) => {
      setUrl(state.barUrl)
      setPageTitle(state.pageTitle)
      setFaviconUrl(state.faviconUrl)
      setCanGoBack(state.canGoBack)
      setCanGoForward(state.canGoForward)
      if (isCommittedPageUrl(state.barUrl)) {
        setCommittedUrl(state.barUrl)
      }
    })
    const unsubscribeLoading = window.panelApi.onPaneLoading(({ paneId, loading }) => {
      setLoadingStates((current) => ({ ...current, [paneId]: loading }))
    })
    const unsubscribeProjects = window.panelApi.onProjectsChanged(setProjects)
    const unsubscribeAction = window.panelApi.onPanelAction((action) => {
      if (action.type === 'set-zoom') {
        setZoom(action.zoom)
      }
    })
    const unsubscribeTheme = window.panelApi.onPanelThemeChanged((preference) => {
      setThemePreference(preference)
    })
    const unsubscribeClosed = window.panelApi.onPanelClosed((panelId) => {
      if (panelId === 'sidebar-left') {
        setSidebarOpen(false)
      }
    })
    const unsubscribeSettled = window.panelApi.onPanelLayoutSettled((panelId) => {
      if (panelId === 'sidebar-left') {
        setSidebarOpen(true)
      }
    })
    const unsubscribeFocus = window.panelApi.onFocusSidebarToggle(() => {
      toggleButtonRef.current?.focus()
    })

    return () => {
      unsubscribeNavigation()
      unsubscribeLoading()
      unsubscribeProjects()
      unsubscribeAction()
      unsubscribeTheme()
      unsubscribeClosed()
      unsubscribeSettled()
      unsubscribeFocus()
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
    void window.panelApi.setPaneThemePreference(themePreference)
  }, [themePreference])

  const handleNavigate = useCallback(async (nextUrl: string) => {
    setNavigating(true)
    try {
      const normalized = await window.panelApi.navigate(nextUrl)
      setUrl(normalized)
    } finally {
      setNavigating(false)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setNavigating(true)
    try {
      await window.panelApi.reload()
    } finally {
      setNavigating(false)
    }
  }, [])

  const handleStop = useCallback(() => {
    setNavigating(false)
    void window.panelApi.stopLoading()
  }, [])

  const handleToggleProject = useCallback(
    async (name: string) => {
      if (!canSaveProject) return
      await window.panelApi.toggleProject({
        name,
        url: committedUrl,
        faviconUrl,
        pageTitle
      })
    },
    [canSaveProject, committedUrl, faviconUrl, pageTitle]
  )

  const toggleSidebar = useCallback((): void => {
    window.panelApi.sendAction({ type: 'toggle-sidebar' })
    setSidebarOpen((current) => !current)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.metaKey && !event.ctrlKey) return

      if (event.key === '[') {
        event.preventDefault()
        void window.panelApi.goBack()
      } else if (event.key === ']') {
        event.preventDefault()
        void window.panelApi.goForward()
      } else if (event.key === 'b') {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  const toggleZoomPopover = (): void => {
    if (isZoomOpen) {
      setZoomOpen(false)
      return
    }

    setZoomOpen(true)
  }

  const toggleThemePreference = (): void => {
    setThemePreference((current) => nextThemePreference(current))
  }

  return (
    <header
      className="box-border flex h-full w-full items-center justify-between gap-3 bg-transparent px-4 pr-3 "
      style={{ height: TOOLBAR_HEIGHT_PX }}
      data-app-region="drag"
      data-testid="toolbar"
    >
      <div className="relative z-10 flex shrink-0 items-center gap-2" data-app-region="no-drag">
        <WindowControls usePanelApi />
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
          <Icon icon={PanelLeftIcon} />
        </button>
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 flex items-center px-4"
        style={{
          left: 0,
          right: 0
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
            onClick={() => void window.panelApi.goBack()}
          >
            <Icon icon={ArrowLeft01Icon} />
          </button>
          <button
            type="button"
            data-testid="toolbar-forward"
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
            aria-label="Forward"
            aria-keyshortcuts="Meta+]"
            disabled={!canGoForward || navigating}
            onClick={() => void window.panelApi.goForward()}
          >
            <Icon icon={ArrowRight01Icon} />
          </button>
          <UrlBar
            value={url}
            pageTitle={pageTitle}
            faviconUrl={faviconUrl}
            onChange={setUrl}
            onNavigate={(nextUrl) => void handleNavigate(nextUrl)}
            onRefresh={() => void handleRefresh()}
            onStop={handleStop}
            loading={isLoading}
            disabled={navigating}
            canSaveProject={canSaveProject}
            isSavedProject={isSavedProject}
            saveSuggestedName={saveSuggestedName}
            onSaveProject={(name) => void handleToggleProject(name)}
            className="min-w-0 flex-1"
          />
        </div>
      </div>
      <div
        ref={toolbarRef}
        className="relative z-10 flex shrink-0 items-center gap-1"
        data-app-region="no-drag"
      >
        <button
          ref={zoomTriggerRef}
          type="button"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
          aria-label={`Zoom level ${zoomPercent}%`}
          data-testid="zoom-combobox-trigger"
          aria-expanded={isZoomOpen}
          onClick={toggleZoomPopover}
        >
          <Icon icon={ZoomInAreaIcon} />
        </button>
        <button
          type="button"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
          data-testid="theme-toggle"
          aria-label={THEME_LABEL[themePreference]}
          onClick={toggleThemePreference}
        >
          <Icon icon={THEME_ICON[themePreference]} />
        </button>
        <button
          type="button"
          data-testid="sync-toggle"
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          onClick={() => {
            void window.panelApi.setSyncEnabled(!syncEnabled).then(setSyncEnabled)
          }}
          aria-label={syncEnabled ? 'Disable interaction sync' : 'Enable interaction sync'}
          aria-pressed={syncEnabled}
        >
          {syncEnabled ? <Icon icon={Link01Icon} /> : <Icon icon={Unlink01Icon} />}
        </button>
      </div>
    </header>
  )
}
