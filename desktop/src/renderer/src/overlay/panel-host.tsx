import { PANEL_VIEW_REGISTRY } from '@renderer/components/panel/panel-registry'
import type { PanelShowState } from '@renderer/components/panel/types'
import { PanelChrome } from '@renderer/components/ui/panel'
import { getDockedPanelTransform } from '../../../shared/panel-animation'
import { getPanelFixedSize } from '../../../shared/panel-types'
import { SIDEBAR_TRANSITION_MS, SIDEBAR_WIDTH_PX } from '../../../shared/sidebar'
import { useCallback, useEffect, useRef, useState } from 'react'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function PanelHost(): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useState<PanelShowState | null>(null)
  const [visible, setVisible] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [resolvedPlacement, setResolvedPlacement] = useState<PanelShowState['placement'] | null>(
    null
  )
  const [reducedMotion] = useState(prefersReducedMotion)
  const panelModeRef = useRef<PanelShowState['mode'] | null>(null)

  const activePlacement = resolvedPlacement ?? panel?.placement ?? 'bottom'

  const finishExit = useCallback((): void => {
    window.panelApi.reportExitComplete()
  }, [])

  useEffect(() => {
    const unsubscribeShow = window.panelApi.onShow((message) => {
      panelModeRef.current = message.mode
      setPanel({
        panelId: message.panelId,
        mode: message.mode,
        payload: message.payload,
        placement: message.placement ?? 'bottom',
        align: message.align ?? 'end',
        resolvedPlacement: message.resolvedPlacement
      })
      setResolvedPlacement(message.resolvedPlacement ?? null)
      const showImmediately = message.immediate === true || reducedMotion
      setVisible(showImmediately)

      if (showImmediately) return

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      })
    })

    const unsubscribeHide = window.panelApi.onHide(() => {
      if (panelModeRef.current === 'docked') {
        setVisible(false)
        return
      }
      setVisible(false)

      if (reducedMotion) {
        finishExit()
      }
    })

    const unsubscribePlacement = window.panelApi.onPlacement((placement) => {
      setResolvedPlacement(placement)
    })
    const unsubscribeTransition = window.panelApi.onTransition((state) => {
      setIsTransitioning(state.transitioning)
    })

    window.panelApi.reportReady()

    return () => {
      unsubscribeShow()
      unsubscribeHide()
      unsubscribePlacement()
      unsubscribeTransition()
    }
  }, [finishExit, reducedMotion])

  useEffect(() => {
    if (!panel || panel.mode === 'docked') return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      void window.panelApi.closePanel(panel.panelId)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [panel])

  useEffect(() => {
    const container = containerRef.current
    if (!panel || !container || panel.mode === 'modal') return
    if (getPanelFixedSize(panel.panelId)) return

    const reportSize = (): void => {
      requestAnimationFrame(() => {
        // Use offset* (layout size) rather than getBoundingClientRect(), which
        // includes the enter/exit scale transform and would size the native
        // view to the shrunken box, clipping the right/bottom rounded corners.
        window.panelApi.reportSize({
          width: container.offsetWidth,
          height: container.offsetHeight
        })
      })
    }

    reportSize()
    const observer = new ResizeObserver(reportSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [panel])

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) return
    if (event.propertyName !== 'opacity') return
    if (visible || !panel) return
    finishExit()
  }

  if (!panel) return null

  const PanelView = PANEL_VIEW_REGISTRY[panel.panelId]
  if (!PanelView) return null

  if (panel.mode === 'docked') {
    const isSlidingPanel = panel.panelId === 'sidebar-left' || panel.panelId === 'diagnostics-right'

    return (
      <div
        ref={containerRef}
        className="h-screen min-h-screen overflow-hidden bg-transparent p-0"
        data-panel-transitioning={isTransitioning ? 'true' : 'false'}
        style={{
          width: panel.panelId === 'sidebar-left' ? SIDEBAR_WIDTH_PX : '100%',
          transform: isSlidingPanel
            ? getDockedPanelTransform(
                panel.panelId === 'diagnostics-right' ? 'right' : 'left',
                visible
              )
            : undefined,
          transition:
            isSlidingPanel && !reducedMotion
              ? `transform ${SIDEBAR_TRANSITION_MS}ms var(--ease-out-strong)`
              : undefined,
          willChange: isSlidingPanel ? 'transform' : undefined
        }}
      >
        <PanelView
          payload={panel.payload}
          onAction={(action) => window.panelApi.sendAction(action)}
        />
      </div>
    )
  }

  if (panel.mode === 'modal') {
    return (
      <div
        ref={containerRef}
        data-testid="shortcuts-modal-backdrop"
        data-visible={visible ? 'true' : 'false'}
        className="flex h-screen w-screen items-center justify-center bg-black/60 p-4 transition-opacity supports-backdrop-filter:bg-black/45 supports-backdrop-filter:backdrop-blur-md"
        style={{
          opacity: visible ? 1 : 0,
          transitionDuration: `${visible ? 160 : 120}ms`
        }}
        onMouseDown={(event) => {
          if (event.target !== event.currentTarget) return
          void window.panelApi.closePanel(panel.panelId)
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        <PanelView onAction={(action) => window.panelApi.sendAction(action)} />
      </div>
    )
  }

  if (!panel.payload) return null

  return (
    <div className="min-h-0 bg-transparent p-0">
      <PanelChrome
        panelId={panel.panelId}
        visible={visible}
        placement={activePlacement}
        align={panel.align}
        width={panel.payload && 'width' in panel.payload ? panel.payload.width : undefined}
        containerRef={containerRef}
        onTransitionEnd={handleTransitionEnd}
      >
        <PanelView
          payload={panel.payload}
          onAction={(action) => window.panelApi.sendAction(action)}
        />
      </PanelChrome>
    </div>
  )
}
