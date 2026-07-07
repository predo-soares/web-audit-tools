import { contextBridge, ipcRenderer } from 'electron'
import type { PaneMount, PaneId, PaneNavigationState, ThemePreference } from '../shared/types'

export interface PreviewApi {
  closeWindow: () => Promise<void>
  minimizeWindow: () => Promise<void>
  toggleMaximizeWindow: () => Promise<void>
  mountPane: (paneId: PaneId, mount: PaneMount) => Promise<void>
  navigate: (url: string) => Promise<string>
  reload: () => Promise<void>
  getNavigationState: () => Promise<PaneNavigationState>
  recreatePanes: () => Promise<void>
  setScrollSyncEnabled: (enabled: boolean) => Promise<boolean>
  getScrollSyncEnabled: () => Promise<boolean>
  setPaneThemePreference: (preference: ThemePreference) => Promise<ThemePreference>
  getLoadingStates: () => Promise<Record<PaneId, boolean>>
  onPaneLoading: (callback: (state: { paneId: PaneId; loading: boolean }) => void) => () => void
  onPaneNavigation: (callback: (state: PaneNavigationState) => void) => () => void
  evaluateInPane: <T>(paneId: PaneId, expression: string) => Promise<T>
}

const api: PreviewApi = {
  closeWindow: () => ipcRenderer.invoke('window:close'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  mountPane: (paneId, mount) => ipcRenderer.invoke('pane:mount', paneId, mount),
  navigate: (url) => ipcRenderer.invoke('preview:navigate', url),
  reload: () => ipcRenderer.invoke('preview:reload'),
  getNavigationState: () => ipcRenderer.invoke('preview:navigation-state'),
  recreatePanes: () => ipcRenderer.invoke('pane:recreate-all'),
  setScrollSyncEnabled: (enabled) => ipcRenderer.invoke('scroll-sync:set-enabled', enabled),
  getScrollSyncEnabled: () => ipcRenderer.invoke('scroll-sync:get-enabled'),
  setPaneThemePreference: (preference) =>
    ipcRenderer.invoke('pane-theme:set-preference', preference),
  getLoadingStates: () => ipcRenderer.invoke('pane:loading-states'),
  onPaneLoading: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { paneId: PaneId; loading: boolean }
    ): void => callback(state)
    ipcRenderer.on('pane:loading', listener)
    return () => ipcRenderer.removeListener('pane:loading', listener)
  },
  onPaneNavigation: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: PaneNavigationState): void =>
      callback(state)
    ipcRenderer.on('pane:navigation', listener)
    return () => ipcRenderer.removeListener('pane:navigation', listener)
  },
  evaluateInPane: (paneId, expression) =>
    ipcRenderer.invoke('e2e:evaluate-in-pane', paneId, expression)
}

contextBridge.exposeInMainWorld('api', api)
