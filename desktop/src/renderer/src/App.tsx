import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PaneId } from '../../shared/types'
import type { Project } from '../../shared/project'
import { isCommittedPageUrl, suggestProjectName } from '../../shared/project'
import { PreviewCanvas } from '@renderer/components/preview-canvas'
import { Toolbar } from '@renderer/components/toolbar'
import { SidebarProvider } from '@renderer/context/sidebar-context'
import { useProjects } from '@renderer/hooks/use-projects'

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
  const [url, setUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [committedPage, setCommittedPage] = useState<CommittedPage | null>(null)
  const { projects, addProject } = useProjects()

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
    })

    const unsubscribeLoading = window.api.onPaneLoading(({ paneId, loading }) => {
      setLoadingStates((current) => ({ ...current, [paneId]: loading }))
    })
    const unsubscribeNavigation = window.api.onPaneNavigation((state) => {
      setUrl(state.barUrl)
      setPageTitle(state.pageTitle)
      setFaviconUrl(state.faviconUrl)
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

  const handleSyncChange = useCallback(async (enabled: boolean) => {
    const next = await window.api.setSyncEnabled(enabled)
    setSyncEnabled(next)
  }, [])

  const handleSaveProject = useCallback(
    async (name: string) => {
      if (!committedPage) return
      await addProject({
        name,
        url: committedPage.url,
        faviconUrl: committedPage.faviconUrl,
        pageTitle: committedPage.pageTitle
      })
    },
    [addProject, committedPage]
  )

  const handleProjectActivate = useCallback(
    async (project: Project) => {
      if (project.url === committedPage?.url) return
      await handleNavigate(project.url)
    },
    [committedPage?.url, handleNavigate]
  )

  const saveSuggestedName = committedPage
    ? suggestProjectName(committedPage.pageTitle, committedPage.url)
    : ''

  return (
    <SidebarProvider>
      <PreviewCanvas
        loadingStates={loadingStates}
        projects={projects}
        committedUrl={committedPage?.url ?? ''}
        onProjectActivate={handleProjectActivate}
        toolbar={
          <Toolbar
            url={url}
            pageTitle={pageTitle}
            faviconUrl={faviconUrl}
            navigating={navigating}
            canSaveProject={committedPage !== null}
            saveSuggestedName={saveSuggestedName}
            onSaveProject={(name) => void handleSaveProject(name)}
            onUrlChange={setUrl}
            onNavigate={handleNavigate}
            onRefresh={handleRefresh}
            syncEnabled={syncEnabled}
            onSyncChange={handleSyncChange}
          />
        }
      />
    </SidebarProvider>
  )
}
