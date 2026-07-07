import { useCallback, useEffect, useState } from 'react'
import type { PaneId } from '../../shared/types'
import { PreviewCanvas } from '@renderer/components/preview-canvas'
import { Toolbar } from '@renderer/components/toolbar'

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

  return (
    <PreviewCanvas loadingStates={loadingStates}>
      <Toolbar
        url={url}
        pageTitle={pageTitle}
        faviconUrl={faviconUrl}
        navigating={navigating}
        onUrlChange={setUrl}
        onNavigate={handleNavigate}
        onRefresh={handleRefresh}
        syncEnabled={syncEnabled}
        onSyncChange={handleSyncChange}
      />
    </PreviewCanvas>
  )
}
