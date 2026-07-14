import { contextBridge, ipcRenderer } from 'electron'
import type { HistoryEntry } from '../shared/history'
import type { PanelAction, PanelId, PanelOpenOptions } from '../shared/panel-types'
import type { NewProjectInput, Project } from '../shared/project'
import type { MirrorFailureLog } from '../shared/element-mirror'
import type { RuntimeEvidenceSnapshot } from '../shared/runtime-evidence'
import type {
  MediaFeatureState,
  PaneMount,
  PaneId,
  PaneNavigationState,
  ThemePreference
} from '../shared/types'
import type { SnapshotResult } from '../shared/snapshot'
import type { AuditRunResult, IndexingIntent } from '../shared/seo-audit'

export interface PreviewApi {
  closeWindow: () => Promise<void>
  minimizeWindow: () => Promise<void>
  toggleMaximizeWindow: () => Promise<void>
  isWindowFocused: () => Promise<boolean>
  isWindowFullscreen: () => Promise<boolean>
  onWindowFocusChanged: (callback: (focused: boolean) => void) => () => void
  onWindowFullscreenChanged: (callback: (fullscreen: boolean) => void) => () => void
  mountPane: (paneId: PaneId, mount: PaneMount) => Promise<void>
  navigate: (url: string) => Promise<string>
  reload: () => Promise<void>
  stopLoading: () => Promise<void>
  savePaneScreenshot: (paneId: PaneId) => Promise<{ saved: boolean; filePath?: string }>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  getNavigationState: () => Promise<PaneNavigationState>
  recreatePanes: () => Promise<void>
  setSyncEnabled: (enabled: boolean) => Promise<boolean>
  getSyncEnabled: () => Promise<boolean>
  setPaneThemePreference: (preference: ThemePreference) => Promise<ThemePreference>
  getMediaFeatures: () => Promise<MediaFeatureState>
  setMediaFeatures: (state: MediaFeatureState) => Promise<MediaFeatureState>
  getLoadingStates: () => Promise<Record<PaneId, boolean>>
  listHistory: () => Promise<HistoryEntry[]>
  deleteHistoryEntry: (url: string) => Promise<void>
  clearHistory: () => Promise<void>
  openPanel: (options: PanelOpenOptions) => Promise<void>
  closePanel: (panelId: PanelId) => Promise<void>
  getOpenPanels: () => Promise<PanelId[]>
  onPanelAction: (callback: (action: PanelAction) => void) => () => void
  onPanelClosed: (callback: (panelId: PanelId) => void) => () => void
  onPanelThemeChanged: (callback: (preference: ThemePreference) => void) => () => void
  onMediaFeaturesChanged: (callback: (state: MediaFeatureState) => void) => () => void
  onPanelTransition: (
    callback: (state: { panelId: PanelId; transitioning: boolean }) => void
  ) => () => void
  onPanelLayoutSettled: (callback: (panelId: PanelId) => void) => () => void
  onPanelFocusSidebarToggle: (callback: () => void) => () => void
  onPanelToggleSidebar: (callback: () => void) => () => void
  onPaneLoading: (callback: (state: { paneId: PaneId; loading: boolean }) => void) => () => void
  onPaneLoadError: (
    callback: (state: {
      paneId: PaneId
      error: { code: number; description: string } | null
    }) => void
  ) => () => void
  onPaneNavigation: (callback: (state: PaneNavigationState) => void) => () => void
  listProjects: () => Promise<Project[]>
  toggleProject: (input: NewProjectInput & { pageTitle: string }) => Promise<Project[]>
  onProjectsChanged: (callback: (projects: Project[]) => void) => () => void
  onHistoryUpdated: (callback: (entries: HistoryEntry[]) => void) => () => void
  evaluateInPane: <T>(paneId: PaneId, expression: string) => Promise<T>
  focusPane: (paneId: PaneId) => Promise<void>
  getMirrorFailureLogs: () => Promise<Record<PaneId, MirrorFailureLog[]>>
  getSyncTraceLogs: () => Promise<
    Array<{ ts: number; event: string; data?: Record<string, unknown> }>
  >
  getRuntimeEvidence: () => Promise<RuntimeEvidenceSnapshot>
  onRuntimeEvidenceChanged: (callback: (snapshot: RuntimeEvidenceSnapshot) => void) => () => void
  toggleDiagnosticsDrawer: () => void
  getDiagnosticsWidth: () => Promise<number>
  onDiagnosticsWidthChanged: (callback: (width: number) => void) => () => void
  takeSnapshot: () => Promise<SnapshotResult>
  getSafariChromeEnabled: () => Promise<boolean>
  onSafariChromeEnabledChanged: (callback: (enabled: boolean) => void) => () => void
  runSeoAudit: (indexingIntent: IndexingIntent) => Promise<AuditRunResult>
}

