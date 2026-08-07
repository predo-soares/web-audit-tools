import type { ReactNode } from 'react'
import { getMockupDimensions } from '../../../shared/mockup-layout'
import type { DeviceProfile, PaneId } from '../../../shared/types'
import { cn } from '@renderer/lib/utils'

const DEVICE_FRAME_STYLES: Record<PaneId, string> = {
  iphone: 'rounded-[2.75rem] shadow-2xl shadow-black/50',
  ipad: 'rounded-[1.5rem] shadow-xl shadow-black/40',
  desktop: 'rounded-xl shadow-lg shadow-black/30'
}

interface DeviceFrameProps {
  paneId: PaneId
  profile: Pick<DeviceProfile, 'width' | 'height'>
  scale?: number
  screenRef?: (node: HTMLDivElement | null) => void
  screenTestId?: string
  screenClassName?: string
  frameClassName?: string
  showDynamicIsland?: boolean
  children?: ReactNode
}

export function DeviceFrame({
  paneId,
  profile,
  scale = 1,
  screenRef,
  screenTestId,
  screenClassName,
  frameClassName,
  showDynamicIsland = false,
  children
}: DeviceFrameProps): React.JSX.Element {
  const dimensions = getMockupDimensions(paneId, profile)
  const { chrome } = dimensions

  return (
    <div
      className="relative shrink-0"
      style={{
        width: dimensions.frameWidth * scale,
        height: dimensions.frameHeight * scale
      }}
    >
      <div
        className={cn(
          'flex shrink-0 flex-col border border-zinc-700/80 bg-zinc-900',
          DEVICE_FRAME_STYLES[paneId],
          frameClassName
        )}
        style={{
          width: dimensions.frameWidth,
          height: dimensions.frameHeight,
          paddingLeft: chrome.bezelX,
          paddingRight: chrome.bezelX,
          paddingTop: chrome.bezelTop,
          paddingBottom: chrome.bezelBottom,
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
      >
        {paneId === 'desktop' ? (
          <div
            className="flex shrink-0 items-center gap-1.5 px-2"
            style={{ height: chrome.headerHeight, marginBottom: chrome.headerGap }}
          >
            <span className="size-2.5 rounded-full bg-red-500/80" />
            <span className="size-2.5 rounded-full bg-yellow-500/80" />
            <span className="size-2.5 rounded-full bg-green-500/80" />
          </div>
        ) : null}

        <div
          ref={screenRef}
          className={cn('relative shrink-0 overflow-hidden bg-black', screenClassName)}
          style={{
            width: dimensions.screenWidth,
            height: dimensions.screenHeight,
            borderRadius: dimensions.screenCornerRadius
          }}
          data-testid={screenTestId}
        >
          {children}
          {showDynamicIsland ? (
            <div className="pointer-events-none absolute top-2 left-1/2 z-10 h-5 w-[72px] -translate-x-1/2 rounded-full bg-black" />
          ) : null}
        </div>
      </div>
    </div>
  )
}
