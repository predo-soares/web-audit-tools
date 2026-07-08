import { POPOVER_PANEL_REGISTRY } from '@renderer/components/popover/panel-registry'
import type { PopoverShowMessage } from '@renderer/components/popover/types'
import { cn } from '@renderer/lib/utils'
import { POPOVER_PANEL_MIN_SIZE, type PopoverPanelId } from '../../../shared/popover-types'
import { useEffect, useRef, useState } from 'react'

const PANEL_WIDTH_CLASS: Record<PopoverPanelId, string> = {
  zoom: 'w-36',
  theme: 'w-44'
}

export function OverlayApp(): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState<PopoverShowMessage | null>(null)

  useEffect(() => {
    const unsubscribeShow = window.popoverApi.onShow((message) => setShow(message))
    const unsubscribeHide = window.popoverApi.onHide(() => setShow(null))
    return () => {
      unsubscribeShow()
      unsubscribeHide()
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!show || !container) return

    const reportSize = (): void => {
      requestAnimationFrame(() => {
        const minSize = POPOVER_PANEL_MIN_SIZE[show.panelId]
        const rect = container.getBoundingClientRect()
        window.popoverApi.reportSize({
          width: Math.ceil(Math.max(minSize.width, rect.width, container.scrollWidth)),
          height: Math.ceil(Math.max(minSize.height, rect.height, container.scrollHeight))
        })
      })
    }

    reportSize()
    const observer = new ResizeObserver(reportSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [show])

  if (!show) return null

  const Panel = POPOVER_PANEL_REGISTRY[show.panelId]

  return (
    <div className="min-h-0 bg-transparent p-0">
      <div
        ref={containerRef}
        className={cn(
          'box-border flex shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/40 p-1 text-foreground shadow-md backdrop-blur-xl',
          PANEL_WIDTH_CLASS[show.panelId]
        )}
        data-testid="toolbar-custom-popover"
      >
        <Panel payload={show.payload} onAction={(action) => window.popoverApi.sendAction(action)} />
      </div>
    </div>
  )
}
