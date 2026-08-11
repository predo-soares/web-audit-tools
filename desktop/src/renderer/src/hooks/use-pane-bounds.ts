import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { getMockupDimensions } from '../../../shared/mockup-layout'
import { SIDEBAR_TRANSITION_MS } from '../../../shared/sidebar'
import { useDiagnostics } from '@renderer/context/diagnostics-context'
import { LAYOUT_SETTLED_EVENT, useSidebar } from '@renderer/context/sidebar-context'
import { usePreviewCanvas } from '@renderer/context/preview-canvas-context'
import type { Bounds, DeviceProfile, PaneId } from '../../../shared/pane-types'

export function usePaneBounds(
  paneId: PaneId,
  cornerRadius: number,
  enabled = true,
  profileOverride?: Pick<DeviceProfile, 'width' | 'height'>
): (node: HTMLDivElement | null) => void {
  const { zoom } = usePreviewCanvas()
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const { isOpen: diagnosticsOpen, isTransitioning: diagnosticsTransitioning } = useDiagnostics()
  const layoutTransitioning = sidebarTransitioning || diagnosticsTransitioning
  const elementRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const frameRefs = useRef<number[]>([])

  const reportBounds = useCallback(() => {
    if (!enabled) return
    const element = elementRef.current
    if (!element) return

    const rect = element.getBoundingClientRect()
    const dimensions = getMockupDimensions(paneId, profileOverride)
    // CSS `zoom` on an ancestor affects x/y but getBoundingClientRect may
    // return the pre-zoom layout size for width/height. Compute them from
    // known device dimensions so the native WebContentsView is always sized
    // correctly without depending on how the browser reports zoomed rects.
    const bounds: Bounds = {
      x: rect.left,
      y: rect.top,
      width: dimensions.screenWidth * zoom,
      height: dimensions.screenHeight * zoom
    }
    void window.api.mountPane(paneId, {
      screenBounds: bounds,
      logicalSize: {
        width: dimensions.screenWidth,
        height: dimensions.screenHeight
      },
      cornerRadius,
      zoom
    })
  }, [cornerRadius, enabled, paneId, profileOverride, zoom])

  const scheduleReport = useCallback(() => {
    if (frameRefs.current.length > 0) return
    const run = (remainingPasses: number): void => {
      const frameId = window.requestAnimationFrame(() => {
        frameRefs.current = frameRefs.current.filter((id) => id !== frameId)
        reportBounds()
        if (remainingPasses > 1) {
          run(remainingPasses - 1)
        }
      })
      frameRefs.current.push(frameId)
    }

    // CSS zoom can leave the first layout sample one frame behind. Take a
    // second post-layout measurement so the native WebContentsView receives
    // the settled placeholder width without waiting for another zoom gesture.
    run(2)
  }, [reportBounds])

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      elementRef.current = node
      observerRef.current?.disconnect()

      if (!enabled) return

      if (!node) return

      observerRef.current = new ResizeObserver(() => scheduleReport())
      observerRef.current.observe(node)
      scheduleReport()
    },
    [enabled, scheduleReport]
  )

  useLayoutEffect(() => {
    if (!enabled) return
    scheduleReport()
  }, [
    enabled,
    scheduleReport,
    sidebarOpen,
    sidebarTransitioning,
    diagnosticsOpen,
    diagnosticsTransitioning
  ])

  useEffect(() => {
    if (!enabled || !layoutTransitioning) return

    let frameId = 0
    const startedAt = performance.now()

    const tick = (now: number): void => {
      reportBounds()
      if (now - startedAt < SIDEBAR_TRANSITION_MS + 32) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [enabled, layoutTransitioning, reportBounds])

  useEffect(() => {
    if (!enabled) return
    const handleLayoutChange = (): void => scheduleReport()
    const handleLayoutSettled = (): void => scheduleReport()
    const viewport = elementRef.current?.closest('[data-canvas-viewport]')

    window.addEventListener('resize', handleLayoutChange)
    window.addEventListener(LAYOUT_SETTLED_EVENT, handleLayoutSettled)
    viewport?.addEventListener('scroll', handleLayoutChange)

    return () => {
      window.removeEventListener('resize', handleLayoutChange)
      window.removeEventListener(LAYOUT_SETTLED_EVENT, handleLayoutSettled)
      viewport?.removeEventListener('scroll', handleLayoutChange)
    }
  }, [enabled, scheduleReport])

  // Unmount-only: this cleanup must not run when scheduleReport changes
  // identity (e.g. on zoom changes), or it cancels the pending frame while
  // frameRef still holds the stale id, permanently blocking future reports.
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
      for (const frameId of frameRefs.current) {
        window.cancelAnimationFrame(frameId)
      }
      frameRefs.current = []
    }
  }, [])

  return setRef
}
