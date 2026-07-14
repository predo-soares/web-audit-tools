import { useEffect, useState } from 'react'
import type { PaneId, PaneLoadError } from '../../shared/types'
import { isCommittedPageUrl } from '../../shared/project'
import { PreviewCanvas } from '@renderer/components/preview-canvas'
import { ToolbarProvider } from '@renderer/context/toolbar-context'
import { DiagnosticsProvider } from '@renderer/context/diagnostics-context'
import { SidebarProvider } from '@renderer/context/sidebar-context'

export default function App(): React.JSX.Element {
  const [loadingStates, setLoadingStates] = useState<Record<PaneId, boolean>>({
    iphone: false,
    ipad: false,
    desktop: false
  })
  const [errorStates, setErrorStates] = useState<Record<PaneId, PaneLoadError | null>>({
    iphone: null,
    ipad: null,
    desktop: null
  })
  const [activePane, setActivePane] = useState<PaneId | null>(null)
  const [committedUrl, setCommittedUrl] = useState('')
  const [safariChromeEnabled, setSafariChromeEnabled] = useState(false)

  useEffect(() => {
    void window.api.getLoadingStates().then(setLoadingStates)
    void window.api.getSafariChromeEnabled().then(setSafariChromeEnabled)
    void window.api.getNavigationState().then((state) => {
      setActivePane(state.activePane)
      if (isCommittedPageUrl(state.barUrl)) {
        setCommittedUrl(state.barUrl)
      }
    })

    const unsubscribeLoading = window.api.onPaneLoading(({ paneId, loading }) => {
      setLoadingStates((current) => ({ ...current, [paneId]: loading }))
    })
    const unsubscribeLoadError = window.api.onPaneLoadError(({ paneId, error }) => {
      setErrorStates((current) => ({ ...current, [paneId]: error }))
    })
    const unsubscribeNavigation = window.api.onPaneNavigation((state) => {
      setActivePane(state.activePane)
      if (isCommittedPageUrl(state.barUrl)) {
        setCommittedUrl(state.barUrl)
      }
    })
    const unsubscribeSafariChrome = window.api.onSafariChromeEnabledChanged(setSafariChromeEnabled)

    return () => {
      unsubscribeLoading()
      unsubscribeLoadError()
      unsubscribeNavigation()
      unsubscribeSafariChrome()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        void window.api.closePanel('zoom')
      }

      if (!event.metaKey && !event.ctrlKey) return

      if (event.key === '[') {
        event.preventDefault()
        void window.api.goBack()
      } else if (event.key === ']') {
        event.preventDefault()
        void window.api.goForward()
      } else if (event.key === 'j') {
        event.preventDefault()
        window.api.toggleDiagnosticsDrawer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <SidebarProvider>
      <DiagnosticsProvider>
        <ToolbarProvider>
          <PreviewCanvas
            loadingStates={loadingStates}
            errorStates={errorStates}
            committedUrl={committedUrl}
            activePane={activePane}
            safariChromeEnabled={safariChromeEnabled}
          />
        </ToolbarProvider>
      </DiagnosticsProvider>
    </SidebarProvider>
  )
}
