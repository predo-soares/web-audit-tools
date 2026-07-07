import { ipcMain } from 'electron'
import { normalizeUrl } from '../shared/url'
import type { PaneMount, PaneId } from '../shared/types'
import type { PaneManager } from './pane-manager'

export function registerIpcHandlers(paneManager: PaneManager): void {
  ipcMain.handle(
    'pane:mount',
    (_event, paneId: PaneId, mount: PaneMount) => {
      paneManager.mount(paneId, mount)
    }
  )

  ipcMain.handle('preview:navigate', async (_event, rawUrl: string) => {
    const url = normalizeUrl(rawUrl)
    await paneManager.navigateAll(url)
    return url
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

  ipcMain.on('pane:scroll', (_event, paneId: PaneId, ratio: number, programmatic: boolean) => {
    void paneManager.syncScroll(paneId, ratio, programmatic)
  })

  ipcMain.handle('pane:loading-states', () => {
    return paneManager.getLoadingStates()
  })

  ipcMain.handle('e2e:evaluate-in-pane', async (_event, paneId: PaneId, expression: string) => {
    return paneManager.evaluateInPane(paneId, expression)
  })
}
