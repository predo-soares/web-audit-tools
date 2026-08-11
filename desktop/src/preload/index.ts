import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { HistoryEntry } from '../shared/history'
import type {
  PanelAction,
  PanelCloseOptions,
  PanelId,
  PanelOpenOptions
} from '../shared/panel-types'
import type { NewProjectInput, Project } from '../shared/project'
import type { MirrorFailureLog } from '../shared/element-mirror'
import type { InspectionState } from '../shared/inspection'
import type { RuntimeEvidenceSnapshot } from '../shared/runtime-evidence'
import type {
  DeviceProfile,
  MediaFeatureState,
  PaneMount,
  PaneId,
  PaneNavigationState,
  ThemePreference
} from '../shared/pane-types'
import type { SnapshotResult } from '../shared/snapshot'
import type {
  AuditJobState,
  AuditRunResult,
  IndexingIntent,
  LighthouseAssessmentState,
  LighthouseLabSelection
} from '../shared/seo-audit'
import type { McpServerStatus } from '../shared/mcp-status'
import type { WorkspaceView } from '../shared/sidebar'

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
  downloadMedia: (
    url: string,
    suggestedName?: string
  ) => Promise<{ saved: boolean; filePath?: string }>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  getNavigationState: () => Promise<PaneNavigationState>
  recreatePanes: () => Promise<void>
  setPaneLinked: (paneId: PaneId, linked: boolean) => Promise<PaneId[]>
  getLinkedPanes: () => Promise<PaneId[]>
  setPaneThemePreference: (preference: ThemePreference) => Promise<ThemePreference>
  getMediaFeatures: () => Promise<MediaFeatureState>
  setMediaFeatures: (state: MediaFeatureState) => Promise<MediaFeatureState>
  getLoadingStates: () => Promise<Record<PaneId, boolean>>
  listHistory: () => Promise<HistoryEntry[]>
  deleteHistoryEntry: (url: string) => Promise<void>
  clearHistory: () => Promise<void>
  openPanel: (options: PanelOpenOptions) => Promise<void>
  closePanel: (panelId: PanelId, options?: PanelCloseOptions) => Promise<void>
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
  takeSnapshot: (includeSeoAudit?: boolean) => Promise<SnapshotResult>
  shareDeviceWithAgent: (paneId: PaneId, includeSeoAudit?: boolean) => Promise<SnapshotResult>
  getSafariChromeEnabled: () => Promise<boolean>
  onSafariChromeEnabledChanged: (callback: (enabled: boolean) => void) => () => void
  runSeoAudit: (indexingIntent: IndexingIntent) => Promise<AuditRunResult>
  cancelSeoAudit: () => Promise<void>
  getSeoAuditState: () => Promise<AuditJobState>
  onSeoAuditState: (callback: (state: AuditJobState) => void) => () => void
  getLighthouseState: () => Promise<LighthouseAssessmentState>
  runLighthouse: (labSelection?: LighthouseLabSelection) => Promise<LighthouseAssessmentState>
  cancelLighthouse: () => Promise<void>
  onLighthouseState: (callback: (state: LighthouseAssessmentState) => void) => () => void
  onEnterPreviewView: (callback: () => void) => () => void
  onEnterSeoView: (callback: () => void) => () => void
  onEnterLighthouseView: (callback: () => void) => () => void
  onEnterDevicesView: (callback: () => void) => () => void
  onEnterSettingsView: (callback: () => void) => () => void
  setWorkspaceView: (view: WorkspaceView) => Promise<void>
  getMcpStatus: () => Promise<McpServerStatus>
  onMcpStatus: (callback: (status: McpServerStatus) => void) => () => void
  onToggleChrome: (callback: () => void) => () => void
  onExitChrome: (callback: () => void) => () => void
  setDeviceProfile: (paneId: PaneId, profile: DeviceProfile) => Promise<void>
  setPanesVisible: (visible: boolean) => Promise<void>
  setFocusedPane: (paneId: PaneId | null) => Promise<void>
  setInspectionMode: (enabled: boolean) => Promise<InspectionState>
  getInspectionState: () => Promise<InspectionState>
  onInspectionState: (callback: (state: InspectionState) => void) => () => void
  setChromeHidden: (hidden: boolean) => Promise<void>
}

