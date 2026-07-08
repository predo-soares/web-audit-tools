import { useCallback, useState, type ReactNode } from 'react'
import { PANE_IDS } from '../../../shared/device-presets'
import { CANVAS_GAP, clampZoom, DEFAULT_ZOOM } from '../../../shared/mockup-layout'
import { TOOLBAR_HEIGHT_PX } from '../../../shared/sidebar'
import type { HistoryEntry } from '../../../shared/history'
import type { PaneId } from '../../../shared/types'
import type { Project } from '../../../shared/project'
import { Sidebar } from '@renderer/components/sidebar'
import { DevicePane } from '@renderer/components/device-pane'
import { PreviewCanvasContext } from '@renderer/context/preview-canvas-context'

interface PreviewCanvasProps {
  loadingStates: Record<PaneId, boolean>
  projects: Project[]
  history: HistoryEntry[]
  committedUrl: string
  onProjectActivate: (project: Project) => void
  onHistoryActivate: (entry: HistoryEntry) => void
  onHistoryDelete: (entry: HistoryEntry) => Promise<void>
  onHistoryClear: () => Promise<void>
  toolbar: ReactNode
}

export function PreviewCanvas({
  loadingStates,
  projects,
  history,
  committedUrl,
  onProjectActivate,
  onHistoryActivate,
  onHistoryDelete,
  onHistoryClear,
  toolbar
}: PreviewCanvasProps): React.JSX.Element {
  const [zoom, setZoomState] = useState(DEFAULT_ZOOM)

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
        {toolbar}
        <div className="flex h-full">
          <Sidebar
            projects={projects}
            history={history}
            committedUrl={committedUrl}
            onProjectActivate={onProjectActivate}
            onHistoryActivate={onHistoryActivate}
            onHistoryDelete={onHistoryDelete}
            onHistoryClear={onHistoryClear}
          />
          <div
            data-canvas-viewport
            className="relative min-h-0 min-w-0 flex-1 overflow-auto bg-black/50 backdrop-blur-sm [background-image:radial-gradient(circle_at_center,_rgba(255,255,255,0.06)_1px,_transparent_1px)] [background-size:20px_20px]"
            style={{ paddingTop: TOOLBAR_HEIGHT_PX }}
            onWheel={handleWheel}
            data-testid="preview-canvas"
          >
            <div className="flex w-max min-w-full items-start justify-center py-6">
              <div
                className="flex items-start px-8"
                style={{ gap: CANVAS_GAP, zoom }}
              >
                {PANE_IDS.map((paneId) => (
                  <DevicePane
                    key={paneId}
                    paneId={paneId}
                    loading={loadingStates[paneId]}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PreviewCanvasContext.Provider>
  )
}
