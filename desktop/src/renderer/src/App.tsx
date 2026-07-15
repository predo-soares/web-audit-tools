import { useEffect, useState } from 'react'
import type { DeviceProfile, PaneId, PaneLoadError } from '../../shared/types'
import { PANE_IDS } from '../../shared/device-presets'
import { CATALOG_BY_PRESET, DEFAULT_PRESET_IDS, type CatalogEntry } from '../../shared/device-catalog'
import { isCommittedPageUrl } from '../../shared/project'
import { PreviewCanvas } from '@renderer/components/preview-canvas'
import { SeoView } from '@renderer/components/seo-view'
import { DevicesView } from '@renderer/components/devices-view'
import { ToolbarProvider } from '@renderer/context/toolbar-context'
import { DiagnosticsProvider } from '@renderer/context/diagnostics-context'
import { SidebarProvider } from '@renderer/context/sidebar-context'

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
  const [seoViewOpen, setSeoViewOpen] = useState(false)
  const [devicesViewOpen, setDevicesViewOpen] = useState(false)
  const [selectedPresets, setSelectedPresets] = useState<SelectedPresets>(DEFAULT_SELECTED)

  const visiblePanes: PaneId[] = PANE_IDS.filter((id) => selectedPresets[id] !== undefined)

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
      if (isCommittedPageUrl(state.barUrl)) {
        setCommittedUrl(state.barUrl)
      }
    })
    const unsubscribeSafariChrome = window.api.onSafariChromeEnabledChanged(setSafariChromeEnabled)
    const unsubscribeSeoView = window.api.onEnterSeoView(() => {
      setSeoViewOpen((v) => {
        const next = !v
        void window.api.setPanesVisible(!next)
        return next
      })
    })
    const unsubscribeDevicesView = window.api.onEnterDevicesView(() => {
      setDevicesViewOpen((v) => {
        const next = !v
        void window.api.setPanesVisible(!next)
        return next
      })
    })

    return () => {
      unsubscribeLoading()
      unsubscribeLoadError()
      unsubscribeNavigation()
      unsubscribeSafariChrome()
      unsubscribeSeoView()
      unsubscribeDevicesView()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        void window.api.closePanel('zoom')
      }

      if (!event.metaKey && !event.ctrlKey) return

      if (event.key === '[') {
        event.preventDefault()
        void window.api.goBack()
      } else if (event.key === ']') {
        event.preventDefault()
        void window.api.goForward()
      } else if (event.key === 'j') {
        event.preventDefault()
        window.api.toggleDiagnosticsDrawer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <SidebarProvider>
      <DiagnosticsProvider>
          <ToolbarProvider>
            {seoViewOpen ? (
              <SeoView onClose={() => {
                setSeoViewOpen(false)
                void window.api.setPanesVisible(true)
              }} />
            ) : devicesViewOpen ? (
              <DevicesView
                selectedPresets={selectedPresets}
                onTogglePreset={(id) => void handleTogglePreset(id)}
                onClose={() => {
                  setDevicesViewOpen(false)
                  void window.api.setPanesVisible(true)
                }}
              />
            ) : (
              <PreviewCanvas
                loadingStates={loadingStates}
                errorStates={errorStates}
                committedUrl={committedUrl}
                activePane={activePane}
                safariChromeEnabled={safariChromeEnabled}
                visiblePanes={visiblePanes}
                paneProfiles={paneProfiles}
              />
            )}
          </ToolbarProvider>
      </DiagnosticsProvider>
    </SidebarProvider>
  )
}
