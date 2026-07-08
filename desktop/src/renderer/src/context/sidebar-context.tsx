import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import {
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_TRANSITION_MS
} from '../../../shared/sidebar'

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
  const sidebarRef = useRef<HTMLElement | null>(null)
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null)
  const transitionTimeoutRef = useRef<number | null>(null)

  const persistOpen = useCallback((open: boolean) => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open))
  }, [])

  const finishTransition = useCallback(() => {
    setIsTransitioning(false)
    void window.api.setPanesVisible(true)
    window.dispatchEvent(new Event(LAYOUT_SETTLED_EVENT))
  }, [])

  const startTransition = useCallback(
    (nextOpen: boolean) => {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current)
        transitionTimeoutRef.current = null
      }

      if (!nextOpen && sidebarRef.current?.contains(document.activeElement)) {
        toggleButtonRef.current?.focus()
      }

      setIsTransitioning(true)
      void window.api.setPanesVisible(false)
      setIsOpen(nextOpen)
      persistOpen(nextOpen)

      transitionTimeoutRef.current = window.setTimeout(() => {
        transitionTimeoutRef.current = null
        finishTransition()
      }, SIDEBAR_TRANSITION_MS)
    },
    [finishTransition, persistOpen]
  )

  const toggle = useCallback(() => {
    startTransition(!isOpen)
  }, [isOpen, startTransition])

  const setOpen = useCallback(
    (open: boolean) => {
      if (open === isOpen) return
      startTransition(open)
    },
    [isOpen, startTransition]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'b' || (!event.metaKey && !event.ctrlKey)) return
      event.preventDefault()
      toggle()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggle])

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current)
      }
    }
  }, [])

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isTransitioning,
        toggle,
        setOpen
      }}
    >
      <SidebarInternalsContext.Provider value={{ sidebarRef, toggleButtonRef }}>
        {children}
      </SidebarInternalsContext.Provider>
    </SidebarContext.Provider>
  )
}

interface SidebarInternals {
  sidebarRef: React.RefObject<HTMLElement | null>
  toggleButtonRef: React.RefObject<HTMLButtonElement | null>
}

const SidebarInternalsContext = createContext<SidebarInternals | null>(null)

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider')
  }
  return context
}

export function useSidebarInternals(): SidebarInternals {
  const context = useContext(SidebarInternalsContext)
  if (!context) {
    throw new Error('useSidebarInternals must be used within SidebarProvider')
  }
  return context
}
