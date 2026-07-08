import { BrowserWindow, ipcMain } from 'electron'
import { normalizeUrl } from '../shared/url'
import type { ElementFingerprint } from '../shared/element-fingerprint'
import type { NewProjectInput } from '../shared/project'
import type { PopoverAction, PopoverOpenOptions } from '../shared/popover-types'
import type { PaneMount, PaneId, Size, ThemePreference } from '../shared/types'
import type { PaneManager } from './pane-manager'
import type { PopoverManager } from './popover-manager'
import type { HistoryStore } from './history-store'
import type { ProjectStore } from './project-store'

export function registerIpcHandlers(
  paneManager: PaneManager,
  popoverManager: PopoverManager,
  projectStore: ProjectStore,
  historyStore: HistoryStore
): void {
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

  ipcMain.handle('pane:loading-states', () => {
    return paneManager.getLoadingStates()
  })

  ipcMain.handle('pane:set-visible', (_event, visible: boolean) => {
    paneManager.setPanesVisible(visible)
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

  ipcMain.handle('popover:open', async (_event, options: PopoverOpenOptions) => {
    await popoverManager.open(options)
  })

  ipcMain.handle('popover:close', () => {
    popoverManager.close()
  })

  ipcMain.handle('popover:get-open-panel', () => {
    return popoverManager.getOpenPanelId()
  })

  ipcMain.on('popover:size', (event, size: Size) => {
    if (!popoverManager.isOverlayWebContents(event.sender)) return
    popoverManager.handleSizeReport(size)
  })

  ipcMain.on('popover:action', (event, action: PopoverAction) => {
    if (!popoverManager.isOverlayWebContents(event.sender)) return
    void popoverManager.handleAction(action)
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
