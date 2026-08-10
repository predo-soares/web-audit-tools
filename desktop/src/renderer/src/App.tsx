import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeviceProfile, PaneId, PaneLoadError } from '../../shared/types'
import { PANE_IDS } from '../../shared/device-presets'
import {
  CATALOG_BY_PRESET,
  DEFAULT_PRESET_IDS,
  type CatalogEntry
} from '../../shared/device-catalog'
import { isCommittedPageUrl } from '../../shared/project'
import { PreviewCanvas } from '@renderer/components/preview-canvas'
import { SeoView } from '@renderer/components/seo'
import { DevicesView } from '@renderer/components/devices-view'
import { LighthouseView } from '@renderer/components/lighthouse'
import { SettingsView } from '@renderer/components/settings-view'
import { ToolbarProvider } from '@renderer/context/toolbar-context'
import { DiagnosticsProvider } from '@renderer/context/diagnostics-context'
import { SidebarProvider } from '@renderer/context/sidebar-context'
import { matchesAppShortcut } from '../../shared/shortcuts'
import type { WorkspaceView } from '../../shared/sidebar'

function catalogEntryToProfile(entry: CatalogEntry): DeviceProfile {
  return {
    id: entry.paneId,
    name: entry.name,
    width: entry.width,
    height: entry.height,
    deviceScaleFactor: entry.deviceScaleFactor,
    touch: entry.touch,
    userAgent: entry.userAgent
  }
}

// selectedPresets: for each enabled pane, which presetId is active
type SelectedPresets = Partial<Record<PaneId, string>>

const DEFAULT_SELECTED: SelectedPresets = {
  iphone: DEFAULT_PRESET_IDS.iphone,
  ipad: DEFAULT_PRESET_IDS.ipad,
  desktop: DEFAULT_PRESET_IDS.desktop
}

