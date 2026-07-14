import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { SEO_PANEL_WIDTH_PX } from '../../../shared/seo-audit'
import { LAYOUT_SETTLED_EVENT } from '@renderer/context/sidebar-context'

interface SeoPanelContextValue {
  isOpen: boolean
  isTransitioning: boolean
  width: number
}

const SeoPanelContext = createContext<SeoPanelContextValue | null>(null)

// The SEO panel is a fixed-width docked right panel. Unlike the diagnostics
// drawer it is not user-resizable, so the context only tracks open/transition
// state and reports the constant width the canvas must reserve.
export function SeoPanelProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    void window.api.getOpenPanels().then((openPanels) => {
      setIsOpen(openPanels.includes('seo-right'))
    })

    const unsubscribeTransition = window.api.onPanelTransition((state) => {
      if (state.panelId !== 'seo-right') return
      setIsTransitioning(state.transitioning)
    })
    const unsubscribeSettled = window.api.onPanelLayoutSettled((panelId) => {
      if (panelId !== 'seo-right') return
      setIsTransitioning(false)
      void window.api.getOpenPanels().then((openPanels) => {
        setIsOpen(openPanels.includes('seo-right'))
      })
      window.dispatchEvent(new Event(LAYOUT_SETTLED_EVENT))
    })
    const unsubscribeClosed = window.api.onPanelClosed((panelId) => {
      if (panelId !== 'seo-right') return
      setIsOpen(false)
      setIsTransitioning(false)
    })

    return () => {
      unsubscribeTransition()
      unsubscribeSettled()
      unsubscribeClosed()
    }
  }, [])

  return (
    <SeoPanelContext.Provider value={{ isOpen, isTransitioning, width: SEO_PANEL_WIDTH_PX }}>
      {children}
    </SeoPanelContext.Provider>
  )
}

export function useSeoPanel(): SeoPanelContextValue {
  const context = useContext(SeoPanelContext)
  if (!context) {
    throw new Error('useSeoPanel must be used within SeoPanelProvider')
  }
  return context
}
