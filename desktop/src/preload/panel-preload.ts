import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { HistoryEntry } from '../shared/history'
import type { DevContext } from '../shared/dev-context'
import type {
  PanelAction,
  PanelCloseOptions,
  PanelId,
  PanelOpenOptions,
  PanelPlacement,
  PanelShowMessage
} from '../shared/panel-types'
import type { NewProjectInput, Project } from '../shared/project'
import type {
  MediaFeatureState,
  PaneId,
  PaneNavigationState,
  Size,
  ThemePreference
} from '../shared/pane-types'
import type {
  RuntimeEvidenceChannel,
  RuntimeEvidenceProblemCount,
  RuntimeEvidenceSnapshot
} from '../shared/runtime-evidence'
import type { ApplicationData } from '../shared/application-data'
import type { SnapshotResult } from '../shared/snapshot'
import type {
  AuditJobState,
  AuditRunResult,
  IndexingIntent,
  LighthouseAssessmentState,
  LighthouseLabSelection
} from '../shared/seo-audit'
import type { WorkspaceView } from '../shared/sidebar'
import type { InspectionMarkupNode, InspectionState } from '../shared/inspection'

export interface PanelOverlayApi {
  onShow: (callback: (message: PanelShowMessage) => void) => () => void
  onHide: (callback: () => void) => () => void
  onTransition: (
    callback: (state: { panelId: PanelId; transitioning: boolean }) => void
  ) => () => void
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
  getSafariChromeEnabled: () => Promise<boolean>
  setSafariChromeEnabled: (enabled: boolean) => Promise<boolean>
  setPaneThemePreference: (preference: ThemePreference) => Promise<ThemePreference>
  getMediaFeatures: () => Promise<MediaFeatureState>
  setMediaFeatures: (state: MediaFeatureState) => Promise<MediaFeatureState>
  openPanel: (options: PanelOpenOptions) => Promise<void>
  closePanel: (panelId: PanelId, options?: PanelCloseOptions) => Promise<void>
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
  onMediaFeaturesChanged: (callback: (state: MediaFeatureState) => void) => () => void
  onPanelClosed: (callback: (panelId: PanelId) => void) => () => void
  onPanelLayoutSettled: (callback: (panelId: PanelId) => void) => () => void
  onFocusSidebarToggle: (callback: () => void) => () => void
  onToggleDiagnostics: (callback: () => void) => () => void
  getWorkspaceView: () => Promise<WorkspaceView>
  onWorkspaceViewChanged: (callback: (view: WorkspaceView) => void) => () => void
  getRuntimeEvidence: () => Promise<RuntimeEvidenceSnapshot>
  clearRuntimeEvidence: (channel: RuntimeEvidenceChannel) => Promise<RuntimeEvidenceSnapshot>
  getApplicationData: () => Promise<ApplicationData>
  getDevContext: () => Promise<DevContext | null>
  openExternalUrl: (url: string) => Promise<void>
  onRuntimeEvidenceChanged: (callback: (snapshot: RuntimeEvidenceSnapshot) => void) => () => void
  onRuntimeEvidenceProblemCount: (
    callback: (payload: RuntimeEvidenceProblemCount) => void
  ) => () => void
  getDiagnosticsWidth: () => Promise<number>
  resizeDockedPanel: (width: number, phase: 'preview' | 'commit') => void
  onDiagnosticsWidthChanged: (callback: (width: number) => void) => () => void
  onInspectionState: (callback: (state: InspectionState) => void) => () => void
  getInspectionState: () => Promise<InspectionState>
  loadInspectionMarkupChildren: (paneId: PaneId, nodeId: string) => Promise<InspectionMarkupNode[]>
  takeSnapshot: (includeSeoAudit?: boolean) => Promise<SnapshotResult>
  onSnapshotTaken: (callback: (result: SnapshotResult) => void) => () => void
  onSafariChromeEnabledChanged: (callback: (enabled: boolean) => void) => () => void
  runSeoAudit: (indexingIntent: IndexingIntent) => Promise<AuditRunResult>
  cancelSeoAudit: () => Promise<void>
  getSeoAuditState: () => Promise<AuditJobState>
  onSeoAuditState: (callback: (state: AuditJobState) => void) => () => void
  getLighthouseState: () => Promise<LighthouseAssessmentState>
  runLighthouse: (labSelection?: LighthouseLabSelection) => Promise<LighthouseAssessmentState>
  cancelLighthouse: () => Promise<void>
  onLighthouseState: (callback: (state: LighthouseAssessmentState) => void) => () => void
}

