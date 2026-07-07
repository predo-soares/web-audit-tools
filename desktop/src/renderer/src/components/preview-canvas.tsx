import { useCallback, useState, type ReactNode } from 'react'
import { PANE_IDS } from '../../../shared/device-presets'
import { CANVAS_GAP, clampZoom, DEFAULT_ZOOM } from '../../../shared/mockup-layout'
import type { PaneId } from '../../../shared/types'
import { DevicePane } from '@renderer/components/device-pane'
import {
  PreviewCanvasContext,
  type Alignment
} from '@renderer/context/preview-canvas-context'

const JUSTIFY: Record<Alignment, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end'
}

interface PreviewCanvasProps {
  loadingStates: Record<PaneId, boolean>
  children: ReactNode
}

export function PreviewCanvas({ loadingStates, children }: PreviewCanvasProps): React.JSX.Element {
  const [zoom, setZoomState] = useState(DEFAULT_ZOOM)
  const [alignment, setAlignment] = useState<Alignment>('center')

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
    <PreviewCanvasContext.Provider value={{ zoom, alignment, setZoom, adjustZoom, setAlignment }}>
      <div className="flex h-screen flex-col bg-transparent text-foreground">
        {children}
        <div
          data-canvas-viewport
          className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-black/20 [background-image:radial-gradient(circle_at_center,_rgba(255,255,255,0.08)_1px,_transparent_1px)] [background-size:20px_20px]"
          onWheel={handleWheel}
          data-testid="preview-canvas"
        >
          <div className={`flex min-w-full items-start py-6 px-8 ${JUSTIFY[alignment]}`}>
            <div
              className="flex items-start"
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
    </PreviewCanvasContext.Provider>
  )
}
