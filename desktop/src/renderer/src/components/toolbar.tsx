import { Toggle } from '@renderer/components/ui/toggle'
import { Button } from '@renderer/components/ui/button'
import { usePreviewCanvas } from '@renderer/context/preview-canvas-context'
import { clampZoom, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from '../../../shared/mockup-layout'
import { Link2, Minus, Plus, RefreshCw, RotateCcw } from 'lucide-react'

interface ToolbarProps {
  scrollSyncEnabled: boolean
  onScrollSyncChange: (enabled: boolean) => void
}

export function Toolbar({
  scrollSyncEnabled,
  onScrollSyncChange
}: ToolbarProps): React.JSX.Element {
  const { zoom, webviewScale, setZoomCentered, adjustZoom, setWebviewScale } = usePreviewCanvas()
  const zoomPercent = Math.round(zoom * 100)
  const webviewScalePercent = Math.round(webviewScale * 100)

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Zoom</span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          data-testid="zoom-out"
          aria-label="Zoom out"
          onClick={() => adjustZoom(-ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
        >
          <Minus />
        </Button>
        <input
          data-testid="zoom-slider"
          type="range"
          min={MIN_ZOOM * 100}
          max={MAX_ZOOM * 100}
          step={ZOOM_STEP * 100}
          value={zoomPercent}
          onChange={(event) => setZoomCentered(clampZoom(Number(event.target.value) / 100))}
          className="h-1.5 w-24 cursor-pointer accent-foreground"
          aria-label="Zoom level"
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          data-testid="zoom-in"
          aria-label="Zoom in"
          onClick={() => adjustZoom(ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
        >
          <Plus />
        </Button>
        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground" data-testid="zoom-value">
          {zoomPercent}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Webview scale</span>
        <input
          data-testid="webview-scale-slider"
          type="range"
          min={25}
          max={175}
          step={5}
          value={webviewScalePercent}
          onChange={(event) => setWebviewScale(Number(event.target.value) / 100)}
          className="h-1.5 w-24 cursor-pointer accent-foreground"
          aria-label="Webview scale"
        />
        <span
          className="w-10 text-right text-xs tabular-nums text-muted-foreground"
          data-testid="webview-scale-value"
        >
          {webviewScalePercent}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          data-testid="webview-scale-reset"
          aria-label="Reset webview scale"
          onClick={() => setWebviewScale(1)}
          disabled={webviewScale === 1}
        >
          <RotateCcw />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="webview-recreate"
          onClick={() => void window.api.recreatePanes()}
        >
          <RefreshCw />
          Recreate
        </Button>
      </div>
      <Toggle
        data-testid="scroll-sync-toggle"
        pressed={scrollSyncEnabled}
        onPressedChange={onScrollSyncChange}
        variant="outline"
        aria-label="Toggle scroll sync"
      >
        <Link2 />
        Scroll sync
      </Toggle>
    </div>
  )
}
