import { DEVICE_PRESETS } from '../../../../shared/device-presets'
import { getMockupDimensions, getScaledScreenCornerRadius } from '../../../../shared/mockup-layout'
import type { DeviceProfile, PaneId, PaneLoadError } from '../../../../shared/pane-types'
import { cn } from '@renderer/lib/utils'
import { useSidebar } from '@renderer/context/sidebar-context'
import { usePaneBounds } from '@renderer/hooks/use-pane-bounds'
import { usePreviewCanvas } from '@renderer/context/preview-canvas-context'
import {
  Loading03Icon,
  Camera01Icon,
  Alert01Icon,
  Maximize01Icon,
  Minimize01Icon,
  Link01Icon,
  Unlink01Icon
} from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { DeviceFrame } from '@renderer/components/devices/device-frame'
import { useCallback } from 'react'

interface DevicePaneProps {
  paneId: PaneId
  active: boolean
  isActivePane: boolean
  loading: boolean
  error: PaneLoadError | null
  safariChromeEnabled?: boolean
  profileOverride?: DeviceProfile
  canFocus?: boolean
  isSoloed?: boolean
  onToggleFocus?: () => void
  isLinked?: boolean
  onToggleLink?: () => void
  onShareWithAgent?: () => void
}

function friendlyErrorMessage(description: string): string {
  const map: Record<string, string> = {
    ERR_NAME_NOT_RESOLVED: 'DNS lookup failed',
    ERR_CONNECTION_REFUSED: 'Connection refused',
    ERR_CONNECTION_TIMED_OUT: 'Connection timed out',
    ERR_INTERNET_DISCONNECTED: 'No internet connection',
    ERR_SSL_PROTOCOL_ERROR: 'SSL error',
    ERR_CERT_AUTHORITY_INVALID: 'Certificate not trusted',
    ERR_CERT_DATE_INVALID: 'Certificate expired',
    ERR_TOO_MANY_REDIRECTS: 'Too many redirects',
    ERR_EMPTY_RESPONSE: 'Server returned no data',
    ERR_TUNNEL_CONNECTION_FAILED: 'Proxy tunnel failed',
    ERR_ADDRESS_UNREACHABLE: 'Address unreachable'
  }
  return map[description] ?? description.replace(/^ERR_/, '').replace(/_/g, ' ').toLowerCase()
}

