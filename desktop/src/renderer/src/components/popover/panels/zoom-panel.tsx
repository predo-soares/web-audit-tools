import { buttonVariants } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { clampZoom } from '../../../../../shared/mockup-layout'
import type { ZoomPopoverPayload } from '../../../../../shared/popover-types'
import type { PopoverPanelProps } from '@renderer/components/popover/types'

const ZOOM_OPTIONS = ['50%', '75%', '100%', '125%', '150%', '175%', '200%']

export function ZoomPanel({
  payload,
  onAction
}: PopoverPanelProps<ZoomPopoverPayload>): React.JSX.Element {
  const zoomValue = `${Math.round(payload.zoom * 100)}%`

  return (
    <div className="flex w-full flex-col gap-0.5">
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
