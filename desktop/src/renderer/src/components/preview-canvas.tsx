import { useCallback, useEffect, useState } from 'react'
import { PANE_IDS } from '../../../shared/device-presets'
import { CANVAS_GAP, clampZoom, DEFAULT_ZOOM } from '../../../shared/mockup-layout'
import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../shared/sidebar'
import type { DeviceProfile, PaneId, PaneLoadError } from '../../../shared/types'
import type { InspectionState } from '../../../shared/inspection'
import { DevicePane } from '@renderer/components/device-pane'
import { CANVAS_GLASS_SURFACE_CLASS } from '@renderer/lib/glass-surface'
import { cn } from '@renderer/lib/utils'
import { PreviewCanvasContext } from '@renderer/context/preview-canvas-context'
import { useDiagnostics } from '@renderer/context/diagnostics-context'
import { useSidebar } from '@renderer/context/sidebar-context'
import { isCommittedPageUrl } from '../../../shared/project'
import { InspectionRail } from '@renderer/components/inspection-rail'

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
  const [inspectionState, setInspectionState] = useState<InspectionState>({
    active: false,
    record: null,
    records: []
  })
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
  const inspectionOpen = inspectionState.record !== null
  const inspectionWidth = inspectionOpen ? 360 : 0
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

  useEffect(() => {
    void window.api.getInspectionState().then(setInspectionState)
    return window.api.onInspectionState(setInspectionState)
  }, [])

  useEffect(() => {
    if (!inspectionState.active && !inspectionState.record) return
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      void window.api.setInspectionMode(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [inspectionState.active, inspectionState.record])

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
      <div
        className="relative h-screen overflow-hidden bg-transparent text-foreground"
        data-inspection-open={inspectionOpen ? 'true' : 'false'}
      >
        <div
          data-canvas-viewport
          className={cn('absolute inset-y-0 overflow-auto', CANVAS_GLASS_SURFACE_CLASS)}
          style={{
            left: sidebarOffset,
            right: rightOffset + inspectionWidth,
            paddingTop: topOffset
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
        {inspectionState.record ? (
          <div className="absolute bottom-0 z-20" style={{ right: rightOffset, top: topOffset }}>
            <InspectionRail
              record={inspectionState.record}
              onClose={() => void window.api.setInspectionMode(false)}
            />
          </div>
        ) : null}
      </div>
    </PreviewCanvasContext.Provider>
  )
}
