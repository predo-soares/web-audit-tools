import { contextBridge, ipcRenderer } from 'electron'
import type { PaneMount, PaneId } from '../shared/types'

export interface PreviewApi {
  mountPane: (paneId: PaneId, mount: PaneMount) => Promise<void>
  navigate: (url: string) => Promise<string>
  recreatePanes: () => Promise<void>
  setScrollSyncEnabled: (enabled: boolean) => Promise<boolean>
  getScrollSyncEnabled: () => Promise<boolean>
  getLoadingStates: () => Promise<Record<PaneId, boolean>>
  onPaneLoading: (callback: (state: { paneId: PaneId; loading: boolean }) => void) => () => void
  evaluateInPane: <T>(paneId: PaneId, expression: string) => Promise<T>
}

const api: PreviewApi = {
  mountPane: (paneId, mount) =>
    ipcRenderer.invoke('pane:mount', paneId, mount),
  navigate: (url) => ipcRenderer.invoke('preview:navigate', url),
  recreatePanes: () => ipcRenderer.invoke('pane:recreate-all'),
  setScrollSyncEnabled: (enabled) => ipcRenderer.invoke('scroll-sync:set-enabled', enabled),
  getScrollSyncEnabled: () => ipcRenderer.invoke('scroll-sync:get-enabled'),
  getLoadingStates: () => ipcRenderer.invoke('pane:loading-states'),
  onPaneLoading: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: { paneId: PaneId; loading: boolean }) =>
      callback(state)
    ipcRenderer.on('pane:loading', listener)
    return () => ipcRenderer.removeListener('pane:loading', listener)
  },
  evaluateInPane: (paneId, expression) => ipcRenderer.invoke('e2e:evaluate-in-pane', paneId, expression)
}

contextBridge.exposeInMainWorld('api', api)
