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
  const [url, setUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)

  useEffect(() => {
    void window.api.getScrollSyncEnabled().then(setScrollSyncEnabled)
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

  const handleScrollSyncChange = useCallback(async (enabled: boolean) => {
    const next = await window.api.setScrollSyncEnabled(enabled)
    setScrollSyncEnabled(next)
  }, [])

  return (
    <PreviewCanvas loadingStates={loadingStates}>
      <header
        className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-xl"
        data-app-region="drag"
      >
        <div className="flex shrink-0 items-center gap-2" data-app-region="no-drag">
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
        <div className="min-w-0 flex-1" data-app-region="no-drag">
          <UrlBar
            value={url}
            pageTitle={pageTitle}
            faviconUrl={faviconUrl}
            onChange={setUrl}
            onNavigate={handleNavigate}
            onRefresh={handleRefresh}
            disabled={navigating}
          />
        </div>

        <div data-app-region="no-drag">
          <Toolbar
            scrollSyncEnabled={scrollSyncEnabled}
            onScrollSyncChange={handleScrollSyncChange}
          />
        </div>
      </header>
    </PreviewCanvas>
  )
}
