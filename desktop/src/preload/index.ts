import { contextBridge, ipcRenderer } from 'electron'
import type { HistoryEntry } from '../shared/history'
import type { PopoverAction, PopoverOpenOptions } from '../shared/popover-types'
import type { NewProjectInput, Project } from '../shared/project'
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
  setSyncEnabled: (enabled: boolean) => Promise<boolean>
  getSyncEnabled: () => Promise<boolean>
  setPaneThemePreference: (preference: ThemePreference) => Promise<ThemePreference>
  getLoadingStates: () => Promise<Record<PaneId, boolean>>
  setPanesVisible: (visible: boolean) => Promise<void>
  listHistory: () => Promise<HistoryEntry[]>
  deleteHistoryEntry: (url: string) => Promise<void>
  clearHistory: () => Promise<void>
  openNativePopover: (options: PopoverOpenOptions) => Promise<void>
  closeNativePopover: () => Promise<void>
  getOpenNativePopoverPanel: () => Promise<PopoverOpenOptions['panelId'] | null>
  onPopoverAction: (callback: (action: PopoverAction) => void) => () => void
  onPopoverClosed: (callback: () => void) => () => void
  onPopoverThemeChanged: (callback: (preference: ThemePreference) => void) => () => void
  onPaneLoading: (callback: (state: { paneId: PaneId; loading: boolean }) => void) => () => void
  onPaneNavigation: (callback: (state: PaneNavigationState) => void) => () => void
  listProjects: () => Promise<Project[]>
  addProject: (input: NewProjectInput & { pageTitle: string }) => Promise<Project>
  onProjectsChanged: (callback: (projects: Project[]) => void) => () => void
  onHistoryUpdated: (callback: (entries: HistoryEntry[]) => void) => () => void
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
  setSyncEnabled: (enabled) => ipcRenderer.invoke('sync:set-enabled', enabled),
  getSyncEnabled: () => ipcRenderer.invoke('sync:get-enabled'),
  setPaneThemePreference: (preference) =>
    ipcRenderer.invoke('pane-theme:set-preference', preference),
  getLoadingStates: () => ipcRenderer.invoke('pane:loading-states'),
  setPanesVisible: (visible) => ipcRenderer.invoke('pane:set-visible', visible),
  listHistory: () => ipcRenderer.invoke('history:list'),
  deleteHistoryEntry: (url) => ipcRenderer.invoke('history:delete', url),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  openNativePopover: (options) => ipcRenderer.invoke('popover:open', options),
  closeNativePopover: () => ipcRenderer.invoke('popover:close'),
  getOpenNativePopoverPanel: () => ipcRenderer.invoke('popover:get-open-panel'),
  onPopoverAction: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, action: PopoverAction): void =>
      callback(action)
    ipcRenderer.on('popover:action', listener)
    return () => ipcRenderer.removeListener('popover:action', listener)
  },
  onPopoverClosed: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('popover:closed', listener)
    return () => ipcRenderer.removeListener('popover:closed', listener)
  },
  onPopoverThemeChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, preference: ThemePreference): void =>
      callback(preference)
    ipcRenderer.on('popover:theme-changed', listener)
    return () => ipcRenderer.removeListener('popover:theme-changed', listener)
  },
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
  listProjects: () => ipcRenderer.invoke('projects:list'),
  addProject: (input) => ipcRenderer.invoke('projects:add', input),
  onProjectsChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, projects: Project[]): void =>
      callback(projects)
    ipcRenderer.on('projects:changed', listener)
    return () => ipcRenderer.removeListener('projects:changed', listener)
  },
  onHistoryUpdated: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, entries: HistoryEntry[]): void =>
      callback(entries)
    ipcRenderer.on('history:updated', listener)
    return () => ipcRenderer.removeListener('history:updated', listener)
  },
  evaluateInPane: (paneId, expression) =>
    ipcRenderer.invoke('e2e:evaluate-in-pane', paneId, expression)
}

contextBridge.exposeInMainWorld('api', api)