const api: PreviewApi = {
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
  mountPane: (paneId, mount) => ipcRenderer.invoke('pane:mount', paneId, mount),
  navigate: (url) => ipcRenderer.invoke('preview:navigate', url),
  reload: () => ipcRenderer.invoke('preview:reload'),
  stopLoading: () => ipcRenderer.invoke('preview:stop'),
  savePaneScreenshot: (paneId) => ipcRenderer.invoke('preview:screenshot', paneId),
  goBack: () => ipcRenderer.invoke('preview:go-back'),
  goForward: () => ipcRenderer.invoke('preview:go-forward'),
  getNavigationState: () => ipcRenderer.invoke('preview:navigation-state'),
  recreatePanes: () => ipcRenderer.invoke('pane:recreate-all'),
  setSyncEnabled: (enabled) => ipcRenderer.invoke('sync:set-enabled', enabled),
  getSyncEnabled: () => ipcRenderer.invoke('sync:get-enabled'),
  setPaneThemePreference: (preference) =>
    ipcRenderer.invoke('pane-theme:set-preference', preference),
  getMediaFeatures: () => ipcRenderer.invoke('media-features:get'),
  setMediaFeatures: (state) => ipcRenderer.invoke('media-features:set', state),
  getLoadingStates: () => ipcRenderer.invoke('pane:loading-states'),
  listHistory: () => ipcRenderer.invoke('history:list'),
  deleteHistoryEntry: (url) => ipcRenderer.invoke('history:delete', url),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  openPanel: (options) => ipcRenderer.invoke('panel:open', options),
  closePanel: (panelId) => ipcRenderer.invoke('panel:close', panelId),
  getOpenPanels: () => ipcRenderer.invoke('panel:get-open'),
  onPanelAction: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, action: PanelAction): void =>
      callback(action)
    ipcRenderer.on('panel:action', listener)
    return () => ipcRenderer.removeListener('panel:action', listener)
  },
  onPanelClosed: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, panelId: PanelId): void =>
      callback(panelId)
    ipcRenderer.on('panel:closed', listener)
    return () => ipcRenderer.removeListener('panel:closed', listener)
  },
  onPanelThemeChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, preference: ThemePreference): void =>
      callback(preference)
    ipcRenderer.on('panel:theme-changed', listener)
    return () => ipcRenderer.removeListener('panel:theme-changed', listener)
  },
  onMediaFeaturesChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: MediaFeatureState): void =>
      callback(state)
    ipcRenderer.on('panel:media-features-changed', listener)
    return () => ipcRenderer.removeListener('panel:media-features-changed', listener)
  },
  onPanelTransition: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { panelId: PanelId; transitioning: boolean }
    ): void => callback(state)
    ipcRenderer.on('panel:transition', listener)
    return () => ipcRenderer.removeListener('panel:transition', listener)
  },
  onPanelLayoutSettled: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, panelId: PanelId): void =>
      callback(panelId)
    ipcRenderer.on('panel:layout-settled', listener)
    return () => ipcRenderer.removeListener('panel:layout-settled', listener)
  },
  onPanelFocusSidebarToggle: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('panel:focus-sidebar-toggle', listener)
    return () => ipcRenderer.removeListener('panel:focus-sidebar-toggle', listener)
  },
  onPanelToggleSidebar: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('panel:toggle-sidebar', listener)
    return () => ipcRenderer.removeListener('panel:toggle-sidebar', listener)
  },
  onPaneLoading: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { paneId: PaneId; loading: boolean }
    ): void => callback(state)
    ipcRenderer.on('pane:loading', listener)
    return () => ipcRenderer.removeListener('pane:loading', listener)
  },
  onPaneLoadError: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { paneId: PaneId; error: { code: number; description: string } | null }
    ): void => callback(state)
    ipcRenderer.on('pane:load-error', listener)
    return () => ipcRenderer.removeListener('pane:load-error', listener)
  },
  onPaneNavigation: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: PaneNavigationState): void =>
      callback(state)
    ipcRenderer.on('pane:navigation', listener)
    return () => ipcRenderer.removeListener('pane:navigation', listener)
  },
  listProjects: () => ipcRenderer.invoke('projects:list'),
  toggleProject: (input) => ipcRenderer.invoke('projects:toggle', input),
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
    ipcRenderer.invoke('e2e:evaluate-in-pane', paneId, expression),
  focusPane: (paneId) => ipcRenderer.invoke('e2e:focus-pane', paneId),
  getMirrorFailureLogs: () => ipcRenderer.invoke('e2e:get-mirror-failure-logs'),
  getSyncTraceLogs: () => ipcRenderer.invoke('e2e:get-sync-trace-logs'),
  getRuntimeEvidence: () => ipcRenderer.invoke('runtime-evidence:get'),
  onRuntimeEvidenceChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: RuntimeEvidenceSnapshot): void =>
      callback(snapshot)
    ipcRenderer.on('runtime-evidence:changed', listener)
    return () => ipcRenderer.removeListener('runtime-evidence:changed', listener)
  },
  toggleDiagnosticsDrawer: () => {
    ipcRenderer.send('diagnostics:toggle')
  },
  getDiagnosticsWidth: () => ipcRenderer.invoke('panel:get-diagnostics-width'),
  onDiagnosticsWidthChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, width: number): void => callback(width)
    ipcRenderer.on('panel:diagnostics-width', listener)
    return () => ipcRenderer.removeListener('panel:diagnostics-width', listener)
  },
  takeSnapshot: () => ipcRenderer.invoke('snapshot:take'),
  getSafariChromeEnabled: () => ipcRenderer.invoke('safari-chrome:get-enabled'),
  onSafariChromeEnabledChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: boolean): void =>
      callback(enabled)
    ipcRenderer.on('safari-chrome:enabled-changed', listener)
    return () => ipcRenderer.removeListener('safari-chrome:enabled-changed', listener)
  },
  runSeoAudit: (indexingIntent) => ipcRenderer.invoke('seo-audit:run', indexingIntent)
}

contextBridge.exposeInMainWorld('api', api)
