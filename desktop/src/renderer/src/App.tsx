import { useEffect, useState } from 'react'
import type { PaneId } from '../../shared/types'
import { isCommittedPageUrl } from '../../shared/project'
import { PreviewCanvas } from '@renderer/components/preview-canvas'
import { ToolbarProvider } from '@renderer/context/toolbar-context'
import { SidebarProvider } from '@renderer/context/sidebar-context'

export default function App(): React.JSX.Element {
  const [loadingStates, setLoadingStates] = useState<Record<PaneId, boolean>>({
    iphone: false,
    ipad: false,
    desktop: false
  })
  const [activePane, setActivePane] = useState<PaneId | null>(null)
  const [committedUrl, setCommittedUrl] = useState('')

  useEffect(() => {
    void window.api.getLoadingStates().then(setLoadingStates)
    void window.api.getNavigationState().then((state) => {
      setActivePane(state.activePane)
      if (isCommittedPageUrl(state.barUrl)) {
        setCommittedUrl(state.barUrl)
      }
    })

    const unsubscribeLoading = window.api.onPaneLoading(({ paneId, loading }) => {
      setLoadingStates((current) => ({ ...current, [paneId]: loading }))
    })
    const unsubscribeNavigation = window.api.onPaneNavigation((state) => {
      setActivePane(state.activePane)
      if (isCommittedPageUrl(state.barUrl)) {
        setCommittedUrl(state.barUrl)
      }
    })

    return () => {
      unsubscribeLoading()
      unsubscribeNavigation()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.metaKey && !event.ctrlKey) return

      if (event.key === '[') {
        event.preventDefault()
        void window.api.goBack()
      } else if (event.key === ']') {
        event.preventDefault()
        void window.api.goForward()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <SidebarProvider>
      <ToolbarProvider>
        <PreviewCanvas
          loadingStates={loadingStates}
          committedUrl={committedUrl}
          activePane={activePane}
        />
      </ToolbarProvider>
    </SidebarProvider>
  )
}
