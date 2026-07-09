import { contextBridge, ipcRenderer } from 'electron'
import type { HistoryEntry } from '../shared/history'
import type {
  PanelAction,
  PanelId,
  PanelOpenOptions,
  PanelPlacement,
  PanelShowMessage
} from '../shared/panel-types'
import type { NewProjectInput, Project } from '../shared/project'
import type { PaneId, PaneNavigationState, Size, ThemePreference } from '../shared/types'
import type { RuntimeEvidenceChannel, RuntimeEvidenceSnapshot } from '../shared/runtime-evidence'

export interface PanelOverlayApi {
  onShow: (callback: (message: PanelShowMessage) => void) => () => void
  onHide: (callback: () => void) => () => void
  onPlacement: (callback: (placement: PanelPlacement) => void) => () => void
  reportSize: (size: Size) => void
  reportExitComplete: () => void
  sendAction: (action: PanelAction) => void
  reportFocusOnClose: () => void
  reportReady: () => void
  listProjects: () => Promise<Project[]>
  listHistory: () => Promise<HistoryEntry[]>
  getNavigationState: () => Promise<PaneNavigationState>
  navigate: (url: string) => Promise<string>
  reload: () => Promise<void>
  stopLoading: () => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  deleteHistoryEntry: (url: string) => Promise<void>
  clearHistory: () => Promise<void>
  toggleProject: (input: NewProjectInput & { pageTitle: string }) => Promise<Project[]>
  getLoadingStates: () => Promise<Record<PaneId, boolean>>
  getSyncEnabled: () => Promise<boolean>
  setSyncEnabled: (enabled: boolean) => Promise<boolean>
  setPaneThemePreference: (preference: ThemePreference) => Promise<ThemePreference>
  openPanel: (options: PanelOpenOptions) => Promise<void>
  closePanel: (panelId: PanelId) => Promise<void>
  getOpenPanels: () => Promise<PanelId[]>
  closeWindow: () => Promise<void>
  minimizeWindow: () => Promise<void>
  toggleMaximizeWindow: () => Promise<void>
  isWindowFocused: () => Promise<boolean>
  isWindowFullscreen: () => Promise<boolean>
  onWindowFocusChanged: (callback: (focused: boolean) => void) => () => void
  onWindowFullscreenChanged: (callback: (fullscreen: boolean) => void) => () => void
  onProjectsChanged: (callback: (projects: Project[]) => void) => () => void
  onHistoryUpdated: (callback: (entries: HistoryEntry[]) => void) => () => void
  onPaneNavigation: (callback: (state: PaneNavigationState) => void) => () => void
  onPaneLoading: (callback: (state: { paneId: PaneId; loading: boolean }) => void) => () => void
  onPanelAction: (callback: (action: PanelAction) => void) => () => void
  onPanelThemeChanged: (callback: (preference: ThemePreference) => void) => () => void
  onPanelClosed: (callback: (panelId: PanelId) => void) => () => void
  onPanelLayoutSettled: (callback: (panelId: PanelId) => void) => () => void
  onFocusSidebarToggle: (callback: () => void) => () => void
  getRuntimeEvidence: () => Promise<RuntimeEvidenceSnapshot>
  clearRuntimeEvidence: (channel: RuntimeEvidenceChannel) => Promise<RuntimeEvidenceSnapshot>
  onRuntimeEvidenceChanged: (callback: (snapshot: RuntimeEvidenceSnapshot) => void) => () => void
}

