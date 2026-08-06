import type {
  PanelAlign,
  PanelId,
  PanelMode,
  PanelPayload,
  PanelPlacement
} from '../../../shared/panel-types'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

type AnchorTarget = HTMLElement | null | RefObject<HTMLElement | null>

interface UsePanelOptions {
  mode: PanelMode
  open: boolean
  anchorEl?: AnchorTarget
  placement?: PanelPlacement
  align?: PanelAlign
  payload?: PanelPayload
  edge?: 'left' | 'right' | 'top' | 'bottom'
  width?: number
  onOpenChange?: (open: boolean) => void
}

function resolveAnchorEl(anchorEl?: AnchorTarget): HTMLElement | null {
  if (!anchorEl) return null
  if ('current' in anchorEl) return anchorEl.current
  return anchorEl
}

export function usePanel(
  panelId: PanelId,
  options: UsePanelOptions,
  dismissRootRef?: RefObject<HTMLElement | null>
): { isOpen: boolean } {
  const [isOpen, setIsOpen] = useState(false)
  const optionsRef = useRef(options)
  optionsRef.current = options
  const isOpenRef = useRef(false)

  const setOpen = useCallback((open: boolean) => {
    if (isOpenRef.current === open) return
    isOpenRef.current = open
    setIsOpen(open)
    optionsRef.current.onOpenChange?.(open)
  }, [])

  const close = useCallback(async () => {
    await window.api.closePanel(panelId)
    setOpen(false)
  }, [panelId, setOpen])

  useEffect(() => {
    const unsubscribeClosed = window.api.onPanelClosed((closedPanelId) => {
      if (closedPanelId === panelId) {
        setOpen(false)
      }
    })
    return unsubscribeClosed
  }, [panelId, setOpen])

  useEffect(() => {
    const { open, mode, placement, align, payload, edge, width } = optionsRef.current

    if (!open) {
      if (isOpenRef.current) {
        void window.api.closePanel(panelId)
        setOpen(false)
      }
      return
    }

    const anchor = resolveAnchorEl(optionsRef.current.anchorEl)
    if (mode === 'anchored' && !anchor) return

    const rect = anchor?.getBoundingClientRect()
    void window.api.openPanel({
      panelId,
      mode,
      anchor: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : undefined,
      placement,
      align,
      payload,
      edge,
      width
    })
    setOpen(true)
  }, [
    options.open,
    options.anchorEl,
    options.payload,
    options.placement,
    options.align,
    options.edge,
    options.width,
    options.mode,
    panelId,
    setOpen
  ])

  useEffect(() => {
    if (options.mode !== 'anchored') return

    const handlePointerDown = (event: PointerEvent): void => {
      if (!isOpenRef.current) return
      if (dismissRootRef?.current?.contains(event.target as Node)) return
      void close()
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isOpenRef.current) {
        void close()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [close, dismissRootRef, options.mode])

  return { isOpen }
}
