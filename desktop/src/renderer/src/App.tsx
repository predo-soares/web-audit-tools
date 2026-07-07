import { useCallback, useEffect, useState } from 'react'
import type { PaneId } from '../../shared/types'
import { PreviewCanvas } from '@renderer/components/preview-canvas'
import { Toolbar } from '@renderer/components/toolbar'
import { UrlBar } from '@renderer/components/url-bar'

export default function App(): React.JSX.Element {
  const [loadingStates, setLoadingStates] = useState<Record<PaneId, boolean>>({
    iphone: false,
    ipad: false,
    desktop: false
  })
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true)
  const [navigating, setNavigating] = useState(false)

  useEffect(() => {
    void window.api.getScrollSyncEnabled().then(setScrollSyncEnabled)
    void window.api.getLoadingStates().then(setLoadingStates)

    return window.api.onPaneLoading(({ paneId, loading }) => {
      setLoadingStates((current) => ({ ...current, [paneId]: loading }))
    })
  }, [])

  const handleNavigate = useCallback(async (url: string) => {
    setNavigating(true)
    try {
      await window.api.navigate(url)
    } finally {
      setNavigating(false)
    }
  }, [])

  const handleScrollSyncChange = useCallback(async (enabled: boolean) => {
    const next = await window.api.setScrollSyncEnabled(enabled)
    setScrollSyncEnabled(next)
  }, [])

  return (
    <PreviewCanvas loadingStates={loadingStates}>
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <UrlBar onNavigate={handleNavigate} disabled={navigating} />
        <Toolbar
          scrollSyncEnabled={scrollSyncEnabled}
          onScrollSyncChange={handleScrollSyncChange}
        />
      </header>
    </PreviewCanvas>
  )
}
