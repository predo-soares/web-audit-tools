import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { UrlBar } from '@renderer/components/url-bar'
import { useOverlayPanel } from '@renderer/hooks/use-overlay-panel'
import { DIAGNOSTICS_DRAWER_WIDTH_PX } from '../../../../../shared/runtime-evidence'
import type { MediaFeatureState, ThemePreference } from '../../../../../shared/types'
import { normalizeMediaFeatures } from '../../../../../shared/media-features'
import {
  SIDEBAR_TRANSITION_MS,
  SIDEBAR_WIDTH_PX,
  TOOLBAR_HEIGHT_PX,
  type WorkspaceView
} from '../../../../../shared/sidebar'
import {
  hasProjectForUrl,
  isCommittedPageUrl,
  suggestProjectName
} from '../../../../../shared/project'
import type { Project } from '../../../../../shared/project'
import type { PaneId } from '../../../../../shared/types'
import { WindowControls } from '@renderer/components/window-controls'
import {
  Monitor,
  Moon01Icon,
  PanelLeftIcon,
  Sun01Icon,
  SourceCodeIcon,
  ZoomInAreaIcon
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/lib/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SnapshotResult } from '../../../../../shared/snapshot'
import type { HistoryEntry } from '../../../../../shared/history'
import { matchesAppShortcut } from '../../../../../shared/shortcuts'

const THEME_STORAGE_KEY = 'audit-screens-theme-preference'
const MEDIA_FEATURES_STORAGE_KEY = 'audit-screens-media-features'
const URL_HISTORY_MAX_SUGGESTIONS = 8

function filterHistory(history: HistoryEntry[], query: string): HistoryEntry[] {
  if (!query.trim()) return history.slice(0, URL_HISTORY_MAX_SUGGESTIONS)
  const lower = query.toLowerCase()
  return history
    .filter((e) => e.url.toLowerCase().includes(lower) || e.title.toLowerCase().includes(lower))
    .slice(0, URL_HISTORY_MAX_SUGGESTIONS)
}

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

const SNAPSHOT_TOAST_DURATION_MS = 3500

function snapshotToastMessage(result: SnapshotResult): string {
  if (!result.ok) return result.reason === 'no-url' ? 'Nothing to capture' : 'Snapshot failed'
  if (result.warningCount > 0) return `Snapshot copied with ${result.warningCount} pane warning(s)`
  return 'Snapshot copied for agent'
}

