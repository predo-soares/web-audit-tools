/**
 * Single source of truth for IPC channel names shared between the main process
 * (src/main/ipc.ts) and the preload bridges (src/preload/*). Both ends reference
 * the same constant so a channel can never drift out of sync, and a typo is a
 * compile error. Grouped by domain (the part before the ':').
 */
export const IPC = {
  app: {
    devicesView: 'app:devices-view',
    exitChrome: 'app:exit-chrome',
    getWorkspaceView: 'app:get-workspace-view',
    lighthouseView: 'app:lighthouse-view',
    mcpStatus: 'app:mcp-status',
    previewView: 'app:preview-view',
    seoView: 'app:seo-view',
    setWorkspaceView: 'app:set-workspace-view',
    settingsView: 'app:settings-view',
    toggleChrome: 'app:toggle-chrome'
  },
  application: {
    getData: 'application:get-data'
  },
  chrome: {
    setHidden: 'chrome:set-hidden'
  },
  devContext: {
    get: 'dev-context:get'
  },
  diagnostics: {
    toggle: 'diagnostics:toggle'
  },
  e2e: {
    evaluateInPane: 'e2e:evaluate-in-pane',
    focusPane: 'e2e:focus-pane',
    getMirrorFailureLogs: 'e2e:get-mirror-failure-logs',
    getSyncTraceLogs: 'e2e:get-sync-trace-logs'
  },
  history: {
    clear: 'history:clear',
    delete: 'history:delete',
    list: 'history:list',
    updated: 'history:updated'
  },
  inspection: {
    getState: 'inspection:get-state',
    markupChildren: 'inspection:markup-children',
    setMode: 'inspection:set-mode',
    state: 'inspection:state'
  },
  mcp: {
    getStatus: 'mcp:get-status'
  },
  media: {
    download: 'media:download'
  },
  mediaFeatures: {
    get: 'media-features:get',
    set: 'media-features:set'
  },
  pane: {
    click: 'pane:click',
    inspectionEscape: 'pane:inspection-escape',
    inspectionMismatch: 'pane:inspection-mismatch',
    inspectionMode: 'pane:inspection-mode',
    inspectionPreview: 'pane:inspection-preview',
    inspectionSelect: 'pane:inspection-select',
    inspectionSelection: 'pane:inspection-selection',
    inspectionStale: 'pane:inspection-stale',
    key: 'pane:key',
    loadError: 'pane:load-error',
    loading: 'pane:loading',
    loadingStates: 'pane:loading-states',
    mount: 'pane:mount',
    navigation: 'pane:navigation',
    recreateAll: 'pane:recreate-all',
    scroll: 'pane:scroll',
    select: 'pane:select',
    setDeviceProfile: 'pane:set-device-profile',
    setFocused: 'pane:set-focused',
    setVisible: 'pane:set-visible',
    submit: 'pane:submit',
    value: 'pane:value'
  },
  paneTheme: {
    setPreference: 'pane-theme:set-preference'
  },
  panel: {
    action: 'panel:action',
    close: 'panel:close',
    closed: 'panel:closed',
    diagnosticsWidth: 'panel:diagnostics-width',
    dockedResize: 'panel:docked-resize',
    exitComplete: 'panel:exit-complete',
    focusOnClose: 'panel:focus-on-close',
    focusSidebarToggle: 'panel:focus-sidebar-toggle',
    getDiagnosticsWidth: 'panel:get-diagnostics-width',
    getOpen: 'panel:get-open',
    hide: 'panel:hide',
    layoutSettled: 'panel:layout-settled',
    mediaFeaturesChanged: 'panel:media-features-changed',
    open: 'panel:open',
    placement: 'panel:placement',
    ready: 'panel:ready',
    show: 'panel:show',
    size: 'panel:size',
    themeChanged: 'panel:theme-changed',
    toggleDiagnostics: 'panel:toggle-diagnostics',
    toggleSidebar: 'panel:toggle-sidebar',
    transition: 'panel:transition'
  },
  preview: {
    goBack: 'preview:go-back',
    goForward: 'preview:go-forward',
    navigate: 'preview:navigate',
    navigationState: 'preview:navigation-state',
    reload: 'preview:reload',
    screenshot: 'preview:screenshot',
    stop: 'preview:stop'
  },
  projects: {
    changed: 'projects:changed',
    list: 'projects:list',
    toggle: 'projects:toggle'
  },
  runtimeEvidence: {
    changed: 'runtime-evidence:changed',
    clear: 'runtime-evidence:clear',
    get: 'runtime-evidence:get',
    problemCount: 'runtime-evidence:problem-count'
  },
  safariChrome: {
    enabledChanged: 'safari-chrome:enabled-changed',
    getEnabled: 'safari-chrome:get-enabled',
    setEnabled: 'safari-chrome:set-enabled',
    state: 'safari-chrome:state'
  },
  seoAudit: {
    cancel: 'seo-audit:cancel',
    getState: 'seo-audit:get-state',
    run: 'seo-audit:run',
    state: 'seo-audit:state'
  },
  seoLighthouse: {
    cancel: 'seo-lighthouse:cancel',
    getState: 'seo-lighthouse:get-state',
    run: 'seo-lighthouse:run',
    state: 'seo-lighthouse:state'
  },
  snapshot: {
    sharePane: 'snapshot:share-pane',
    take: 'snapshot:take',
    taken: 'snapshot:taken'
  },
  sync: {
    getLinkedPanes: 'sync:get-linked-panes',
    setPaneLinked: 'sync:set-pane-linked'
  },
  url: {
    openExternal: 'url:open-external'
  },
  window: {
    close: 'window:close',
    focusChanged: 'window:focus-changed',
    fullscreenChanged: 'window:fullscreen-changed',
    isFocused: 'window:is-focused',
    isFullscreen: 'window:is-fullscreen',
    minimize: 'window:minimize',
    toggleMaximize: 'window:toggle-maximize'
  },
  workspace: {
    viewChanged: 'workspace:view-changed'
  }
} as const

type Leaf<T> = T extends string
  ? T
  : T extends object
    ? { [K in keyof T]: Leaf<T[K]> }[keyof T]
    : never
export type IpcChannel = Leaf<typeof IPC>
