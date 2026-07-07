import { BrowserWindow, ipcMain } from 'electron'
import { normalizeUrl } from '../shared/url'
import type { PaneMount, PaneId, ThemePreference } from '../shared/types'
import type { PaneManager } from './pane-manager'

export function registerIpcHandlers(paneManager: PaneManager): void {
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

  ipcMain.handle('scroll-sync:set-enabled', (_event, enabled: boolean) => {
    paneManager.setScrollSyncEnabled(enabled)
    return paneManager.isScrollSyncEnabled()
  })

  ipcMain.handle('scroll-sync:get-enabled', () => {
    return paneManager.isScrollSyncEnabled()
  })

  ipcMain.handle('pane-theme:set-preference', async (_event, preference: ThemePreference) => {
    await paneManager.setThemePreference(preference)
    return preference
  })

  ipcMain.on('pane:scroll', (_event, paneId: PaneId, ratio: number, programmatic: boolean) => {
    void paneManager.syncScroll(paneId, ratio, programmatic)
  })

  ipcMain.on('pane:click', (_event, paneId: PaneId, relX: number, relY: number) => {
    paneManager.syncClick(paneId, relX, relY)
  })

  ipcMain.handle('pane:loading-states', () => {
    return paneManager.getLoadingStates()
  })

  ipcMain.handle('e2e:evaluate-in-pane', async (_event, paneId: PaneId, expression: string) => {
    return paneManager.evaluateInPane(paneId, expression)
  })
}