export function ToolbarPanel(): React.JSX.Element {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const zoomTriggerRef = useRef<HTMLButtonElement>(null)
  const toggleButtonRef = useRef<HTMLButtonElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('browser')
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
  const [projects, setProjects] = useState<Project[]>([])
  const [committedUrl, setCommittedUrl] = useState('')
  const [zoom, setZoom] = useState(1)
  const [themePreference, setThemePreference] = useState<ThemePreference>(readStoredThemePreference)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [diagnosticsWidth, setDiagnosticsWidth] = useState(DIAGNOSTICS_DRAWER_WIDTH_PX)
  const [problemCount, setProblemCount] = useState(0)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [urlInputFocused, setUrlInputFocused] = useState(false)
  const [activeHistoryIndex, setActiveHistoryIndex] = useState(-1)
  const [urlBarWidth, setUrlBarWidth] = useState(0)
  const urlBarRef = useRef<HTMLFormElement>(null)
  const [snapshotToast, setSnapshotToast] = useState<string | null>(null)
  const snapshotToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const committedSnapshotRef = useRef({
    url: '',
    pageTitle: '',
    faviconUrl: null as string | null
  })
  const [savedPageSnapshot, setSavedPageSnapshot] = useState({
    url: '',
    pageTitle: '',
    faviconUrl: null as string | null
  })
  const isBrowserView = workspaceView === 'browser'
  const diagnosticsVisible = diagnosticsOpen && isBrowserView

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

  useOverlayPanel('diagnostics-right', {
    mode: 'docked',
    open: diagnosticsVisible,
    edge: 'right',
    width: diagnosticsWidth,
    immediateClose: !isBrowserView,
    onOpenChange: (open) => {
      if (!open && !isBrowserView) return
      setDiagnosticsOpen(open)
    }
  })

  useEffect(() => {
    const el = urlBarRef.current
    if (!el) return
    const measure = (): void => setUrlBarWidth(el.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const filteredHistory = useMemo(() => filterHistory(history, url), [history, url])

  const urlHistoryPayload = useMemo(
    () => ({ items: filteredHistory, activeIndex: activeHistoryIndex, width: urlBarWidth }),
    [filteredHistory, activeHistoryIndex, urlBarWidth]
  )

  const urlHistoryOpen = urlInputFocused && filteredHistory.length > 0

  useOverlayPanel(
    'url-history',
    {
      mode: 'anchored',
      open: urlHistoryOpen,
      anchorEl: urlBarRef,
      placement: 'bottom',
      align: 'start',
      payload: urlHistoryPayload,
      onOpenChange: (open) => {
        if (!open) setUrlInputFocused(false)
      }
    },
    urlBarRef
  )

  const showProblemBadge = !diagnosticsVisible && problemCount > 0

  const anyPaneLoading = Object.values(loadingStates).some(Boolean)
  const isLoading = navigating || anyPaneLoading
  const canSaveProject = isCommittedPageUrl(savedPageSnapshot.url)
  const saveSuggestedName = canSaveProject
    ? suggestProjectName(savedPageSnapshot.pageTitle, savedPageSnapshot.url)
    : ''
  const isSavedProject = canSaveProject ? hasProjectForUrl(projects, savedPageSnapshot.url) : false

  useEffect(() => {
    if (!isCommittedPageUrl(committedUrl) || navigating || anyPaneLoading) return
    const nextSnapshot = {
      url: committedUrl,
      pageTitle,
      faviconUrl
    }
    committedSnapshotRef.current = nextSnapshot
    setSavedPageSnapshot(nextSnapshot)
  }, [anyPaneLoading, committedUrl, faviconUrl, navigating, pageTitle])

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
    void window.panelApi.listProjects().then(setProjects)
    void window.panelApi.listHistory().then(setHistory)
    void window.panelApi.getOpenPanels().then((openPanels) => {
      setSidebarOpen(openPanels.includes('sidebar-left'))
      setDiagnosticsOpen(openPanels.includes('diagnostics-right'))
    })
    void window.panelApi.getDiagnosticsWidth().then((width) => {
      setDiagnosticsWidth(width > 0 ? width : DIAGNOSTICS_DRAWER_WIDTH_PX)
    })
    void window.panelApi.getWorkspaceView().then(setWorkspaceView)

    const unsubscribeNavigation = window.panelApi.onPaneNavigation((state) => {
      setUrl(state.barUrl)
      setPageTitle(state.pageTitle)
      setFaviconUrl(state.faviconUrl)
      setCanGoBack(state.canGoBack)
      setCanGoForward(state.canGoForward)
      setUrlInputFocused(false)
      setActiveHistoryIndex(-1)
      if (isCommittedPageUrl(state.barUrl)) {
        setCommittedUrl(state.barUrl)
      }
    })
    const unsubscribeHistory = window.panelApi.onHistoryUpdated(setHistory)
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
    const unsubscribeDiagnosticsWidth =
      window.panelApi.onDiagnosticsWidthChanged(setDiagnosticsWidth)
    const unsubscribeWorkspace = window.panelApi.onWorkspaceViewChanged(setWorkspaceView)

    return () => {
      unsubscribeNavigation()
      unsubscribeHistory()
      unsubscribeLoading()
      unsubscribeProjects()
      unsubscribeAction()
      unsubscribeTheme()
      unsubscribeClosed()
      unsubscribeSettled()
      unsubscribeFocus()
      unsubscribeDiagnosticsWidth()
      unsubscribeWorkspace()
    }
  }, [])

  const zoomPercent = Math.round(zoom * 100)

  useEffect(() => {
    void window.panelApi
      .getRuntimeEvidence()
      .then((snapshot) => setProblemCount(snapshot.problemCount))

    const unsubscribeEvidence = window.panelApi.onRuntimeEvidenceProblemCount((payload) =>
      setProblemCount(payload.problemCount)
    )
    return unsubscribeEvidence
  }, [])

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
    void window.panelApi.setPaneThemePreference(themePreference)
  }, [themePreference])

  // Re-apply persisted media-feature overrides at launch. The toolbar is the
  // always-mounted panel, so it owns startup restore; the Rendering tab (only
  // mounted when the drawer is open) is the editor.
  useEffect(() => {
    const stored = window.localStorage.getItem(MEDIA_FEATURES_STORAGE_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as Partial<MediaFeatureState>
      void window.panelApi.setMediaFeatures(normalizeMediaFeatures(parsed))
    } catch {
      // Ignore malformed persisted media features.
    }
  }, [])

  const handleNavigate = useCallback(async (nextUrl: string) => {
    setUrlInputFocused(false)
    setActiveHistoryIndex(-1)
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
      const snapshot = savedPageSnapshot
      if (!isCommittedPageUrl(snapshot.url)) return
      await window.panelApi.toggleProject({
        name,
        url: snapshot.url,
        faviconUrl: snapshot.faviconUrl,
        pageTitle: snapshot.pageTitle
      })
    },
    [savedPageSnapshot]
  )

  const toggleSidebar = useCallback((): void => {
    window.panelApi.sendAction({ type: 'toggle-sidebar' })
    setSidebarOpen((current) => !current)
  }, [])

  const toggleDiagnostics = useCallback((): void => {
    if (!isBrowserView) return
    setDiagnosticsOpen((current) => !current)
  }, [isBrowserView])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isZoomOpen) {
        event.preventDefault()
        setZoomOpen(false)
        void window.panelApi.closePanel('zoom')
        return
      }

      const input = {
        key: event.key,
        mod: event.metaKey || event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey
      }

      if (matchesAppShortcut('back', input)) {
        event.preventDefault()
        void window.panelApi.goBack()
      } else if (matchesAppShortcut('forward', input)) {
        event.preventDefault()
        void window.panelApi.goForward()
      } else if (matchesAppShortcut('sidebar', input)) {
        event.preventDefault()
        toggleSidebar()
      } else if (matchesAppShortcut('diagnostics', input)) {
        event.preventDefault()
        toggleDiagnostics()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar, toggleDiagnostics, isZoomOpen])

  useEffect(() => {
    const unsubscribeToggleDiagnostics = window.panelApi.onToggleDiagnostics(() => {
      toggleDiagnostics()
    })
    return unsubscribeToggleDiagnostics
  }, [toggleDiagnostics])

  const showSnapshotToast = useCallback((result: SnapshotResult): void => {
    if (snapshotToastTimerRef.current) clearTimeout(snapshotToastTimerRef.current)
    setSnapshotToast(snapshotToastMessage(result))
    snapshotToastTimerRef.current = setTimeout(
      () => setSnapshotToast(null),
      SNAPSHOT_TOAST_DURATION_MS
    )
  }, [])

  // The global Cmd+Shift+S shortcut (registered in the main process) captures the
  // active pane and notifies us to surface the toast.
  useEffect(() => {
    return window.panelApi.onSnapshotTaken(showSnapshotToast)
  }, [showSnapshotToast])

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

  // The URL bar and page-scoped controls (zoom, theme, diagnostics) only apply to
  // the device canvas; full-screen views (SEO, Lighthouse, Devices, Settings)
  // replace it, so hide that chrome there.
  return (
    <header
      className="relative box-border flex h-full w-full items-center justify-between gap-3 bg-transparent px-3"
      style={{ height: TOOLBAR_HEIGHT_PX }}
      data-app-region="drag"
      data-testid="toolbar"
    >
      {snapshotToast !== null && (
        <div
          data-testid="snapshot-toast"
          className="pointer-events-none absolute bottom-1 left-1/2 z-50 -translate-x-1/2 rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md"
        >
          {snapshotToast}
        </div>
      )}
      <div className="relative z-10 flex shrink-0 items-center gap-2" data-app-region="no-drag">
        <WindowControls usePanelApi />
        <Button
          ref={toggleButtonRef}
          type="button"
          variant="ghost"
          size="icon-xs"
          data-testid="sidebar-toggle"
          className="ml-1"
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={sidebarOpen}
          aria-controls="sidebar"
          aria-keyshortcuts="Meta+B"
          onClick={toggleSidebar}
        >
          <Icon icon={PanelLeftIcon} size={14} />
        </Button>
      </div>
      <div
        data-testid="toolbar-url-layout"
        className="flex min-w-0 flex-1 items-center justify-center px-2 transition-[padding-left,padding-right] ease-out"
        style={{
          paddingLeft: sidebarOpen ? SIDEBAR_WIDTH_PX : undefined,
          paddingRight: diagnosticsVisible ? diagnosticsWidth : undefined,
          transitionDuration: `${SIDEBAR_TRANSITION_MS}ms`
        }}
      >
        <div
          className={cn(
            'pointer-events-auto flex w-full min-w-0 max-w-[42rem] items-center gap-1',
            !isBrowserView && 'hidden'
          )}
          data-app-region="no-drag"
        >
          <UrlBar
            containerRef={urlBarRef}
            value={url}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={() => void window.panelApi.goBack()}
            onForward={() => void window.panelApi.goForward()}
            pageTitle={pageTitle}
            faviconUrl={faviconUrl}
            onChange={(next) => {
              setUrl(next)
              setActiveHistoryIndex(-1)
            }}
            onNavigate={(nextUrl) => void handleNavigate(nextUrl)}
            onRefresh={() => void handleRefresh()}
            onStop={handleStop}
            onFocusInput={() => setUrlInputFocused(true)}
            onBlurInput={() => {
              setTimeout(() => setUrlInputFocused(false), 150)
            }}
            onKeyDownInput={(event) => {
              if (!urlHistoryOpen) return
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveHistoryIndex((i) => Math.min(i + 1, filteredHistory.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveHistoryIndex((i) => Math.max(i - 1, -1))
              } else if (event.key === 'Escape') {
                event.preventDefault()
                setUrlInputFocused(false)
                setActiveHistoryIndex(-1)
              } else if (event.key === 'Enter' && activeHistoryIndex >= 0) {
                const selected = filteredHistory[activeHistoryIndex]
                if (selected) {
                  event.preventDefault()
                  void handleNavigate(selected.url)
                }
              } else if (event.key === 'Tab' && activeHistoryIndex >= 0) {
                const selected = filteredHistory[activeHistoryIndex]
                if (selected) {
                  event.preventDefault()
                  setUrl(selected.url)
                  setActiveHistoryIndex(-1)
                }
              }
            }}
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
        className={cn('relative z-10 flex shrink-0 items-center gap-1', !isBrowserView && 'hidden')}
        data-app-region="no-drag"
      >
        <Button
          ref={zoomTriggerRef}
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Zoom level ${zoomPercent}%`}
          data-testid="zoom-combobox-trigger"
          aria-expanded={isZoomOpen}
          onClick={toggleZoomPopover}
        >
          <Icon icon={ZoomInAreaIcon} size={14} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-testid="theme-toggle"
          aria-label={THEME_LABEL[themePreference]}
          onClick={toggleThemePreference}
        >
          <Icon icon={THEME_ICON[themePreference]} size={14} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-testid="diagnostics-toggle"
          className="relative"
          aria-label={
            diagnosticsVisible
              ? 'Close diagnostics drawer'
              : problemCount > 0
                ? `Open diagnostics drawer, ${problemCount} problems`
                : 'Open diagnostics drawer'
          }
          aria-expanded={diagnosticsVisible}
          aria-controls="diagnostics-drawer"
          aria-keyshortcuts="Meta+J"
          onClick={toggleDiagnostics}
        >
          <Icon icon={SourceCodeIcon} size={14} />
          {showProblemBadge ? (
            <Badge
              data-testid="diagnostics-problem-badge"
              className="absolute -right-0.5 -top-0.5 h-auto min-h-4 min-w-4 rounded-full bg-destructive px-1 py-0 text-[10px] font-medium leading-none text-destructive-foreground tabular-nums"
            >
              {problemCount > 99 ? '99+' : problemCount}
            </Badge>
          ) : null}
        </Button>
      </div>
    </header>
  )
}