const api: PreviewApi = {
  closeWindow: () => ipcRenderer.invoke(IPC.window.close),
  minimizeWindow: () => ipcRenderer.invoke(IPC.window.minimize),
  toggleMaximizeWindow: () => ipcRenderer.invoke(IPC.window.toggleMaximize),
  isWindowFocused: () => ipcRenderer.invoke(IPC.window.isFocused),
  isWindowFullscreen: () => ipcRenderer.invoke(IPC.window.isFullscreen),
  onWindowFocusChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, focused: boolean): void =>
      callback(focused)
    ipcRenderer.on(IPC.window.focusChanged, listener)
    return () => ipcRenderer.removeListener(IPC.window.focusChanged, listener)
  },
  onWindowFullscreenChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, fullscreen: boolean): void =>
      callback(fullscreen)
    ipcRenderer.on(IPC.window.fullscreenChanged, listener)
    return () => ipcRenderer.removeListener(IPC.window.fullscreenChanged, listener)
  },
  mountPane: (paneId, mount) => ipcRenderer.invoke(IPC.pane.mount, paneId, mount),
  navigate: (url) => ipcRenderer.invoke(IPC.preview.navigate, url),
  reload: () => ipcRenderer.invoke(IPC.preview.reload),
  stopLoading: () => ipcRenderer.invoke(IPC.preview.stop),
  savePaneScreenshot: (paneId) => ipcRenderer.invoke(IPC.preview.screenshot, paneId),
  downloadMedia: (url, suggestedName) =>
    ipcRenderer.invoke(IPC.media.download, { url, suggestedName }),
  goBack: () => ipcRenderer.invoke(IPC.preview.goBack),
  goForward: () => ipcRenderer.invoke(IPC.preview.goForward),
  getNavigationState: () => ipcRenderer.invoke(IPC.preview.navigationState),
  recreatePanes: () => ipcRenderer.invoke(IPC.pane.recreateAll),
  setPaneLinked: (paneId, linked) => ipcRenderer.invoke(IPC.sync.setPaneLinked, paneId, linked),
  getLinkedPanes: () => ipcRenderer.invoke(IPC.sync.getLinkedPanes),
  setPaneThemePreference: (preference) =>
    ipcRenderer.invoke(IPC.paneTheme.setPreference, preference),
  getMediaFeatures: () => ipcRenderer.invoke(IPC.mediaFeatures.get),
  setMediaFeatures: (state) => ipcRenderer.invoke(IPC.mediaFeatures.set, state),
  getLoadingStates: () => ipcRenderer.invoke(IPC.pane.loadingStates),
  listHistory: () => ipcRenderer.invoke(IPC.history.list),
  deleteHistoryEntry: (url) => ipcRenderer.invoke(IPC.history.delete, url),
  clearHistory: () => ipcRenderer.invoke(IPC.history.clear),
  openPanel: (options) => ipcRenderer.invoke(IPC.panel.open, options),
  closePanel: (panelId, options) => ipcRenderer.invoke(IPC.panel.close, panelId, options),
  getOpenPanels: () => ipcRenderer.invoke(IPC.panel.getOpen),
  onPanelAction: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, action: PanelAction): void =>
      callback(action)
    ipcRenderer.on(IPC.panel.action, listener)
    return () => ipcRenderer.removeListener(IPC.panel.action, listener)
  },
  onPanelClosed: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, panelId: PanelId): void =>
      callback(panelId)
    ipcRenderer.on(IPC.panel.closed, listener)
    return () => ipcRenderer.removeListener(IPC.panel.closed, listener)
  },
  onPanelThemeChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, preference: ThemePreference): void =>
      callback(preference)
    ipcRenderer.on(IPC.panel.themeChanged, listener)
    return () => ipcRenderer.removeListener(IPC.panel.themeChanged, listener)
  },
  onMediaFeaturesChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: MediaFeatureState): void =>
      callback(state)
    ipcRenderer.on(IPC.panel.mediaFeaturesChanged, listener)
    return () => ipcRenderer.removeListener(IPC.panel.mediaFeaturesChanged, listener)
  },
  onPanelTransition: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { panelId: PanelId; transitioning: boolean }
    ): void => callback(state)
    ipcRenderer.on(IPC.panel.transition, listener)
    return () => ipcRenderer.removeListener(IPC.panel.transition, listener)
  },
  onPanelLayoutSettled: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, panelId: PanelId): void =>
      callback(panelId)
    ipcRenderer.on(IPC.panel.layoutSettled, listener)
    return () => ipcRenderer.removeListener(IPC.panel.layoutSettled, listener)
  },
  onPanelFocusSidebarToggle: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.panel.focusSidebarToggle, listener)
    return () => ipcRenderer.removeListener(IPC.panel.focusSidebarToggle, listener)
  },
  onPanelToggleSidebar: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.panel.toggleSidebar, listener)
    return () => ipcRenderer.removeListener(IPC.panel.toggleSidebar, listener)
  },
  onPaneLoading: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { paneId: PaneId; loading: boolean }
    ): void => callback(state)
    ipcRenderer.on(IPC.pane.loading, listener)
    return () => ipcRenderer.removeListener(IPC.pane.loading, listener)
  },
  onPaneLoadError: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { paneId: PaneId; error: { code: number; description: string } | null }
    ): void => callback(state)
    ipcRenderer.on(IPC.pane.loadError, listener)
    return () => ipcRenderer.removeListener(IPC.pane.loadError, listener)
  },
  onPaneNavigation: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: PaneNavigationState): void =>
      callback(state)
    ipcRenderer.on(IPC.pane.navigation, listener)
    return () => ipcRenderer.removeListener(IPC.pane.navigation, listener)
  },
  listProjects: () => ipcRenderer.invoke(IPC.projects.list),
  toggleProject: (input) => ipcRenderer.invoke(IPC.projects.toggle, input),
  onProjectsChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, projects: Project[]): void =>
      callback(projects)
    ipcRenderer.on(IPC.projects.changed, listener)
    return () => ipcRenderer.removeListener(IPC.projects.changed, listener)
  },
  onHistoryUpdated: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, entries: HistoryEntry[]): void =>
      callback(entries)
    ipcRenderer.on(IPC.history.updated, listener)
    return () => ipcRenderer.removeListener(IPC.history.updated, listener)
  },
  evaluateInPane: (paneId, expression) =>
    ipcRenderer.invoke(IPC.e2e.evaluateInPane, paneId, expression),
  focusPane: (paneId) => ipcRenderer.invoke(IPC.e2e.focusPane, paneId),
  getMirrorFailureLogs: () => ipcRenderer.invoke(IPC.e2e.getMirrorFailureLogs),
  getSyncTraceLogs: () => ipcRenderer.invoke(IPC.e2e.getSyncTraceLogs),
  getRuntimeEvidence: () => ipcRenderer.invoke(IPC.runtimeEvidence.get),
  onRuntimeEvidenceChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: RuntimeEvidenceSnapshot): void =>
      callback(snapshot)
    ipcRenderer.on(IPC.runtimeEvidence.changed, listener)
    return () => ipcRenderer.removeListener(IPC.runtimeEvidence.changed, listener)
  },
  toggleDiagnosticsDrawer: () => {
    ipcRenderer.send(IPC.diagnostics.toggle)
  },
  getDiagnosticsWidth: () => ipcRenderer.invoke(IPC.panel.getDiagnosticsWidth),
  onDiagnosticsWidthChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, width: number): void => callback(width)
    ipcRenderer.on(IPC.panel.diagnosticsWidth, listener)
    return () => ipcRenderer.removeListener(IPC.panel.diagnosticsWidth, listener)
  },
  takeSnapshot: (includeSeoAudit = false) => ipcRenderer.invoke(IPC.snapshot.take, includeSeoAudit),
  shareDeviceWithAgent: (paneId, includeSeoAudit = false) =>
    ipcRenderer.invoke(IPC.snapshot.sharePane, paneId, includeSeoAudit),
  getSafariChromeEnabled: () => ipcRenderer.invoke(IPC.safariChrome.getEnabled),
  onSafariChromeEnabledChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: boolean): void =>
      callback(enabled)
    ipcRenderer.on(IPC.safariChrome.enabledChanged, listener)
    return () => ipcRenderer.removeListener(IPC.safariChrome.enabledChanged, listener)
  },
  runSeoAudit: (indexingIntent) => ipcRenderer.invoke(IPC.seoAudit.run, indexingIntent),
  cancelSeoAudit: () => ipcRenderer.invoke(IPC.seoAudit.cancel),
  getSeoAuditState: () => ipcRenderer.invoke(IPC.seoAudit.getState),
  onSeoAuditState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AuditJobState): void =>
      callback(state)
    ipcRenderer.on(IPC.seoAudit.state, listener)
    return () => ipcRenderer.removeListener(IPC.seoAudit.state, listener)
  },
  getLighthouseState: () => ipcRenderer.invoke(IPC.seoLighthouse.getState),
  runLighthouse: (labSelection) => ipcRenderer.invoke(IPC.seoLighthouse.run, labSelection),
  cancelLighthouse: () => ipcRenderer.invoke(IPC.seoLighthouse.cancel),
  onLighthouseState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: LighthouseAssessmentState): void =>
      callback(state)
    ipcRenderer.on(IPC.seoLighthouse.state, listener)
    return () => ipcRenderer.removeListener(IPC.seoLighthouse.state, listener)
  },
  onEnterPreviewView: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.app.previewView, listener)
    return () => ipcRenderer.removeListener(IPC.app.previewView, listener)
  },
  onEnterSeoView: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.app.seoView, listener)
    return () => ipcRenderer.removeListener(IPC.app.seoView, listener)
  },
  onEnterLighthouseView: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.app.lighthouseView, listener)
    return () => ipcRenderer.removeListener(IPC.app.lighthouseView, listener)
  },
  onEnterDevicesView: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.app.devicesView, listener)
    return () => ipcRenderer.removeListener(IPC.app.devicesView, listener)
  },
  onEnterSettingsView: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.app.settingsView, listener)
    return () => ipcRenderer.removeListener(IPC.app.settingsView, listener)
  },
  setWorkspaceView: (view) => ipcRenderer.invoke(IPC.app.setWorkspaceView, view),
  getMcpStatus: () => ipcRenderer.invoke(IPC.mcp.getStatus),
  onMcpStatus: (callback) => {
    const listener = (_event: unknown, status: McpServerStatus): void => callback(status)
    ipcRenderer.on(IPC.app.mcpStatus, listener)
    return () => ipcRenderer.removeListener(IPC.app.mcpStatus, listener)
  },
  onToggleChrome: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.app.toggleChrome, listener)
    return () => ipcRenderer.removeListener(IPC.app.toggleChrome, listener)
  },
  onExitChrome: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.app.exitChrome, listener)
    return () => ipcRenderer.removeListener(IPC.app.exitChrome, listener)
  },
  setDeviceProfile: (paneId, profile) =>
    ipcRenderer.invoke(IPC.pane.setDeviceProfile, paneId, profile),
  setPanesVisible: (visible) => ipcRenderer.invoke(IPC.pane.setVisible, visible),
  setFocusedPane: (paneId) => ipcRenderer.invoke(IPC.pane.setFocused, paneId),
  setInspectionMode: (enabled) => ipcRenderer.invoke(IPC.inspection.setMode, enabled),
  getInspectionState: () => ipcRenderer.invoke(IPC.inspection.getState),
  onInspectionState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: InspectionState): void =>
      callback(state)
    ipcRenderer.on(IPC.inspection.state, listener)
    return () => ipcRenderer.removeListener(IPC.inspection.state, listener)
  },
  setChromeHidden: (hidden) => ipcRenderer.invoke(IPC.chrome.setHidden, hidden)
}

contextBridge.exposeInMainWorld('api', api)