const panelApi: PanelOverlayApi = {
  onShow: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, message: PanelShowMessage): void =>
      callback(message)
    ipcRenderer.on(IPC.panel.show, listener)
    return () => ipcRenderer.removeListener(IPC.panel.show, listener)
  },
  onHide: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.panel.hide, listener)
    return () => ipcRenderer.removeListener(IPC.panel.hide, listener)
  },
  onTransition: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { panelId: PanelId; transitioning: boolean }
    ): void => callback(state)
    ipcRenderer.on(IPC.panel.transition, listener)
    return () => ipcRenderer.removeListener(IPC.panel.transition, listener)
  },
  onPlacement: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, placement: PanelPlacement): void =>
      callback(placement)
    ipcRenderer.on(IPC.panel.placement, listener)
    return () => ipcRenderer.removeListener(IPC.panel.placement, listener)
  },
  reportSize: (size) => {
    ipcRenderer.send(IPC.panel.size, size)
  },
  reportExitComplete: () => {
    ipcRenderer.send(IPC.panel.exitComplete)
  },
  sendAction: (action) => {
    ipcRenderer.send(IPC.panel.action, action)
  },
  reportFocusOnClose: () => {
    ipcRenderer.send(IPC.panel.focusOnClose)
  },
  reportReady: () => {
    ipcRenderer.send(IPC.panel.ready)
  },
  listProjects: () => ipcRenderer.invoke(IPC.projects.list),
  listHistory: () => ipcRenderer.invoke(IPC.history.list),
  getNavigationState: () => ipcRenderer.invoke(IPC.preview.navigationState),
  navigate: (url) => ipcRenderer.invoke(IPC.preview.navigate, url),
  reload: () => ipcRenderer.invoke(IPC.preview.reload),
  stopLoading: () => ipcRenderer.invoke(IPC.preview.stop),
  goBack: () => ipcRenderer.invoke(IPC.preview.goBack),
  goForward: () => ipcRenderer.invoke(IPC.preview.goForward),
  deleteHistoryEntry: (url) => ipcRenderer.invoke(IPC.history.delete, url),
  clearHistory: () => ipcRenderer.invoke(IPC.history.clear),
  toggleProject: (input) => ipcRenderer.invoke(IPC.projects.toggle, input),
  getLoadingStates: () => ipcRenderer.invoke(IPC.pane.loadingStates),
  getSafariChromeEnabled: () => ipcRenderer.invoke(IPC.safariChrome.getEnabled),
  setSafariChromeEnabled: (enabled) => ipcRenderer.invoke(IPC.safariChrome.setEnabled, enabled),
  setPaneThemePreference: (preference) =>
    ipcRenderer.invoke(IPC.paneTheme.setPreference, preference),
  getMediaFeatures: () => ipcRenderer.invoke(IPC.mediaFeatures.get),
  setMediaFeatures: (state) => ipcRenderer.invoke(IPC.mediaFeatures.set, state),
  openPanel: (options) => ipcRenderer.invoke(IPC.panel.open, options),
  closePanel: (panelId, options) => ipcRenderer.invoke(IPC.panel.close, panelId, options),
  getOpenPanels: () => ipcRenderer.invoke(IPC.panel.getOpen),
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
  onPaneNavigation: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: PaneNavigationState): void =>
      callback(state)
    ipcRenderer.on(IPC.pane.navigation, listener)
    return () => ipcRenderer.removeListener(IPC.pane.navigation, listener)
  },
  onPaneLoading: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { paneId: PaneId; loading: boolean }
    ): void => callback(state)
    ipcRenderer.on(IPC.pane.loading, listener)
    return () => ipcRenderer.removeListener(IPC.pane.loading, listener)
  },
  onPanelAction: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, action: PanelAction): void =>
      callback(action)
    ipcRenderer.on(IPC.panel.action, listener)
    return () => ipcRenderer.removeListener(IPC.panel.action, listener)
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
  onPanelClosed: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, panelId: PanelId): void =>
      callback(panelId)
    ipcRenderer.on(IPC.panel.closed, listener)
    return () => ipcRenderer.removeListener(IPC.panel.closed, listener)
  },
  onPanelLayoutSettled: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, panelId: PanelId): void =>
      callback(panelId)
    ipcRenderer.on(IPC.panel.layoutSettled, listener)
    return () => ipcRenderer.removeListener(IPC.panel.layoutSettled, listener)
  },
  onFocusSidebarToggle: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.panel.focusSidebarToggle, listener)
    return () => ipcRenderer.removeListener(IPC.panel.focusSidebarToggle, listener)
  },
  onToggleDiagnostics: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.panel.toggleDiagnostics, listener)
    return () => ipcRenderer.removeListener(IPC.panel.toggleDiagnostics, listener)
  },
  getWorkspaceView: () => ipcRenderer.invoke(IPC.app.getWorkspaceView),
  onWorkspaceViewChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, view: WorkspaceView): void =>
      callback(view)
    ipcRenderer.on(IPC.workspace.viewChanged, listener)
    return () => ipcRenderer.removeListener(IPC.workspace.viewChanged, listener)
  },
  getRuntimeEvidence: () => ipcRenderer.invoke(IPC.runtimeEvidence.get),
  clearRuntimeEvidence: (channel) => ipcRenderer.invoke(IPC.runtimeEvidence.clear, channel),
  getApplicationData: () => ipcRenderer.invoke(IPC.application.getData),
  getDevContext: () => ipcRenderer.invoke(IPC.devContext.get),
  openExternalUrl: (url) => ipcRenderer.invoke(IPC.url.openExternal, url),
  onRuntimeEvidenceChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: RuntimeEvidenceSnapshot): void =>
      callback(snapshot)
    ipcRenderer.on(IPC.runtimeEvidence.changed, listener)
    return () => ipcRenderer.removeListener(IPC.runtimeEvidence.changed, listener)
  },
  onRuntimeEvidenceProblemCount: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: RuntimeEvidenceProblemCount
    ): void => callback(payload)
    ipcRenderer.on(IPC.runtimeEvidence.problemCount, listener)
    return () => ipcRenderer.removeListener(IPC.runtimeEvidence.problemCount, listener)
  },
  getDiagnosticsWidth: () => ipcRenderer.invoke(IPC.panel.getDiagnosticsWidth),
  resizeDockedPanel: (width, phase) => {
    ipcRenderer.send(IPC.panel.dockedResize, width, phase)
  },
  onDiagnosticsWidthChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, width: number): void => callback(width)
    ipcRenderer.on(IPC.panel.diagnosticsWidth, listener)
    return () => ipcRenderer.removeListener(IPC.panel.diagnosticsWidth, listener)
  },
  onInspectionState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: InspectionState): void =>
      callback(state)
    ipcRenderer.on(IPC.inspection.state, listener)
    return () => ipcRenderer.removeListener(IPC.inspection.state, listener)
  },
  getInspectionState: () => ipcRenderer.invoke(IPC.inspection.getState),
  loadInspectionMarkupChildren: (paneId, nodeId) =>
    ipcRenderer.invoke(IPC.inspection.markupChildren, paneId, nodeId),
  takeSnapshot: (includeSeoAudit = false) => ipcRenderer.invoke(IPC.snapshot.take, includeSeoAudit),
  onSnapshotTaken: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, result: SnapshotResult): void =>
      callback(result)
    ipcRenderer.on(IPC.snapshot.taken, listener)
    return () => ipcRenderer.removeListener(IPC.snapshot.taken, listener)
  },
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
  }
}

contextBridge.exposeInMainWorld('panelApi', panelApi)
