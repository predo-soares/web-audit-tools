import { useCallback, useEffect, useState } from 'react'
import { PANE_IDS } from '../../../shared/device-presets'
import { CANVAS_GAP, clampZoom, DEFAULT_ZOOM } from '../../../shared/mockup-layout'
import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../shared/sidebar'
import type { PaneId } from '../../../shared/types'
import { DevicePane } from '@renderer/components/device-pane'
import { CANVAS_GLASS_SURFACE_CLASS } from '@renderer/lib/glass-surface'
import { cn } from '@renderer/lib/utils'
import { PreviewCanvasContext } from '@renderer/context/preview-canvas-context'
import { useSidebar } from '@renderer/context/sidebar-context'
import { isCommittedPageUrl } from '../../../shared/project'

interface PreviewCanvasProps {
  loadingStates: Record<PaneId, boolean>
  committedUrl: string
  activePane: PaneId | null
}

export function PreviewCanvas({
  loadingStates,
  committedUrl,
  activePane
}: PreviewCanvasProps): React.JSX.Element {
  const [zoom, setZoomState] = useState(DEFAULT_ZOOM)
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const sidebarOffset = sidebarOpen || sidebarTransitioning ? SIDEBAR_WIDTH_PX : 0
  const hasPreview =
    isCommittedPageUrl(committedUrl) || Object.values(loadingStates).some(Boolean)

  useEffect(() => {
    const unsubscribeAction = window.api.onPanelAction((action) => {
      if (action.type === 'set-zoom') {
        setZoomState(clampZoom(action.zoom))
      }
    })
    return unsubscribeAction
  }, [])

  const setZoom = useCallback((nextZoom: number) => {
    setZoomState(clampZoom(nextZoom))
  }, [])

  const adjustZoom = useCallback((delta: number) => {
    setZoomState((z) => clampZoom(Number((z + delta).toFixed(2))))
  }, [])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const delta = -event.deltaY * 0.0015
    setZoomState((z) => clampZoom(Number((z + delta).toFixed(2))))
  }, [])

  return (
    <PreviewCanvasContext.Provider value={{ zoom, setZoom, adjustZoom }}>
      <div className="relative h-screen overflow-hidden bg-transparent text-foreground">
        <div
          data-canvas-viewport
          className={cn('box-border h-screen overflow-auto', CANVAS_GLASS_SURFACE_CLASS)}
          style={{
            paddingTop: TOOLBAR_HEIGHT_PX,
            paddingLeft: sidebarOffset
          }}
          onWheel={handleWheel}
          data-testid="preview-canvas"
        >
          <div className="flex min-h-full w-max min-w-full items-start justify-center py-6">
            <div className="flex items-start px-8" style={{ gap: CANVAS_GAP, zoom }}>
              {PANE_IDS.map((paneId) => (
                <DevicePane
                  key={paneId}
                  paneId={paneId}
                  active={hasPreview}
                  isFocusedPane={activePane === paneId}
                  loading={loadingStates[paneId]}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PreviewCanvasContext.Provider>
  )
}
