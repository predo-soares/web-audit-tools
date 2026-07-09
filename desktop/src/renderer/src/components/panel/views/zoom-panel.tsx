import { buttonVariants } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { clampZoom } from '../../../../../shared/mockup-layout'
import type { ZoomPanelPayload, PanelAction } from '../../../../../shared/panel-types'

const ZOOM_OPTIONS = ['50%', '75%', '100%', '125%', '150%', '175%', '200%']

export function ZoomPanel({
  payload,
  onAction
}: {
  payload?: ZoomPanelPayload
  onAction: (action: PanelAction) => void
}): React.JSX.Element {
  if (!payload) return <></>
  const zoomValue = `${Math.round(payload.zoom * 100)}%`

  return (
    <div className="flex w-full flex-col gap-0.5">
      <button
        type="button"
        data-testid="zoom-fit-to-window"
        className={cn(
          buttonVariants({
            variant: 'ghost',
            size: 'xs'
          }),
          'w-full justify-start'
        )}
        onClick={() => onAction({ type: 'fit-zoom' })}
      >
        Fit to window
      </button>
      <div className="my-0.5 h-px bg-border" role="separator" />
      {ZOOM_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          className={cn(
            buttonVariants({
              variant: option === zoomValue ? 'secondary' : 'ghost',
              size: 'xs'
            }),
            'w-full justify-start'
          )}
          onClick={() => onAction({ type: 'set-zoom', zoom: clampZoom(Number.parseInt(option, 10) / 100) })}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
