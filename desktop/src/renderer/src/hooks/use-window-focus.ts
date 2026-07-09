import { useEffect, useState } from 'react'

interface WindowStateApi {
  isWindowFocused: () => Promise<boolean>
  onWindowFocusChanged: (callback: (focused: boolean) => void) => () => void
}

export function useWindowFocus(usePanelApi = false): boolean {
  const [focused, setFocused] = useState(true)
  const windowApi: WindowStateApi = usePanelApi ? window.panelApi : window.api

  useEffect(() => {
    void windowApi.isWindowFocused().then(setFocused)
    return windowApi.onWindowFocusChanged(setFocused)
  }, [windowApi])

  return focused
}
