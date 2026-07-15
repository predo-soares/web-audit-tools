import { cn } from '@renderer/lib/utils'
import {
  getPanelEnterTransform,
  getPanelTransformOrigin,
  PANEL_ENTER_MS,
  PANEL_EXIT_MS
} from '../../../../shared/panel-animation'
import type { PanelAlign, PanelId, PanelPlacement } from '../../../../shared/panel-types'
import { useRef } from 'react'

const PANEL_SIZE_CLASS: Record<PanelId, string> = {
  zoom: 'h-[224px] w-36',
  theme: '',
  'sidebar-left': 'w-[280px]',
  'diagnostics-right': 'w-[320px]',
  'toolbar-top': 'w-full',
  'url-history': 'w-[42rem] max-h-[320px]'
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface PanelChromeProps {
  panelId: PanelId
  visible: boolean
  placement: PanelPlacement
  align: PanelAlign
  containerRef: React.RefObject<HTMLDivElement | null>
  onTransitionEnd: (event: React.TransitionEvent<HTMLDivElement>) => void
  children: React.ReactNode
}

export function PanelChrome({
  panelId,
  visible,
  placement,
  align,
  containerRef,
  onTransitionEnd,
  children
}: PanelChromeProps): React.JSX.Element {
  const reducedMotion = useRef(prefersReducedMotion())
  const transformOrigin = getPanelTransformOrigin(placement, align)
  const enterTransform = getPanelEnterTransform(placement)
  const durationMs = visible ? PANEL_ENTER_MS : PANEL_EXIT_MS

  return (
    <div
      ref={containerRef}
      data-testid="toolbar-custom-popover"
      data-visible={visible ? 'true' : 'false'}
      data-placement={placement}
      onTransitionEnd={onTransitionEnd}
      className={cn(
        'box-border flex shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-background p-1 text-foreground will-change-[transform,opacity]',
        PANEL_SIZE_CLASS[panelId]
      )}
      style={{
        transformOrigin,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translate(0, 0)' : enterTransform,
        transition: reducedMotion.current
          ? `opacity ${durationMs}ms var(--ease-out-strong)`
          : `opacity ${durationMs}ms var(--ease-out-strong), transform ${durationMs}ms var(--ease-out-strong)`
      }}
    >
      <div className="relative z-[1] flex w-full flex-col">{children}</div>
    </div>
  )
}
