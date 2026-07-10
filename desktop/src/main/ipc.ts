import { BrowserWindow, ipcMain } from 'electron'
import { normalizeUrl } from '../shared/url'
import type { ElementFingerprint } from '../shared/element-mirror'
import type { NewProjectInput } from '../shared/project'
import type { PanelAction, PanelId, PanelOpenOptions } from '../shared/panel-types'
import type { PaneMount, PaneId, Size, ThemePreference } from '../shared/types'
import type { PaneManager } from './panes/pane-manager'
import type { PanelManager } from './panels/panel-manager'
import type { HistoryStore } from './stores/history-store'
import type { ProjectStore } from './stores/project-store'
import { captureSnapshot, type SnapshotPort } from './services/snapshot-service'

export function makeSnapshotPort(paneManager: PaneManager): SnapshotPort {
  return {
    isAnyPaneLoading: () => paneManager.isAnyPaneLoading(),
    getActivePaneId: () => paneManager.getNavigationState().activePane,
    getActivePaneUrl: () => paneManager.getNavigationState().barUrl || null,
    getActivePaneTitle: () => paneManager.getNavigationState().pageTitle,
    getLastNavTimestamp: (paneId) => paneManager.getLastNavTimestamp(paneId),
    getRuntimeEvidenceSnapshot: () => paneManager.getRuntimeEvidenceSnapshot(),
    captureActivePaneScreenshot: () => paneManager.captureActivePaneScreenshot(),
    getDevContext: () => paneManager.getDevContext()
  }
}

