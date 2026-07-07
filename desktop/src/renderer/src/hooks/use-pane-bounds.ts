import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { getMockupDimensions } from '../../../shared/mockup-layout'
import { usePreviewCanvas } from '@renderer/context/preview-canvas-context'
import type { Bounds, PaneId } from '../../../shared/types'

export function usePaneBounds(
  paneId: PaneId,
  cornerRadius: number
): (node: HTMLDivElement | null) => void {
  const { zoom, alignment } = usePreviewCanvas()
  const elementRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const frameRef = useRef<number | null>(null)

  const reportBounds = useCallback(() => {
    const element = elementRef.current
    if (!element) return

    const rect = element.getBoundingClientRect()
    const bounds: Bounds = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    }
    const viewport = element.closest('[data-canvas-viewport]')
    const canvasTop = Math.round(viewport?.getBoundingClientRect().top ?? 0)
    const dimensions = getMockupDimensions(paneId)
    void window.api.mountPane(paneId, {
      screenBounds: bounds,
      logicalSize: {
        width: dimensions.screenWidth,
        height: dimensions.screenHeight
      },
      cornerRadius,
      zoom,
      canvasTop
    })
  }, [cornerRadius, paneId, zoom])

  const scheduleReport = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      reportBounds()
    })
  }, [reportBounds])

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      elementRef.current = node
      observerRef.current?.disconnect()

      if (!node) return

      observerRef.current = new ResizeObserver(() => scheduleReport())
      observerRef.current.observe(node)
      scheduleReport()
    },
    [scheduleReport]
  )

  useLayoutEffect(() => {
    scheduleReport()
  }, [scheduleReport, alignment])

  useEffect(() => {
    const handleLayoutChange = (): void => scheduleReport()
    const viewport = elementRef.current?.closest('[data-canvas-viewport]')

    window.addEventListener('resize', handleLayoutChange)
    viewport?.addEventListener('scroll', handleLayoutChange)

    return () => {
      window.removeEventListener('resize', handleLayoutChange)
      viewport?.removeEventListener('scroll', handleLayoutChange)
    }
  }, [scheduleReport])

  // Unmount-only: this cleanup must not run when scheduleReport changes
  // identity (e.g. on zoom changes), or it cancels the pending frame while
  // frameRef still holds the stale id, permanently blocking future reports.
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [])

  return setRef
}
