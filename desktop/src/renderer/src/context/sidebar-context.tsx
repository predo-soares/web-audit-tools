import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { SIDEBAR_STORAGE_KEY, SIDEBAR_WIDTH_PX } from '../../../shared/sidebar'
import { matchesAppShortcut } from '../../../shared/shortcuts'
import { usePanel } from '@renderer/hooks/use-panel'

export const LAYOUT_SETTLED_EVENT = 'audit-screens:layout-settled'

function readStoredSidebarOpen(): boolean {
  const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
  if (stored === 'true') return true
  if (stored === 'false') return false
  return true
}

interface SidebarContextValue {
  isOpen: boolean
  isTransitioning: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(readStoredSidebarOpen)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const persistOpen = useCallback((open: boolean) => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open))
  }, [])

  usePanel('sidebar-left', {
    mode: 'docked',
    open: isOpen,
    edge: 'left',
    width: SIDEBAR_WIDTH_PX
  })

  useEffect(() => {
    const unsubscribeTransition = window.api.onPanelTransition((state) => {
      if (state.panelId !== 'sidebar-left') return
      setIsTransitioning(state.transitioning)
    })
    const unsubscribeSettled = window.api.onPanelLayoutSettled((panelId) => {
      if (panelId !== 'sidebar-left') return
      setIsTransitioning(false)
      window.dispatchEvent(new Event(LAYOUT_SETTLED_EVENT))
    })
    const unsubscribeClosed = window.api.onPanelClosed((panelId) => {
      if (panelId !== 'sidebar-left') return
      setIsOpen(false)
      persistOpen(false)
    })
    const unsubscribeToggle = window.api.onPanelToggleSidebar(() => {
      setIsOpen((current) => {
        const next = !current
        if (!next) {
          setIsTransitioning(true)
        }
        persistOpen(next)
        return next
      })
    })

    return () => {
      unsubscribeTransition()
      unsubscribeSettled()
      unsubscribeClosed()
      unsubscribeToggle()
    }
  }, [persistOpen])

  const toggle = useCallback(() => {
    setIsOpen((current) => {
      const next = !current
      if (!next) {
        setIsTransitioning(true)
      }
      persistOpen(next)
      return next
    })
  }, [persistOpen])

  const setOpen = useCallback(
    (open: boolean) => {
      setIsOpen((current) => {
        if (current === open) return current
        if (!open) {
          setIsTransitioning(true)
        }
        persistOpen(open)
        return open
      })
    },
    [persistOpen]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        !matchesAppShortcut('sidebar', {
          key: event.key,
          mod: event.metaKey || event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey
        })
      ) {
        return
      }
      event.preventDefault()
      toggle()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggle])

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isTransitioning,
        toggle,
        setOpen
      }}
    >
      <div
        data-testid="sidebar-state"
        data-sidebar-open={isOpen ? 'true' : 'false'}
        data-sidebar-transitioning={isTransitioning ? 'true' : 'false'}
        className="contents"
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider')
  }
  return context
}