export function DevicePane({
  paneId,
  active,
  isActivePane,
  loading,
  error,
  safariChromeEnabled = false,
  profileOverride,
  isSoloed = false,
  onToggleFocus,
  isLinked = true,
  onToggleLink,
  onShareWithAgent
}: DevicePaneProps): React.JSX.Element {
  const { zoom } = usePreviewCanvas()
  const { isTransitioning } = useSidebar()
  const profile = profileOverride ?? DEVICE_PRESETS[paneId]
  const dimensions = getMockupDimensions(paneId, profileOverride)
  const cornerRadius = getScaledScreenCornerRadius(paneId, zoom)
  const setBoundsRef = usePaneBounds(paneId, cornerRadius, active, profileOverride)

  const handleScreenshot = useCallback(() => {
    void window.api.savePaneScreenshot(paneId)
  }, [paneId])

  return (
    <div
      className="group/pane flex shrink-0 flex-col gap-2"
      style={{ width: dimensions.frameWidth }}
      data-testid={`device-pane-${paneId}`}
      data-pane-interactive
      data-pane-transitioning={isTransitioning ? 'true' : 'false'}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-1">
        <div className="min-w-0 flex items-center gap-2">
          <div
            className={cn('size-3 bg-white rounded-full opacity-40', isActivePane && 'opacity-100')}
          />

          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-medium text-muted-foreground">{profile.name}</p>
            <p className="text-xs text-muted-foreground/60">
              {profile.width}×{profile.height} @ {profile.deviceScaleFactor}x
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {loading ? (
            <Icon
              icon={Loading03Icon}
              className="size-4 shrink-0 animate-spin text-muted-foreground"
              data-testid={`pane-loading-${paneId}`}
            />
          ) : null}
          {(() => {
            const focusVisible = isActivePane && Boolean(onToggleFocus)
            return (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-testid={`pane-focus-${paneId}`}
                aria-label={isSoloed ? 'Show all devices' : 'Focus this device'}
                aria-pressed={isSoloed}
                aria-hidden={!focusVisible}
                tabIndex={focusVisible ? undefined : -1}
                title={isSoloed ? 'Show all devices' : 'Focus this device'}
                onClick={onToggleFocus}
                className={cn(
                  'shrink-0 transition-opacity duration-150 hover:[&_svg]:opacity-100',
                  !focusVisible && 'pointer-events-none opacity-0'
                )}
              >
                <Icon
                  icon={isSoloed ? Minimize01Icon : Maximize01Icon}
                  className={cn(
                    'transition-opacity duration-150',
                    isSoloed ? 'opacity-100' : 'opacity-50'
                  )}
                />
              </Button>
            )
          })()}
          {(() => {
            const linkVisible = isActivePane && Boolean(onToggleLink)
            return (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-testid={`pane-sync-${paneId}`}
                aria-label={
                  isLinked
                    ? 'Unlink this device from interaction sync'
                    : 'Link this device to interaction sync'
                }
                aria-pressed={isLinked}
                aria-hidden={!linkVisible}
                tabIndex={linkVisible ? undefined : -1}
                title={isLinked ? 'Linked — interactions mirror here' : 'Unlinked — independent'}
                onClick={onToggleLink}
                className={cn(
                  'shrink-0 transition-opacity duration-150 hover:[&_svg]:opacity-100',
                  !linkVisible && 'pointer-events-none opacity-0'
                )}
              >
                <Icon
                  icon={isLinked ? Link01Icon : Unlink01Icon}
                  className={cn(
                    'transition-opacity duration-150',
                    isLinked ? 'opacity-50' : 'opacity-100'
                  )}
                />
              </Button>
            )
          })()}
          {(() => {
            const screenshotVisible = isActivePane && active
            return (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-testid={`pane-screenshot-${paneId}`}
                aria-label="Save screenshot"
                aria-hidden={!screenshotVisible}
                tabIndex={screenshotVisible ? undefined : -1}
                disabled={loading}
                onClick={handleScreenshot}
                className={cn(
                  'shrink-0 transition-opacity duration-150 hover:[&_svg]:opacity-100',
                  !screenshotVisible && 'pointer-events-none opacity-0'
                )}
              >
                <Icon icon={Camera01Icon} className="opacity-50 transition-opacity duration-150" />
              </Button>
            )
          })()}
        </div>
      </div>

      <DeviceFrame
        paneId={paneId}
        profile={profile}
        screenRef={setBoundsRef}
        screenTestId={`pane-surface-${paneId}`}
        screenClassName={cn(loading && 'opacity-90')}
        frameClassName={cn('transition-opacity duration-200', isTransitioning && 'opacity-0')}
        showDynamicIsland={active && paneId === 'iphone' && !safariChromeEnabled}
      >
        {!active && !error ? (
          <div className="flex h-full items-center justify-center bg-zinc-950/90 px-6 text-center">
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-100">No screen loaded</p>
              <p className="text-xs leading-5 text-zinc-400">Enter a URL to open this preview.</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/95 px-6 text-center">
            <div className="space-y-3">
              <Icon icon={Alert01Icon} className="mx-auto size-8 text-red-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-100">
                  {friendlyErrorMessage(error.description)}
                </p>
                <p className="font-mono text-[10px] text-zinc-500">
                  {error.description} ({error.code})
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </DeviceFrame>

      {(() => {
        const shareVisible = isActivePane && active && Boolean(onShareWithAgent)
        return (
          <div className="flex shrink-0 justify-end px-1">
            <Button
              type="button"
              variant="ghost"
              size="tiny"
              data-testid={`pane-share-agent-${paneId}`}
              aria-label="Share this device with agent"
              aria-hidden={!shareVisible}
              tabIndex={shareVisible ? undefined : -1}
              onClick={onShareWithAgent}
              className={cn(
                'text-muted-foreground transition-opacity duration-150',
                !shareVisible && 'pointer-events-none opacity-0'
              )}
            >
              <Icon icon={Camera01Icon} />
              Share with agent
            </Button>
          </div>
        )
      })()}
    </div>
  )
}
