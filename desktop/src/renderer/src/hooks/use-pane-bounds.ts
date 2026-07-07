import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { DEVICE_PRESETS } from '../../../shared/device-presets'
import { usePreviewCanvas } from '@renderer/context/preview-canvas-context'
import type { Bounds, PaneId } from '../../../shared/types'

export function usePaneBounds(
  paneId: PaneId,
  cornerRadius: number
): (node: HTMLDivElement | null) => void {
  const { pan, webviewScale, zoom } = usePreviewCanvas()
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
    const profile = DEVICE_PRESETS[paneId]
    void window.api.mountPane(paneId, {
      screenBounds: bounds,
      logicalSize: {
        width: profile.width,
        height: profile.height
      },
      cornerRadius,
      zoom,
      webviewScale
    })
  }, [cornerRadius, paneId, webviewScale, zoom])

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
  }, [pan.x, pan.y, scheduleReport, zoom])

  useEffect(() => {
    const handleLayoutChange = (): void => scheduleReport()
    window.addEventListener('resize', handleLayoutChange)
    return () => {
      window.removeEventListener('resize', handleLayoutChange)
      observerRef.current?.disconnect()
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [scheduleReport])

  return setRef
}