export default function App(): React.JSX.Element {
  const [loadingStates, setLoadingStates] = useState<Record<PaneId, boolean>>({
    iphone: false,
    ipad: false,
    desktop: false
  })
  const [errorStates, setErrorStates] = useState<Record<PaneId, PaneLoadError | null>>({
    iphone: null,
    ipad: null,
    desktop: null
  })
  const [activePane, setActivePane] = useState<PaneId | null>(null)
  const [committedUrl, setCommittedUrl] = useState('')
  const [safariChromeEnabled, setSafariChromeEnabled] = useState(false)
  const [workspace, setWorkspace] = useState<WorkspaceView>('browser')
  const [selectedPresets, setSelectedPresets] = useState<SelectedPresets>(DEFAULT_SELECTED)
  // When set, the canvas shows only this pane; other devices are hidden. This is a
  // transient view concern layered on top of selectedPresets, not a selection change.
  const [focusedPane, setFocusedPane] = useState<PaneId | null>(null)
  // Immersive mode: hides the toolbar/sidebar/diagnostics chrome so only the
  // device canvas is visible. Only meaningful in the browser workspace.
  const [chromeHidden, setChromeHidden] = useState(false)
  // Tracks the last committed URL so we only react to genuine navigations, not
  // repeated nav-state updates (title changes, etc.) that carry the same URL.
  const lastCommittedUrlRef = useRef('')
  // Set when a navigation is initiated from within a full-screen view's own URL
  // bar or a panel history/project action, so the pane navigation that follows
  // keeps the user in that view instead of returning them to the device canvas.
  const suppressCanvasReturnRef = useRef(false)
  // Read by IPC callbacks whose effect runs once; keeps them off stale closures.
  const workspaceRef = useRef(workspace)
  const chromeHiddenRef = useRef(chromeHidden)
  useEffect(() => {
    workspaceRef.current = workspace
    chromeHiddenRef.current = chromeHidden
  }, [workspace, chromeHidden])

  useEffect(() => {
    const unsubscribePanelAction = window.api.onPanelAction((action) => {
      if (action.type === 'navigate' && workspaceRef.current !== 'browser') {
        suppressCanvasReturnRef.current = true
      }
    })
    return unsubscribePanelAction
  }, [])

  // Mirror the active workspace to the toolbar panel so it can hide the URL bar
  // and page-scoped controls outside the browser view.
  useEffect(() => {
    void window.api.setWorkspaceView(workspace)
  }, [workspace])

  const applyChromeHidden = useCallback((hidden: boolean): void => {
    setChromeHidden(hidden)
    void window.api.setChromeHidden(hidden)
  }, [])

  // A real URL change returns the user to the device canvas (browser workspace).
  const returnToDeviceCanvasOnNavigate = (barUrl: string): void => {
    if (!isCommittedPageUrl(barUrl)) return
    // A navigation the user triggered from a full-screen view's own bar should
    // not eject them from that view. Consume the flag even on a no-op re-visit
    // so it never lingers into a later, unrelated navigation.
    const suppressed = suppressCanvasReturnRef.current
    suppressCanvasReturnRef.current = false
    if (barUrl === lastCommittedUrlRef.current) return
    lastCommittedUrlRef.current = barUrl
    if (suppressed) return
    setWorkspace((current) => {
      if (current === 'browser') return current
      void window.api.setPanesVisible(true)
      return 'browser'
    })
  }

  const visiblePanes: PaneId[] = PANE_IDS.filter((id) => selectedPresets[id] !== undefined)
  // A valid focus narrows the canvas to a single pane; otherwise show every
  // selected pane. Focusing is only meaningful when more than one pane is visible.
  const canFocusPanes = visiblePanes.length > 1
  const activeFocusPane = focusedPane && visiblePanes.includes(focusedPane) ? focusedPane : null
  const effectiveVisiblePanes: PaneId[] = activeFocusPane ? [activeFocusPane] : visiblePanes

  const handleToggleFocus = (paneId: PaneId): void => {
    const next = activeFocusPane === paneId ? null : paneId
    setFocusedPane(next)
    // The main process hides the other panes' native views; the renderer only
    // controls which placeholders lay out.
    void window.api.setFocusedPane(next)
  }

  const paneProfiles: Partial<Record<PaneId, DeviceProfile>> = Object.fromEntries(
    (Object.entries(selectedPresets) as [PaneId, string][])
      .map(([paneId, presetId]) => {
        const entry = CATALOG_BY_PRESET[presetId]
        return entry ? [paneId, catalogEntryToProfile(entry)] : null
      })
      .filter(Boolean) as [PaneId, DeviceProfile][]
  )

  const handleTogglePreset = async (presetId: string): Promise<void> => {
    const entry = CATALOG_BY_PRESET[presetId]
    if (!entry) return
    const { paneId } = entry

    const currentPresetId = selectedPresets[paneId]
    const isEnabled = currentPresetId !== undefined
    const isSamePreset = currentPresetId === presetId
    const isLastPane = visiblePanes.length === 1 && isEnabled && isSamePreset

    if (isLastPane) return // keep at least one pane visible

    let next: SelectedPresets

    if (isEnabled && isSamePreset) {
      // deselect this pane entirely
      next = { ...selectedPresets }
      delete next[paneId]
      // A deselected pane can't stay focused, or the canvas would show nothing.
      if (focusedPane === paneId) {
        setFocusedPane(null)
        void window.api.setFocusedPane(null)
      }
    } else {
      // enable pane with this preset (or switch to different preset in same pane)
      const profile = catalogEntryToProfile(entry)
      await window.api.setDeviceProfile(paneId, profile)
      next = { ...selectedPresets, [paneId]: presetId }
    }

    setSelectedPresets(next)
  }

  useEffect(() => {
    void window.api.getLoadingStates().then(setLoadingStates)
    void window.api.getSafariChromeEnabled().then(setSafariChromeEnabled)
    void window.api.getNavigationState().then((state) => {
      setActivePane(state.activePane)
      if (isCommittedPageUrl(state.barUrl)) {
        setCommittedUrl(state.barUrl)
        lastCommittedUrlRef.current = state.barUrl
      }
    })

    const unsubscribeLoading = window.api.onPaneLoading(({ paneId, loading }) => {
      setLoadingStates((current) => ({ ...current, [paneId]: loading }))
    })
    const unsubscribeLoadError = window.api.onPaneLoadError(({ paneId, error }) => {
      setErrorStates((current) => ({ ...current, [paneId]: error }))
    })
    const unsubscribeNavigation = window.api.onPaneNavigation((state) => {
      setActivePane(state.activePane)
      returnToDeviceCanvasOnNavigate(state.barUrl)
      if (isCommittedPageUrl(state.barUrl)) {
        setCommittedUrl(state.barUrl)
      }
    })
    const unsubscribeSafariChrome = window.api.onSafariChromeEnabledChanged(setSafariChromeEnabled)
    const showWorkspace = (next: WorkspaceView): void => {
      setWorkspace((current) => {
        if (current === next) return current
        void window.api.setPanesVisible(next === 'browser')
        return next
      })
    }
    const unsubscribePreviewView = window.api.onEnterPreviewView(() => showWorkspace('browser'))
    const unsubscribeSeoView = window.api.onEnterSeoView(() => showWorkspace('seo'))
    const unsubscribeLighthouseView = window.api.onEnterLighthouseView(() =>
      showWorkspace('lighthouse')
    )
    const unsubscribeDevicesView = window.api.onEnterDevicesView(() => showWorkspace('devices'))
    const unsubscribeSettingsView = window.api.onEnterSettingsView(() => showWorkspace('settings'))

    return () => {
      unsubscribeLoading()
      unsubscribeLoadError()
      unsubscribeNavigation()
      unsubscribeSafariChrome()
      unsubscribePreviewView()
      unsubscribeSeoView()
      unsubscribeLighthouseView()
      unsubscribeDevicesView()
      unsubscribeSettingsView()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        void window.api.closePanel('zoom')
      }

      const input = {
        key: event.key,
        mod: event.metaKey || event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey
      }

      if (matchesAppShortcut('back', input)) {
        event.preventDefault()
        void window.api.goBack()
      } else if (matchesAppShortcut('forward', input)) {
        event.preventDefault()
        void window.api.goForward()
      } else if (matchesAppShortcut('diagnostics', input)) {
        event.preventDefault()
        window.api.toggleDiagnosticsDrawer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Immersive-mode toggles arrive from the main process (Cmd+Shift+H / Escape,
  // routed regardless of focus) and the toolbar button. Only the device canvas
  // supports it; other workspaces render their own full-screen chrome.
  useEffect(() => {
    const unsubscribeToggle = window.api.onToggleChrome(() => {
      if (workspaceRef.current !== 'browser') return
      applyChromeHidden(!chromeHiddenRef.current)
    })
    const unsubscribeExit = window.api.onExitChrome(() => {
      if (chromeHiddenRef.current) applyChromeHidden(false)
    })
    return () => {
      unsubscribeToggle()
      unsubscribeExit()
    }
  }, [applyChromeHidden])

  return (
    <SidebarProvider>
      <DiagnosticsProvider>
        <ToolbarProvider>
          {workspace === 'seo' ? (
            <SeoView
              onClose={() => {
                setWorkspace('browser')
                void window.api.setPanesVisible(true)
              }}
              onTargetNavigate={() => {
                suppressCanvasReturnRef.current = true
              }}
            />
          ) : workspace === 'lighthouse' ? (
            <LighthouseView
              onTargetNavigate={() => {
                suppressCanvasReturnRef.current = true
              }}
            />
          ) : workspace === 'settings' ? (
            <SettingsView />
          ) : workspace === 'devices' ? (
            <DevicesView
              selectedPresets={selectedPresets}
              onTogglePreset={(id) => void handleTogglePreset(id)}
            />
          ) : (
            <PreviewCanvas
              loadingStates={loadingStates}
              errorStates={errorStates}
              committedUrl={committedUrl}
              activePane={activePane}
              safariChromeEnabled={safariChromeEnabled}
              visiblePanes={effectiveVisiblePanes}
              paneProfiles={paneProfiles}
              canFocus={canFocusPanes}
              focusedPane={activeFocusPane}
              onToggleFocus={handleToggleFocus}
              chromeHidden={chromeHidden}
            />
          )}
        </ToolbarProvider>
      </DiagnosticsProvider>
    </SidebarProvider>
  )
}
