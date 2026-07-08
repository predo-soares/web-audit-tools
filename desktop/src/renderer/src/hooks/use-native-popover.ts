import type { PopoverAlign, PopoverPanelId, PopoverPlacement, PopoverPayload } from '../../../shared/popover-types'
import { useCallback, useEffect, useState, type RefObject } from 'react'

interface OpenNativePopoverOptions {
  panelId: PopoverPanelId
  anchorEl: HTMLElement
  placement?: PopoverPlacement
  align?: PopoverAlign
  payload: PopoverPayload
}

export function useNativePopover(dismissRootRef?: RefObject<HTMLElement | null>): {
  open: (options: OpenNativePopoverOptions) => Promise<void>
  close: () => Promise<void>
  openPanelId: PopoverPanelId | null
} {
  const [openPanelId, setOpenPanelId] = useState<PopoverPanelId | null>(null)

  const close = useCallback(async () => {
    await window.api.closeNativePopover()
    setOpenPanelId(null)
  }, [])

  const open = useCallback(async (options: OpenNativePopoverOptions) => {
    const rect = options.anchorEl.getBoundingClientRect()
    await window.api.openNativePopover({
      panelId: options.panelId,
      anchor: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      placement: options.placement,
      align: options.align,
      payload: options.payload
    })
    setOpenPanelId(options.panelId)
  }, [])

  useEffect(() => {
    const unsubscribeClosed = window.api.onPopoverClosed(() => {
      setOpenPanelId(null)
    })
    return unsubscribeClosed
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      if (openPanelId === null) return
      if (dismissRootRef?.current?.contains(event.target as Node)) return
      void close()
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && openPanelId !== null) {
        void close()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [close, dismissRootRef, openPanelId])

  return { open, close, openPanelId }
}
