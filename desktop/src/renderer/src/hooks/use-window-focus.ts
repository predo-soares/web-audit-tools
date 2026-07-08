import { useEffect, useState } from 'react'

export function useWindowFocus(): boolean {
  const [focused, setFocused] = useState(true)

  useEffect(() => {
    void window.api.isWindowFocused().then(setFocused)
    return window.api.onWindowFocusChanged(setFocused)
  }, [])

  return focused
}
