import { DEVICE_PRESETS } from '../../../shared/device-presets'
import { getMockupDimensions, getScaledScreenCornerRadius } from '../../../shared/mockup-layout'
import type { PaneId } from '../../../shared/types'
import { cn } from '@renderer/lib/utils'
import { useSidebar } from '@renderer/context/sidebar-context'
import { usePaneBounds } from '@renderer/hooks/use-pane-bounds'
import { usePreviewCanvas } from '@renderer/context/preview-canvas-context'
import { Loading03Icon, Camera01Icon } from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { useCallback } from 'react'

interface DevicePaneProps {
  paneId: PaneId
  active: boolean
  isFocusedPane: boolean
  loading: boolean
}

const FRAME_STYLES: Record<PaneId, string> = {
  iphone: 'rounded-[2.75rem] shadow-2xl shadow-black/50',
  ipad: 'rounded-[1.5rem] shadow-xl shadow-black/40',
  desktop: 'rounded-xl shadow-lg shadow-black/30'
}

export function DevicePane({
  paneId,
  active,
  isFocusedPane,
  loading
}: DevicePaneProps): React.JSX.Element {
  const { zoom } = usePreviewCanvas()
  const { isTransitioning } = useSidebar()
  const profile = DEVICE_PRESETS[paneId]
  const dimensions = getMockupDimensions(paneId)
  const { chrome } = dimensions
  const cornerRadius = getScaledScreenCornerRadius(paneId, zoom)
  const setBoundsRef = usePaneBounds(paneId, cornerRadius, active)

  const handleScreenshot = useCallback(() => {
    void window.api.savePaneScreenshot(paneId)
  }, [paneId])

  return (
    <div
      className="flex shrink-0 flex-col gap-2"
      style={{ width: dimensions.frameWidth }}
      data-testid={`device-pane-${paneId}`}
      data-pane-interactive
      data-pane-transitioning={isTransitioning ? 'true' : 'false'}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-medium">{profile.name}</p>
            {isFocusedPane ? (
              <span
                className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium tracking-wide text-primary uppercase"
                data-testid={`pane-active-indicator-${paneId}`}
              >
                Active
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {profile.width}×{profile.height} @ {profile.deviceScaleFactor}x
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {loading ? (
            <Icon
              icon={Loading03Icon}
              className="size-4 shrink-0 animate-spin text-muted-foreground"
              data-testid={`pane-loading-${paneId}`}
            />
          ) : null}
          {isFocusedPane && active ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              data-testid={`pane-screenshot-${paneId}`}
              aria-label="Save screenshot"
              disabled={loading}
              onClick={handleScreenshot}
            >
              <Icon icon={Camera01Icon} />
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'flex shrink-0 flex-col border border-zinc-700/80 bg-zinc-900 transition-opacity duration-200',
          FRAME_STYLES[paneId],
          isTransitioning && 'opacity-0'
        )}
        style={{
          width: dimensions.frameWidth,
          height: dimensions.frameHeight,
          paddingLeft: chrome.bezelX,
          paddingRight: chrome.bezelX,
          paddingTop: chrome.bezelTop,
          paddingBottom: chrome.bezelBottom
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
          ref={setBoundsRef}
          className={cn(
            'relative shrink-0 overflow-hidden bg-black',
            loading && 'opacity-90'
          )}
          style={{
            width: dimensions.screenWidth,
            height: dimensions.screenHeight,
            borderRadius: dimensions.screenCornerRadius
          }}
          data-testid={`pane-surface-${paneId}`}
        >
          {!active ? (
            <div className="flex h-full items-center justify-center bg-zinc-950/90 px-6 text-center">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-100">No screen loaded</p>
                <p className="text-xs leading-5 text-zinc-400">
                  Enter a URL to open this preview.
                </p>
              </div>
            </div>
          ) : null}

          {active && paneId === 'iphone' ? (
            <div
              className="pointer-events-none absolute top-2 left-1/2 z-10 h-5 w-[72px] -translate-x-1/2 rounded-full bg-black"
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
