import {
  CloseWindowIcon,
  ExpandWindowIcon,
  MinimizeWindowIcon
} from '@renderer/components/window-control-icons'
import { cn } from '@renderer/lib/utils'
import { useWindowFocus } from '@renderer/hooks/use-window-focus'
import { useEffect, useState } from 'react'

const controlBase =
  'relative flex size-3 shrink-0 items-center justify-center rounded-full transition-colors duration-150'

const iconBase =
  'pointer-events-none size-1.5 opacity-0 transition-opacity duration-100 group-hover/window-controls:opacity-100'

export function WindowControls({
  usePanelApi = false
}: {
  usePanelApi?: boolean
}): React.JSX.Element {
  const focused = useWindowFocus(usePanelApi)
  const [fullscreen, setFullscreen] = useState(false)
  const windowApi = usePanelApi ? window.panelApi : window.api

  useEffect(() => {
    void windowApi.isWindowFullscreen().then(setFullscreen)
    return windowApi.onWindowFullscreenChanged(setFullscreen)
  }, [windowApi])

  return (
    <div className="group/window-controls flex items-center gap-1.5" data-focused={focused}>
      <button
        type="button"
        data-testid="window-close"
        className={cn(
          controlBase,
          focused ? 'bg-[#FF0B18]' : 'bg-[#cecece] dark:bg-[#5c5c5c]'
        )}
        aria-label="Close window"
        onClick={() => void windowApi.closeWindow()}
      >
        <span className={iconBase}>
          <CloseWindowIcon />
        </span>
      </button>
      <button
        type="button"
        data-testid="window-minimize"
        className={cn(
          controlBase,
          focused ? 'bg-[#FFC700]' : 'bg-[#cecece] dark:bg-[#5c5c5c]'
        )}
        aria-label="Minimize window"
        onClick={() => void windowApi.minimizeWindow()}
      >
        <span className={iconBase}>
          <MinimizeWindowIcon />
        </span>
      </button>
      <button
        type="button"
        data-testid="window-expand"
        className={cn(
          controlBase,
          focused ? 'bg-[#00C847]' : 'bg-[#cecece] dark:bg-[#5c5c5c]'
        )}
        aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        onClick={() => void windowApi.toggleMaximizeWindow()}
      >
        <span className={iconBase}>
          <ExpandWindowIcon />
        </span>
      </button>
    </div>
  )
}
