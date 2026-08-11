import { contextBridge, ipcRenderer } from 'electron'
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
    ipcRenderer.on('panel:show', listener)
    return () => ipcRenderer.removeListener('panel:show', listener)
  },
  onHide: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('panel:hide', listener)
    return () => ipcRenderer.removeListener('panel:hide', listener)
  },
  onTransition: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { panelId: PanelId; transitioning: boolean }
    ): void => callback(state)
    ipcRenderer.on('panel:transition', listener)
    return () => ipcRenderer.removeListener('panel:transition', listener)
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
  getSafariChromeEnabled: () => ipcRenderer.invoke('safari-chrome:get-enabled'),
  setSafariChromeEnabled: (enabled) => ipcRenderer.invoke('safari-chrome:set-enabled', enabled),
  setPaneThemePreference: (preference) =>
    ipcRenderer.invoke('pane-theme:set-preference', preference),
  getMediaFeatures: () => ipcRenderer.invoke('media-features:get'),
  setMediaFeatures: (state) => ipcRenderer.invoke('media-features:set', state),
  openPanel: (options) => ipcRenderer.invoke('panel:open', options),
  closePanel: (panelId, options) => ipcRenderer.invoke('panel:close', panelId, options),
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
  onMediaFeaturesChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: MediaFeatureState): void =>
      callback(state)
    ipcRenderer.on('panel:media-features-changed', listener)
    return () => ipcRenderer.removeListener('panel:media-features-changed', listener)
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
  onToggleDiagnostics: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('panel:toggle-diagnostics', listener)
    return () => ipcRenderer.removeListener('panel:toggle-diagnostics', listener)
  },
  getWorkspaceView: () => ipcRenderer.invoke('app:get-workspace-view'),
  onWorkspaceViewChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, view: WorkspaceView): void =>
      callback(view)
    ipcRenderer.on('workspace:view-changed', listener)
    return () => ipcRenderer.removeListener('workspace:view-changed', listener)
  },
  getRuntimeEvidence: () => ipcRenderer.invoke('runtime-evidence:get'),
  clearRuntimeEvidence: (channel) => ipcRenderer.invoke('runtime-evidence:clear', channel),
  getApplicationData: () => ipcRenderer.invoke('application:get-data'),
  getDevContext: () => ipcRenderer.invoke('dev-context:get'),
  openExternalUrl: (url) => ipcRenderer.invoke('url:open-external', url),
  onRuntimeEvidenceChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: RuntimeEvidenceSnapshot): void =>
      callback(snapshot)
    ipcRenderer.on('runtime-evidence:changed', listener)
    return () => ipcRenderer.removeListener('runtime-evidence:changed', listener)
  },
  onRuntimeEvidenceProblemCount: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: RuntimeEvidenceProblemCount
    ): void => callback(payload)
    ipcRenderer.on('runtime-evidence:problem-count', listener)
    return () => ipcRenderer.removeListener('runtime-evidence:problem-count', listener)
  },
  getDiagnosticsWidth: () => ipcRenderer.invoke('panel:get-diagnostics-width'),
  resizeDockedPanel: (width, phase) => {
    ipcRenderer.send('panel:docked-resize', width, phase)
  },
  onDiagnosticsWidthChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, width: number): void => callback(width)
    ipcRenderer.on('panel:diagnostics-width', listener)
    return () => ipcRenderer.removeListener('panel:diagnostics-width', listener)
  },
  onInspectionState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: InspectionState): void =>
      callback(state)
    ipcRenderer.on('inspection:state', listener)
    return () => ipcRenderer.removeListener('inspection:state', listener)
  },
  getInspectionState: () => ipcRenderer.invoke('inspection:get-state'),
  loadInspectionMarkupChildren: (paneId, nodeId) =>
    ipcRenderer.invoke('inspection:markup-children', paneId, nodeId),
  takeSnapshot: (includeSeoAudit = false) => ipcRenderer.invoke('snapshot:take', includeSeoAudit),
  onSnapshotTaken: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, result: SnapshotResult): void =>
      callback(result)
    ipcRenderer.on('snapshot:taken', listener)
    return () => ipcRenderer.removeListener('snapshot:taken', listener)
  },
  onSafariChromeEnabledChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: boolean): void =>
      callback(enabled)
    ipcRenderer.on('safari-chrome:enabled-changed', listener)
    return () => ipcRenderer.removeListener('safari-chrome:enabled-changed', listener)
  },
  runSeoAudit: (indexingIntent) => ipcRenderer.invoke('seo-audit:run', indexingIntent),
  cancelSeoAudit: () => ipcRenderer.invoke('seo-audit:cancel'),
  getSeoAuditState: () => ipcRenderer.invoke('seo-audit:get-state'),
  onSeoAuditState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AuditJobState): void =>
      callback(state)
    ipcRenderer.on('seo-audit:state', listener)
    return () => ipcRenderer.removeListener('seo-audit:state', listener)
  },
  getLighthouseState: () => ipcRenderer.invoke('seo-lighthouse:get-state'),
  runLighthouse: (labSelection) => ipcRenderer.invoke('seo-lighthouse:run', labSelection),
  cancelLighthouse: () => ipcRenderer.invoke('seo-lighthouse:cancel'),
  onLighthouseState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: LighthouseAssessmentState): void =>
      callback(state)
    ipcRenderer.on('seo-lighthouse:state', listener)
    return () => ipcRenderer.removeListener('seo-lighthouse:state', listener)
  }
}

contextBridge.exposeInMainWorld('panelApi', panelApi)
