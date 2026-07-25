import { useCallback, useEffect, useState } from 'react'
import { PANE_IDS } from '../../../shared/device-presets'
import { CANVAS_GAP, clampZoom, DEFAULT_ZOOM } from '../../../shared/mockup-layout'
import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../shared/sidebar'
import type { DeviceProfile, PaneId, PaneLoadError } from '../../../shared/types'
import { DevicePane } from '@renderer/components/device-pane'
import { CANVAS_GLASS_SURFACE_CLASS } from '@renderer/lib/glass-surface'
import { cn } from '@renderer/lib/utils'
import { PreviewCanvasContext } from '@renderer/context/preview-canvas-context'
import { useDiagnostics } from '@renderer/context/diagnostics-context'
import { useSidebar } from '@renderer/context/sidebar-context'
import { isCommittedPageUrl } from '../../../shared/project'

interface PreviewCanvasProps {
  loadingStates: Record<PaneId, boolean>
  errorStates: Record<PaneId, PaneLoadError | null>
  committedUrl: string
  activePane: PaneId | null
  safariChromeEnabled: boolean
  visiblePanes?: PaneId[]
  paneProfiles?: Partial<Record<PaneId, DeviceProfile>>
  canFocus?: boolean
  focusedPane?: PaneId | null
  onToggleFocus?: (paneId: PaneId) => void
  chromeHidden?: boolean
}

export function PreviewCanvas({
  loadingStates,
  errorStates,
  committedUrl,
  activePane,
  safariChromeEnabled,
  visiblePanes = PANE_IDS,
  paneProfiles,
  canFocus = false,
  focusedPane = null,
  onToggleFocus,
  chromeHidden = false
}: PreviewCanvasProps): React.JSX.Element {
  const [zoom, setZoomState] = useState(DEFAULT_ZOOM)
  // Interaction-sync link membership, per device. Defaults to all linked and is
  // reconciled with the main process on mount.
  const [linkedPanes, setLinkedPanes] = useState<PaneId[]>(PANE_IDS)
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const {
    isOpen: diagnosticsOpen,
    isTransitioning: diagnosticsTransitioning,
    width: diagnosticsWidth
  } = useDiagnostics()
  // Immersive mode hides the chrome overlays, so the canvas reclaims the full
  // window: no toolbar/sidebar/diagnostics gutters.
  const sidebarOffset =
    chromeHidden || !(sidebarOpen || sidebarTransitioning) ? 0 : SIDEBAR_WIDTH_PX
  const rightOffset =
    chromeHidden || !(diagnosticsOpen || diagnosticsTransitioning) ? 0 : diagnosticsWidth
  const topOffset = chromeHidden ? 0 : TOOLBAR_HEIGHT_PX
  const hasPreview = isCommittedPageUrl(committedUrl) || Object.values(loadingStates).some(Boolean)

  useEffect(() => {
    const unsubscribeAction = window.api.onPanelAction((action) => {
      if (action.type === 'set-zoom') {
        setZoomState(clampZoom(action.zoom))
      }
    })
    return unsubscribeAction
  }, [])

  useEffect(() => {
    void window.api.getLinkedPanes().then(setLinkedPanes)
  }, [])

  const toggleLink = useCallback(
    (paneId: PaneId) => {
      const nextLinked = !linkedPanes.includes(paneId)
      void window.api.setPaneLinked(paneId, nextLinked).then(setLinkedPanes)
    },
    [linkedPanes]
  )

  const shareWithAgent = useCallback((paneId: PaneId) => {
    void window.api.shareDeviceWithAgent(paneId)
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
            paddingTop: topOffset,
            paddingLeft: sidebarOffset,
            paddingRight: rightOffset
          }}
          onWheel={handleWheel}
          data-testid="preview-canvas"
        >
          <div className="flex min-h-full w-max min-w-full items-start justify-center py-6">
            <div className="flex items-start px-8" style={{ gap: CANVAS_GAP, zoom }}>
              {PANE_IDS.filter((id) => visiblePanes.includes(id)).map((paneId) => (
                <DevicePane
                  key={paneId}
                  paneId={paneId}
                  active={hasPreview}
                  isActivePane={activePane === paneId}
                  loading={loadingStates[paneId]}
                  error={errorStates[paneId]}
                  safariChromeEnabled={safariChromeEnabled}
                  profileOverride={paneProfiles?.[paneId]}
                  canFocus={canFocus || focusedPane === paneId}
                  isSoloed={focusedPane === paneId}
                  onToggleFocus={onToggleFocus ? () => onToggleFocus(paneId) : undefined}
                  isLinked={linkedPanes.includes(paneId)}
                  onToggleLink={() => toggleLink(paneId)}
                  onShareWithAgent={() => shareWithAgent(paneId)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PreviewCanvasContext.Provider>
  )
}
