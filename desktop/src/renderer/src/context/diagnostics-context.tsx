import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import { LAYOUT_SETTLED_EVENT } from '@renderer/context/sidebar-context'

interface DiagnosticsContextValue {
  isOpen: boolean
  isTransitioning: boolean
}

const DiagnosticsContext = createContext<DiagnosticsContextValue | null>(null)

export function DiagnosticsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    void window.api.getOpenPanels().then((openPanels) => {
      setIsOpen(openPanels.includes('diagnostics-right'))
    })

    const unsubscribeTransition = window.api.onPanelTransition((state) => {
      if (state.panelId !== 'diagnostics-right') return
      setIsTransitioning(state.transitioning)
    })
    const unsubscribeSettled = window.api.onPanelLayoutSettled((panelId) => {
      if (panelId !== 'diagnostics-right') return
      setIsTransitioning(false)
      void window.api.getOpenPanels().then((openPanels) => {
        setIsOpen(openPanels.includes('diagnostics-right'))
      })
      window.dispatchEvent(new Event(LAYOUT_SETTLED_EVENT))
    })
    const unsubscribeClosed = window.api.onPanelClosed((panelId) => {
      if (panelId !== 'diagnostics-right') return
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
    <DiagnosticsContext.Provider
      value={{
        isOpen,
        isTransitioning
      }}
    >
      {children}
    </DiagnosticsContext.Provider>
  )
}

export function useDiagnostics(): DiagnosticsContextValue {
  const context = useContext(DiagnosticsContext)
  if (!context) {
    throw new Error('useDiagnostics must be used within DiagnosticsProvider')
  }
  return context
}