export function registerIpcHandlers(
  paneManager: PaneManager,
  panelManager: PanelManager,
  projectStore: ProjectStore,
  historyStore: HistoryStore
): void {
  ipcMain.handle('snapshot:take', async () => {
    return captureSnapshot(makeSnapshotPort(paneManager))
  })

  ipcMain.on('diagnostics:toggle', () => {
    panelManager.notifyToolbarPanel('panel:toggle-diagnostics')
  })

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    if (window.isFullScreen()) {
      window.setFullScreen(false)
    } else {
      window.setFullScreen(true)
    }
  })

  ipcMain.handle('window:is-focused', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isFocused() ?? false
  })

  ipcMain.handle('window:is-fullscreen', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false
  })

  ipcMain.handle('pane:mount', (_event, paneId: PaneId, mount: PaneMount) => {
    paneManager.mount(paneId, mount)
  })

  ipcMain.handle('preview:navigate', async (_event, rawUrl: string) => {
    const url = normalizeUrl(rawUrl)
    await paneManager.navigateAll(url)
    return url
  })

  ipcMain.handle('preview:navigation-state', () => {
    return paneManager.getNavigationState()
  })

  ipcMain.handle('preview:reload', async () => {
    await paneManager.reloadAll()
  })

  ipcMain.handle('preview:stop', () => {
    paneManager.stopLoadingAll()
  })

  ipcMain.handle('preview:screenshot', async (event, paneId: PaneId) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    if (!parentWindow) {
      return { saved: false }
    }
    return paneManager.savePaneScreenshot(paneId, parentWindow)
  })

  ipcMain.handle('preview:go-back', async () => {
    await paneManager.goBack()
  })

  ipcMain.handle('preview:go-forward', async () => {
    await paneManager.goForward()
  })

  ipcMain.handle('pane:recreate-all', async () => {
    await paneManager.recreateAll()
  })

  ipcMain.handle('sync:set-enabled', (_event, enabled: boolean) => {
    paneManager.setSyncEnabled(enabled)
    return paneManager.isSyncEnabled()
  })

  ipcMain.handle('sync:get-enabled', () => {
    return paneManager.isSyncEnabled()
  })

  ipcMain.handle('pane-theme:set-preference', async (_event, preference: ThemePreference) => {
    await paneManager.setThemePreference(preference)
    return preference
  })

  ipcMain.on('pane:scroll', (_event, paneId: PaneId, ratio: number, programmatic: boolean) => {
    void paneManager.syncScroll(paneId, ratio, programmatic)
  })

  ipcMain.on('pane:click', (_event, paneId: PaneId, fingerprint: ElementFingerprint) => {
    void paneManager.syncClick(paneId, fingerprint)
  })

  ipcMain.on('pane:value', (_event, paneId: PaneId, fingerprint: ElementFingerprint, value: string) => {
    void paneManager.syncValue(paneId, fingerprint, value)
  })

  ipcMain.on(
    'pane:select',
    (
      _event,
      paneId: PaneId,
      fingerprint: ElementFingerprint,
      value: string,
      selectedIndex: number
    ) => {
      void paneManager.syncSelectValue(paneId, fingerprint, value, selectedIndex)
    }
  )

  ipcMain.on('pane:submit', (_event, paneId: PaneId, fingerprint: ElementFingerprint) => {
    void paneManager.syncSubmit(paneId, fingerprint)
  })

  ipcMain.handle('pane:loading-states', () => {
    return paneManager.getLoadingStates()
  })

  ipcMain.handle('runtime-evidence:get', () => {
    return paneManager.getRuntimeEvidenceSnapshot()
  })

  ipcMain.handle('runtime-evidence:clear', (_event, channel: 'console' | 'network') => {
    return paneManager.clearRuntimeEvidence(channel)
  })

  ipcMain.handle('panel:open', async (_event, options: PanelOpenOptions) => {
    await panelManager.open(options)
  })

  ipcMain.handle('panel:close', (_event, panelId: PanelId) => {
    panelManager.close(panelId)
  })

  ipcMain.handle('panel:get-open', () => {
    return panelManager.getOpenPanelIds()
  })

  ipcMain.handle('panel:get-diagnostics-width', () => {
    return panelManager.getDiagnosticsWidth()
  })

  ipcMain.on(
    'panel:docked-resize',
    (event, width: number, phase: 'preview' | 'commit') => {
      const panelId = panelManager.getPanelIdForWebContents(event.sender)
      if (!panelId) return
      panelManager.handleDockedResize(panelId, width, phase)
    }
  )

  ipcMain.on('panel:size', (event, size: Size) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleSizeReport(panelId, size)
  })

  ipcMain.on('panel:exit-complete', (event) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleExitComplete(panelId)
  })

  ipcMain.on('panel:focus-on-close', (event) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleFocusOnClose(panelId)
  })

  ipcMain.on('panel:ready', (event) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleRendererReady(panelId)
  })

  ipcMain.on('panel:action', (event, action: PanelAction) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return

    if (action.type === 'set-zoom' || action.type === 'set-theme' || action.type === 'fit-zoom') {
      void panelManager.handleAction(panelId, action)
      return
    }

    if (action.type === 'toggle-sidebar') {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('panel:toggle-sidebar')
      }
      return
    }

    if (action.type === 'toggle-diagnostics') {
      panelManager.notifyToolbarPanel('panel:toggle-diagnostics')
      return
    }

    if (action.type === 'go-back') {
      void paneManager.goBack()
      return
    }

    if (action.type === 'go-forward') {
      void paneManager.goForward()
      return
    }

    if (action.type === 'reload') {
      void paneManager.reloadAll()
      return
    }

    if (action.type === 'stop-loading') {
      paneManager.stopLoadingAll()
      return
    }

    if (action.type === 'set-sync-enabled') {
      paneManager.setSyncEnabled(action.enabled)
      return
    }

    if (action.type === 'navigate') {
      void paneManager.navigateAll(normalizeUrl(action.url))
      return
    }

    if (action.type === 'delete-history') {
      historyStore.remove(action.url)
      return
    }

    if (action.type === 'clear-history') {
      historyStore.clear()
      return
    }

    if (action.type === 'toggle-project') {
      projectStore.toggle(
        {
          name: action.name,
          url: action.url,
          faviconUrl: action.faviconUrl
        },
        action.pageTitle
      )
    }
  })

  ipcMain.handle('history:list', () => {
    return historyStore.list()
  })

  ipcMain.handle('history:delete', (_event, url: string) => {
    historyStore.remove(url)
  })

  ipcMain.handle('history:clear', () => {
    historyStore.clear()
  })

  ipcMain.handle('e2e:evaluate-in-pane', async (_event, paneId: PaneId, expression: string) => {
    return paneManager.evaluateInPane(paneId, expression)
  })

  ipcMain.handle('e2e:focus-pane', (_event, paneId: PaneId) => {
    paneManager.focusPane(paneId)
  })

  ipcMain.handle('e2e:get-mirror-failure-logs', () => {
    return paneManager.getMirrorFailureLogs()
  })

  ipcMain.handle('e2e:get-sync-trace-logs', () => {
    return paneManager.getSyncTraceLogs()
  })

  ipcMain.handle('projects:list', () => {
    return projectStore.list()
  })

  ipcMain.handle(
    'projects:toggle',
    (_event, input: NewProjectInput & { pageTitle: string }) => {
      const { pageTitle, ...projectInput } = input
      return projectStore.toggle(projectInput, pageTitle)
    }
  )
}
