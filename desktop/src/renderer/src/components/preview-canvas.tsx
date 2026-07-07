import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { PANE_IDS } from '../../../shared/device-presets'
import {
  CANVAS_GAP,
  clampZoom,
  DEFAULT_ZOOM,
  getCanvasSize
} from '../../../shared/mockup-layout'
import type { PaneId } from '../../../shared/types'
import { DevicePane } from '@renderer/components/device-pane'
import {
  PreviewCanvasContext,
  type CanvasPoint
} from '@renderer/context/preview-canvas-context'

interface PreviewCanvasProps {
  loadingStates: Record<PaneId, boolean>
  children: ReactNode
}

export function PreviewCanvas({ loadingStates, children }: PreviewCanvasProps): React.JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [webviewScale, setWebviewScale] = useState(1)
  const [pan, setPan] = useState<CanvasPoint>({ x: 0, y: 0 })
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  const panSession = useRef<{
    pointerId: number
    origin: CanvasPoint
    startPan: CanvasPoint
  } | null>(null)

  panRef.current = pan
  zoomRef.current = zoom

  const zoomToPoint = useCallback((nextZoom: number, clientX: number, clientY: number) => {
    const viewport = viewportRef.current
    if (!viewport) return

    const clampedZoom = clampZoom(nextZoom)
    const rect = viewport.getBoundingClientRect()
    const pointX = clientX - rect.left
    const pointY = clientY - rect.top
    const currentZoom = zoomRef.current
    const currentPan = panRef.current
    const scale = clampedZoom / currentZoom

    setPan({
      x: pointX - scale * (pointX - currentPan.x),
      y: pointY - scale * (pointY - currentPan.y)
    })
    setZoom(clampedZoom)
  }, [])

  const setZoomCentered = useCallback(
    (nextZoom: number) => {
      const viewport = viewportRef.current
      if (!viewport) {
        setZoom(clampZoom(nextZoom))
        return
      }

      const rect = viewport.getBoundingClientRect()
      zoomToPoint(nextZoom, rect.left + rect.width / 2, rect.top + rect.height / 2)
    },
    [zoomToPoint]
  )

  const adjustZoom = useCallback(
    (delta: number) => {
      setZoomCentered(clampZoom(Number((zoomRef.current + delta).toFixed(2))))
    },
    [setZoomCentered]
  )

  const centerCanvas = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const { width, height } = getCanvasSize()
    const currentZoom = zoomRef.current

    setPan({
      x: Math.max(16, (viewport.clientWidth - width * currentZoom) / 2),
      y: Math.max(16, (viewport.clientHeight - height * currentZoom) / 2)
    })
  }, [])

  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    centerCanvas()
  }, [centerCanvas])

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey && !event.metaKey) return

      event.preventDefault()
      const delta = -event.deltaY * 0.0015
      zoomToPoint(zoomRef.current + delta, event.clientX, event.clientY)
    },
    [zoomToPoint]
  )

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return

    const target = event.target as HTMLElement
    if (target.closest('[data-pane-interactive]')) return

    event.preventDefault()
    panSession.current = {
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      startPan: panRef.current
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const session = panSession.current
    if (!session || session.pointerId !== event.pointerId) return

    setPan({
      x: session.startPan.x + (event.clientX - session.origin.x),
      y: session.startPan.y + (event.clientY - session.origin.y)
    })
  }, [])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const session = panSession.current
    if (!session || session.pointerId !== event.pointerId) return

    panSession.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  return (
    <PreviewCanvasContext.Provider
      value={{ zoom, webviewScale, pan, setZoomCentered, adjustZoom, setWebviewScale }}
    >
      <div className="flex h-screen flex-col bg-background text-foreground">
        {children}
        <div
          ref={viewportRef}
          className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.04)_1px,_transparent_1px)] [background-size:20px_20px] active:cursor-grabbing"
          data-testid="preview-canvas"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
            }}
          >
            <div className="flex items-start" style={{ gap: CANVAS_GAP }}>
              {PANE_IDS.map((paneId) => (
                <DevicePane
                  key={paneId}
                  paneId={paneId}
                  loading={loadingStates[paneId]}
                  zoom={zoom}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PreviewCanvasContext.Provider>
  )
}