const panelApi: PanelOverlayApi = {
  onShow: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, message: PanelShowMessage): void =>
      callback(message)
    ipcRenderer.on('panel:show', listener)
    return () => ipcRenderer.removeListener('panel:show', listener)
  },
  onHide: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('panel:hide', listener)
    return () => ipcRenderer.removeListener('panel:hide', listener)
  },
  onPlacement: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, placement: PanelPlacement): void =>
      callback(placement)
    ipcRenderer.on('panel:placement', listener)
    return () => ipcRenderer.removeListener('panel:placement', listener)
  },
  reportSize: (size) => {
    ipcRenderer.send('panel:size', size)
  },
  reportExitComplete: () => {
    ipcRenderer.send('panel:exit-complete')
  },
  sendAction: (action) => {
    ipcRenderer.send('panel:action', action)
  },
  reportFocusOnClose: () => {
    ipcRenderer.send('panel:focus-on-close')
  },
  reportReady: () => {
    ipcRenderer.send('panel:ready')
  },
  listProjects: () => ipcRenderer.invoke('projects:list'),
  listHistory: () => ipcRenderer.invoke('history:list'),
  getNavigationState: () => ipcRenderer.invoke('preview:navigation-state'),
  navigate: (url) => ipcRenderer.invoke('preview:navigate', url),
  reload: () => ipcRenderer.invoke('preview:reload'),
  stopLoading: () => ipcRenderer.invoke('preview:stop'),
  goBack: () => ipcRenderer.invoke('preview:go-back'),
  goForward: () => ipcRenderer.invoke('preview:go-forward'),
  deleteHistoryEntry: (url) => ipcRenderer.invoke('history:delete', url),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  toggleProject: (input) => ipcRenderer.invoke('projects:toggle', input),
  getLoadingStates: () => ipcRenderer.invoke('pane:loading-states'),
  getSyncEnabled: () => ipcRenderer.invoke('sync:get-enabled'),
  setSyncEnabled: (enabled) => ipcRenderer.invoke('sync:set-enabled', enabled),
  setPaneThemePreference: (preference) =>
    ipcRenderer.invoke('pane-theme:set-preference', preference),
  openPanel: (options) => ipcRenderer.invoke('panel:open', options),
  closePanel: (panelId) => ipcRenderer.invoke('panel:close', panelId),
  getOpenPanels: () => ipcRenderer.invoke('panel:get-open'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  isWindowFocused: () => ipcRenderer.invoke('window:is-focused'),
  isWindowFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  onWindowFocusChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, focused: boolean): void =>
      callback(focused)
    ipcRenderer.on('window:focus-changed', listener)
    return () => ipcRenderer.removeListener('window:focus-changed', listener)
  },
  onWindowFullscreenChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, fullscreen: boolean): void =>
      callback(fullscreen)
    ipcRenderer.on('window:fullscreen-changed', listener)
    return () => ipcRenderer.removeListener('window:fullscreen-changed', listener)
  },
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
  onPaneNavigation: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: PaneNavigationState): void =>
      callback(state)
    ipcRenderer.on('pane:navigation', listener)
    return () => ipcRenderer.removeListener('pane:navigation', listener)
  },
  onPaneLoading: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { paneId: PaneId; loading: boolean }
    ): void => callback(state)
    ipcRenderer.on('pane:loading', listener)
    return () => ipcRenderer.removeListener('pane:loading', listener)
  },
  onPanelAction: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, action: PanelAction): void =>
      callback(action)
    ipcRenderer.on('panel:action', listener)
    return () => ipcRenderer.removeListener('panel:action', listener)
  },
  onPanelThemeChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, preference: ThemePreference): void =>
      callback(preference)
    ipcRenderer.on('panel:theme-changed', listener)
    return () => ipcRenderer.removeListener('panel:theme-changed', listener)
  },
  onPanelClosed: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, panelId: PanelId): void =>
      callback(panelId)
    ipcRenderer.on('panel:closed', listener)
    return () => ipcRenderer.removeListener('panel:closed', listener)
  },
  onPanelLayoutSettled: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, panelId: PanelId): void =>
      callback(panelId)
    ipcRenderer.on('panel:layout-settled', listener)
    return () => ipcRenderer.removeListener('panel:layout-settled', listener)
  },
  onFocusSidebarToggle: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('panel:focus-sidebar-toggle', listener)
    return () => ipcRenderer.removeListener('panel:focus-sidebar-toggle', listener)
  },
  getRuntimeEvidence: () => ipcRenderer.invoke('runtime-evidence:get'),
  clearRuntimeEvidence: (channel) => ipcRenderer.invoke('runtime-evidence:clear', channel),
  onRuntimeEvidenceChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: RuntimeEvidenceSnapshot): void =>
      callback(snapshot)
    ipcRenderer.on('runtime-evidence:changed', listener)
    return () => ipcRenderer.removeListener('runtime-evidence:changed', listener)
  }
}

contextBridge.exposeInMainWorld('panelApi', panelApi)
