import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PaneId } from '../../shared/types'
import type { Project } from '../../shared/project'
import { hasProjectForUrl, isCommittedPageUrl, suggestProjectName } from '../../shared/project'
import { PreviewCanvas } from '@renderer/components/preview-canvas'
import { Toolbar } from '@renderer/components/toolbar'
import { SidebarProvider } from '@renderer/context/sidebar-context'
import { useProjects } from '@renderer/hooks/use-projects'
import { useHistory } from '@renderer/hooks/use-history'
import type { HistoryEntry } from '../../shared/history'

interface CommittedPage {
  url: string
  pageTitle: string
  faviconUrl: string | null
}

export default function App(): React.JSX.Element {
  const [loadingStates, setLoadingStates] = useState<Record<PaneId, boolean>>({
    iphone: false,
    ipad: false,
    desktop: false
  })
  const [syncEnabled, setSyncEnabled] = useState(true)
  const [navigating, setNavigating] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [url, setUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [committedPage, setCommittedPage] = useState<CommittedPage | null>(null)
  const { projects, toggleProject } = useProjects()
  const { history, deleteHistoryEntry, clearHistory } = useHistory()

  const anyPaneLoading = useMemo(
    () => Object.values(loadingStates).some(Boolean),
    [loadingStates]
  )

  useEffect(() => {
    void window.api.getSyncEnabled().then(setSyncEnabled)
    void window.api.getLoadingStates().then(setLoadingStates)
    void window.api.getNavigationState().then((state) => {
      setUrl(state.barUrl)
      setPageTitle(state.pageTitle)
      setFaviconUrl(state.faviconUrl)
      setCanGoBack(state.canGoBack)
      setCanGoForward(state.canGoForward)
    })

    const unsubscribeLoading = window.api.onPaneLoading(({ paneId, loading }) => {
      setLoadingStates((current) => ({ ...current, [paneId]: loading }))
    })
    const unsubscribeNavigation = window.api.onPaneNavigation((state) => {
      setUrl(state.barUrl)
      setPageTitle(state.pageTitle)
      setFaviconUrl(state.faviconUrl)
      setCanGoBack(state.canGoBack)
      setCanGoForward(state.canGoForward)
    })

    return () => {
      unsubscribeLoading()
      unsubscribeNavigation()
    }
  }, [])

  useEffect(() => {
    if (anyPaneLoading || navigating) return
    if (!isCommittedPageUrl(url)) return

    setCommittedPage({
      url,
      pageTitle,
      faviconUrl
    })
  }, [anyPaneLoading, navigating, url, pageTitle, faviconUrl])

  const handleNavigate = useCallback(async (nextUrl: string) => {
    setNavigating(true)
    try {
      const normalized = await window.api.navigate(nextUrl)
      setUrl(normalized)
    } finally {
      setNavigating(false)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setNavigating(true)
    try {
      await window.api.reload()
    } finally {
      setNavigating(false)
    }
  }, [])

  const handleGoBack = useCallback(async () => {
    await window.api.goBack()
  }, [])

  const handleGoForward = useCallback(async () => {
    await window.api.goForward()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.metaKey && !event.ctrlKey) return

      if (event.key === '[') {
        event.preventDefault()
        void handleGoBack()
      } else if (event.key === ']') {
        event.preventDefault()
        void handleGoForward()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleGoBack, handleGoForward])

  const handleSyncChange = useCallback(async (enabled: boolean) => {
    const next = await window.api.setSyncEnabled(enabled)
    setSyncEnabled(next)
  }, [])

  const handleToggleProject = useCallback(
    async (name: string) => {
      if (!committedPage) return
      await toggleProject({
        name,
        url: committedPage.url,
        faviconUrl: committedPage.faviconUrl,
        pageTitle: committedPage.pageTitle
      })
    },
    [committedPage, toggleProject]
  )

  const handleProjectActivate = useCallback(
    async (project: Project) => {
      if (project.url === committedPage?.url) return
      await handleNavigate(project.url)
    },
    [committedPage?.url, handleNavigate]
  )

  const handleHistoryActivate = useCallback(
    async (entry: HistoryEntry) => {
      if (entry.url === committedPage?.url) return
      await handleNavigate(entry.url)
    },
    [committedPage?.url, handleNavigate]
  )

  const handleHistoryDelete = useCallback(
    async (entry: HistoryEntry) => {
      await deleteHistoryEntry(entry.url)
    },
    [deleteHistoryEntry]
  )

  const handleHistoryClear = useCallback(async () => {
    await clearHistory()
  }, [clearHistory])

  const saveSuggestedName = committedPage
    ? suggestProjectName(committedPage.pageTitle, committedPage.url)
    : ''
  const isSavedProject = committedPage ? hasProjectForUrl(projects, committedPage.url) : false

  return (
    <SidebarProvider>
      <PreviewCanvas
        loadingStates={loadingStates}
        navigating={navigating}
        projects={projects}
        history={history}
        committedUrl={committedPage?.url ?? ''}
        onProjectActivate={handleProjectActivate}
        onHistoryActivate={handleHistoryActivate}
        onHistoryDelete={handleHistoryDelete}
        onHistoryClear={handleHistoryClear}
        toolbar={
          <Toolbar
            url={url}
            pageTitle={pageTitle}
            faviconUrl={faviconUrl}
            navigating={navigating}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            canSaveProject={committedPage !== null}
            isSavedProject={isSavedProject}
            saveSuggestedName={saveSuggestedName}
            onSaveProject={(name) => void handleToggleProject(name)}
            onUrlChange={setUrl}
            onNavigate={handleNavigate}
            onRefresh={handleRefresh}
            onGoBack={() => void handleGoBack()}
            onGoForward={() => void handleGoForward()}
            syncEnabled={syncEnabled}
            onSyncChange={handleSyncChange}
          />
        }
      />
    </SidebarProvider>
  )
}
