import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import { readStoredDiagnosticsWidth, writeStoredDiagnosticsWidth } from '../../../shared/diagnostics-width'
import { DIAGNOSTICS_DRAWER_WIDTH_PX } from '../../../shared/runtime-evidence'
import { LAYOUT_SETTLED_EVENT } from '@renderer/context/sidebar-context'

interface DiagnosticsContextValue {
  isOpen: boolean
  isTransitioning: boolean
  width: number
}

const DiagnosticsContext = createContext<DiagnosticsContextValue | null>(null)

export function DiagnosticsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [width, setWidth] = useState(readStoredDiagnosticsWidth)

  useEffect(() => {
    void window.api.getDiagnosticsWidth().then((width) => {
      setWidth(width > 0 ? width : DIAGNOSTICS_DRAWER_WIDTH_PX)
    })

    void window.api.getOpenPanels().then((openPanels) => {
      setIsOpen(openPanels.includes('diagnostics-right'))
    })

    const unsubscribeWidth = window.api.onDiagnosticsWidthChanged((nextWidth) => {
      setWidth(nextWidth)
      writeStoredDiagnosticsWidth(nextWidth)
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
      unsubscribeWidth()
      unsubscribeTransition()
      unsubscribeSettled()
      unsubscribeClosed()
    }
  }, [])

  return (
    <DiagnosticsContext.Provider
      value={{
        isOpen,
        isTransitioning,
        width
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
