import { buttonVariants } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { UrlBar } from '@renderer/components/url-bar'
import { useOverlayPanel } from '@renderer/hooks/use-overlay-panel'
import { DIAGNOSTICS_DRAWER_WIDTH_PX } from '../../../../../shared/runtime-evidence'
import type { MediaFeatureState, ThemePreference } from '../../../../../shared/types'
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
  Camera01Icon,
  Link01Icon,
  Monitor,
  Moon01Icon,
  PanelLeftIcon,
  Sun01Icon,
  Unlink01Icon,
  SourceCodeIcon,
  ZoomInAreaIcon
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { Icon } from '@renderer/components/ui/icon'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SnapshotResult } from '../../../../../shared/snapshot'

const THEME_STORAGE_KEY = 'audit-screens-theme-preference'
const MEDIA_FEATURES_STORAGE_KEY = 'audit-screens-media-features'

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
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [diagnosticsWidth, setDiagnosticsWidth] = useState(DIAGNOSTICS_DRAWER_WIDTH_PX)
  const [problemCount, setProblemCount] = useState(0)
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
    open: diagnosticsOpen,
    edge: 'right',
    width: diagnosticsWidth,
    onOpenChange: setDiagnosticsOpen
  })

  const showProblemBadge = !diagnosticsOpen && problemCount > 0

  const anyPaneLoading = Object.values(loadingStates).some(Boolean)
  const isLoading = navigating || anyPaneLoading
  const canSaveProject = isCommittedPageUrl(savedPageSnapshot.url)
  const saveSuggestedName = canSaveProject
    ? suggestProjectName(savedPageSnapshot.pageTitle, savedPageSnapshot.url)
    : ''
  const isSavedProject = canSaveProject
    ? hasProjectForUrl(projects, savedPageSnapshot.url)
    : false

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
    void window.panelApi.getSyncEnabled().then(setSyncEnabled)
    void window.panelApi.listProjects().then(setProjects)
    void window.panelApi.getOpenPanels().then((openPanels) => {
      setSidebarOpen(openPanels.includes('sidebar-left'))
      setDiagnosticsOpen(openPanels.includes('diagnostics-right'))
    })
    void window.panelApi.getDiagnosticsWidth().then((width) => {
      setDiagnosticsWidth(width > 0 ? width : DIAGNOSTICS_DRAWER_WIDTH_PX)
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
      if (panelId === 'diagnostics-right') {
        setDiagnosticsOpen(false)
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

    return () => {
      unsubscribeNavigation()
      unsubscribeLoading()
      unsubscribeProjects()
      unsubscribeAction()
      unsubscribeTheme()
      unsubscribeClosed()
      unsubscribeSettled()
      unsubscribeFocus()
      unsubscribeDiagnosticsWidth()
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
      const parsed = JSON.parse(stored) as MediaFeatureState
      void window.panelApi.setMediaFeatures(parsed)
    } catch {
      // Ignore malformed persisted media features.
    }
  }, [])

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

  const handleToggleProject = useCallback(async (name: string) => {
    const snapshot = savedPageSnapshot
    if (!isCommittedPageUrl(snapshot.url)) return
    await window.panelApi.toggleProject({
      name,
      url: snapshot.url,
      faviconUrl: snapshot.faviconUrl,
      pageTitle: snapshot.pageTitle
    })
  }, [savedPageSnapshot])

  const toggleSidebar = useCallback((): void => {
    window.panelApi.sendAction({ type: 'toggle-sidebar' })
    setSidebarOpen((current) => !current)
  }, [])

  const toggleDiagnostics = useCallback((): void => {
    setDiagnosticsOpen((current) => !current)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isZoomOpen) {
        event.preventDefault()
        setZoomOpen(false)
        void window.panelApi.closePanel('zoom')
        return
      }

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
      } else if (event.key === 'j') {
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

  useEffect(() => {
    return window.panelApi.onSnapshotTaken(showSnapshotToast)
  }, [showSnapshotToast])

  const handleSnapshot = useCallback(async (): Promise<void> => {
    const result = await window.panelApi.takeSnapshot()
    showSnapshotToast(result)
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

  return (
    <header
      className="relative box-border flex h-full w-full items-center justify-between gap-3 bg-transparent px-4 pr-3 "
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
        <button
          ref={toggleButtonRef}
          type="button"
          data-testid="sidebar-toggle"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'ml-1')}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={sidebarOpen}
          aria-controls="sidebar"
          aria-keyshortcuts="Meta+B"
          onClick={toggleSidebar}
        >
          <Icon icon={PanelLeftIcon} size={14} />
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
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }))}
            aria-label="Back"
            aria-keyshortcuts="Meta+["
            disabled={!canGoBack || navigating}
            onClick={() => void window.panelApi.goBack()}
          >
            <Icon icon={ArrowLeft01Icon} size={14} />
          </button>
          <button
            type="button"
            data-testid="toolbar-forward"
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }))}
            aria-label="Forward"
            aria-keyshortcuts="Meta+]"
            disabled={!canGoForward || navigating}
            onClick={() => void window.panelApi.goForward()}
          >
            <Icon icon={ArrowRight01Icon} size={14} />
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
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }))}
          aria-label={`Zoom level ${zoomPercent}%`}
          data-testid="zoom-combobox-trigger"
          aria-expanded={isZoomOpen}
          onClick={toggleZoomPopover}
        >
          <Icon icon={ZoomInAreaIcon} size={14} />
        </button>
        <button
          type="button"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }))}
          data-testid="theme-toggle"
          aria-label={THEME_LABEL[themePreference]}
          onClick={toggleThemePreference}
        >
          <Icon icon={THEME_ICON[themePreference]} size={14} />
        </button>
        <button
          type="button"
          data-testid="diagnostics-toggle"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'relative')}
          aria-label={
            diagnosticsOpen
              ? 'Close diagnostics drawer'
              : problemCount > 0
                ? `Open diagnostics drawer, ${problemCount} problems`
                : 'Open diagnostics drawer'
          }
          aria-expanded={diagnosticsOpen}
          aria-controls="diagnostics-drawer"
          aria-keyshortcuts="Meta+J"
          onClick={toggleDiagnostics}
        >
          <Icon icon={SourceCodeIcon} size={14} />
          {showProblemBadge ? (
            <span
              data-testid="diagnostics-problem-badge"
              className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground tabular-nums"
            >
              {problemCount > 99 ? '99+' : problemCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          data-testid="snapshot-button"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }))}
          aria-label="Snapshot for Agent"
          aria-keyshortcuts="Meta+Shift+S"
          onClick={() => void handleSnapshot()}
        >
          <Icon icon={Camera01Icon} size={14} />
        </button>
        <button
          type="button"
          data-testid="sync-toggle"
          className={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}
          onClick={() => {
            void window.panelApi.setSyncEnabled(!syncEnabled).then(setSyncEnabled)
          }}
          aria-label={syncEnabled ? 'Disable interaction sync' : 'Enable interaction sync'}
          aria-pressed={syncEnabled}
        >
          {syncEnabled ? (
            <Icon icon={Link01Icon} size={14} />
          ) : (
            <Icon icon={Unlink01Icon} size={14} />
          )}
        </button>
      </div>
    </header>
  )
}
