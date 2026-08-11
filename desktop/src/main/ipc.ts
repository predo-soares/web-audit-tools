import { BrowserWindow, ipcMain, shell } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { normalizeUrl } from '../shared/url'
import type { ElementFingerprint } from '../shared/element-mirror'
import type { InspectionPageSnapshot, InspectionTarget } from '../shared/inspection'
import type { NewProjectInput } from '../shared/project'
import type {
  PanelAction,
  PanelCloseOptions,
  PanelId,
  PanelOpenOptions
} from '../shared/panel-types'
import type {
  MediaFeatureState,
  PaneMount,
  PaneId,
  Size,
  ThemePreference
} from '../shared/pane-types'
import type { MirroredKey } from './engine/engine-view'
import type { PaneManager } from './panes/pane-manager'
import type { PanelManager } from './panels/panel-manager'
import type { SafariChromeManager } from './chrome/safari-chrome-manager'
import type { HistoryStore } from './stores/history-store'
import type { ProjectStore } from './stores/project-store'
import { captureSnapshot, type SnapshotPort } from './services/snapshot-service'
import { downloadMedia } from './services/media-download'
import type { AuditPort } from './seo/audit-service'
import type { AuditManager } from './seo/audit-manager'
import {
  RENDERED_EXTRACTION_EXPRESSION,
  normalizeRenderedSnapshot
} from './seo/rendered-extraction'
import { captureDeliveredEvidence } from './seo/delivered-evidence'
import { nodeFetchTransport } from './seo/referenced-fetch'
import { UNAVAILABLE_DELIVERED_EVIDENCE, type IndexingIntent } from '../shared/seo-audit'
import type { LighthouseLabSelection } from '../shared/lighthouse'
import { unavailableIndexability, verifyIndexability } from './seo/indexability'
import { resolveSocialSharing, unavailableSocialSharing } from './seo/social-sharing'
import {
  unavailableInternationalization,
  verifyInternationalization
} from './seo/internationalization'
import type { LighthouseManager } from './seo/lighthouse-manager'
import type { McpServerStatus } from '../shared/mcp-status'
import type { WorkspaceView } from '../shared/sidebar'

// Last workspace the main window reported. Mirrored so a freshly (re)created
// toolbar panel can read it on mount instead of waiting for the next change.
let currentWorkspaceView: WorkspaceView = 'browser'

/**
 * Build a request Cookie header from the pane session so delivered evidence is
 * fetched with the same authentication the user sees. The header is sent but
 * never stored in the resulting evidence (privacy boundary).
 */
async function sessionCookieHeader(
  session: Electron.Session | null,
  url: string
): Promise<string | null> {
  if (!session) return null
  try {
    const cookies = await session.cookies.get({ url })
    if (cookies.length === 0) return null
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
  } catch {
    return null
  }
}

export function makeAuditPort(paneManager: PaneManager): AuditPort {
  return {
    getActivePaneId: () => paneManager.getNavigationState().activePane,
    getActivePaneUrl: () => paneManager.getNavigationState().barUrl || null,
    getLastNavTimestamp: (paneId) => paneManager.getLastNavTimestamp(paneId),
    extractRendered: async (paneId) => {
      const raw = await paneManager.evaluateInPane(paneId, RENDERED_EXTRACTION_EXPRESSION)
      return normalizeRenderedSnapshot(raw)
    },
    fetchDelivered: async (url) => {
      try {
        const session = paneManager.getPreviewSession()
        const paneId = paneManager.getNavigationState().activePane ?? 'desktop'
        const cookieHeader = await sessionCookieHeader(session, url)
        const headers: Record<string, string> = {
          'User-Agent': paneManager.getUserAgentForPane(paneId)
        }
        if (cookieHeader) headers.Cookie = cookieHeader
        return await captureDeliveredEvidence(url, nodeFetchTransport, headers)
      } catch {
        // The port contract forbids throwing: a broken fetch is unavailable
        // evidence, not an audit failure.
        return { ...UNAVAILABLE_DELIVERED_EVIDENCE, unavailableReason: 'network' }
      }
    },
    getAccessContext: async (url) => {
      try {
        const session = paneManager.getPreviewSession()
        if (!session) return { authenticated: false }
        const cookies = await session.cookies.get({ url })
        return { authenticated: cookies.length > 0 }
      } catch {
        return { authenticated: false }
      }
    },
    fetchIndexability: async (url, rendered, delivered) => {
      try {
        const session = paneManager.getPreviewSession()
        const paneId = paneManager.getNavigationState().activePane ?? 'desktop'
        const userAgent = paneManager.getUserAgentForPane(paneId)
        const cookieHeader = await sessionCookieHeader(session, url)
        const headers: Record<string, string> = { 'User-Agent': userAgent }
        if (cookieHeader) headers.Cookie = cookieHeader
        return await verifyIndexability(
          url,
          rendered,
          delivered,
          nodeFetchTransport,
          headers,
          userAgent
        )
      } catch {
        return unavailableIndexability(url, 'network')
      }
    },
    fetchSocial: async (url, rendered, delivered) => {
      try {
        const session = paneManager.getPreviewSession()
        const paneId = paneManager.getNavigationState().activePane ?? 'desktop'
        const headers: Record<string, string> = {
          'User-Agent': paneManager.getUserAgentForPane(paneId)
        }
        const cookieHeader = await sessionCookieHeader(session, url)
        if (cookieHeader) headers.Cookie = cookieHeader
        return await resolveSocialSharing(url, rendered, delivered, nodeFetchTransport, headers)
      } catch {
        return unavailableSocialSharing()
      }
    },
    fetchInternational: async (url, rendered, delivered) => {
      try {
        const session = paneManager.getPreviewSession()
        const paneId = paneManager.getNavigationState().activePane ?? 'desktop'
        const headers: Record<string, string> = {
          'User-Agent': paneManager.getUserAgentForPane(paneId)
        }
        const cookieHeader = await sessionCookieHeader(session, url)
        if (cookieHeader) headers.Cookie = cookieHeader
        return await verifyInternationalization(
          url,
          rendered,
          nodeFetchTransport,
          headers,
          delivered
        )
      } catch {
        return unavailableInternationalization(rendered)
      }
    }
  }
}

export function makeSnapshotPort(paneManager: PaneManager): SnapshotPort {
  return {
    isAnyPaneLoading: () => paneManager.isAnyPaneLoading(),
    getActivePaneId: () => paneManager.getNavigationState().activePane,
    getActivePaneUrl: () => paneManager.getNavigationState().barUrl || null,
    getActivePaneTitle: () => paneManager.getNavigationState().pageTitle,
    getLastNavTimestamp: (paneId) => paneManager.getLastNavTimestamp(paneId),
    getRuntimeEvidenceSnapshot: () => paneManager.getRuntimeEvidenceSnapshot(),
    captureActivePaneScreenshot: () => paneManager.captureActivePaneScreenshot(),
    getDevContext: () => paneManager.getDevContext()
  }
}

export function registerIpcHandlers(
  paneManager: PaneManager,
  panelManager: PanelManager,
  projectStore: ProjectStore,
  historyStore: HistoryStore,
  safariChromeManager: SafariChromeManager,
  auditManager: AuditManager,
  lighthouseManager: LighthouseManager,
  getMcpStatus: () => McpServerStatus
): void {
  ipcMain.handle(IPC.mcp.getStatus, () => getMcpStatus())

  // The active workspace lives in the main window's renderer, but the toolbar is a
  // separate panel; mirror it here so the toolbar can hide page-scoped chrome.
  ipcMain.handle(IPC.app.setWorkspaceView, (_event, view: WorkspaceView) => {
    currentWorkspaceView = view
    panelManager.notifyToolbarPanel(IPC.workspace.viewChanged, view)
    panelManager.notifyPanel('sidebar-left', IPC.workspace.viewChanged, view)
  })
  ipcMain.handle(IPC.app.getWorkspaceView, () => currentWorkspaceView)

  ipcMain.handle(IPC.snapshot.take, async (_event, includeSeoAudit = false) => {
    return captureSnapshot(makeSnapshotPort(paneManager), undefined, {
      includeSeoAudit,
      seoAuditState: includeSeoAudit ? auditManager.getState() : undefined
    })
  })

  // Share with agent is per-device: activate the requested pane first, then run
  // the existing active-pane capture so the bundle reflects that device.
  ipcMain.handle(
    IPC.snapshot.sharePane,
    async (_event, paneId: PaneId, includeSeoAudit = false) => {
      paneManager.focusPane(paneId)
      return captureSnapshot(makeSnapshotPort(paneManager), undefined, {
        includeSeoAudit,
        seoAuditState: includeSeoAudit ? auditManager.getState() : undefined
      })
    }
  )

  ipcMain.handle(IPC.seoAudit.run, async (_event, indexingIntent: IndexingIntent) => {
    return auditManager.run({ indexingIntent })
  })

  ipcMain.handle(IPC.seoAudit.cancel, () => {
    auditManager.cancel()
  })

  ipcMain.handle(IPC.seoAudit.getState, () => {
    return auditManager.getState()
  })
  ipcMain.handle(IPC.seoLighthouse.getState, () => lighthouseManager.getState())
  ipcMain.handle(IPC.seoLighthouse.run, async (_event, labSelection?: LighthouseLabSelection) => {
    const navigation = paneManager.getNavigationState()
    if (!navigation.barUrl) return lighthouseManager.getState()
    const headers: Record<string, string> = {
      'User-Agent': paneManager.getUserAgentForPane(navigation.activePane ?? 'desktop')
    }
    return lighthouseManager.run({
      url: navigation.barUrl,
      paneId: navigation.activePane ?? 'desktop',
      // Disabled until cookies can be seeded into an isolated Chrome jar safely.
      shareSession: false,
      headers,
      labSelection
    })
  })
  ipcMain.handle(IPC.seoLighthouse.cancel, () => lighthouseManager.cancel())

  ipcMain.on(IPC.diagnostics.toggle, () => {
    panelManager.notifyToolbarPanel(IPC.panel.toggleDiagnostics)
  })

  ipcMain.handle(IPC.window.close, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle(IPC.window.minimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle(IPC.window.toggleMaximize, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    if (window.isFullScreen()) {
      window.setFullScreen(false)
    } else {
      window.setFullScreen(true)
    }
  })

  ipcMain.handle(IPC.window.isFocused, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isFocused() ?? false
  })

  ipcMain.handle(IPC.window.isFullscreen, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false
  })

  ipcMain.handle(IPC.pane.mount, (_event, paneId: PaneId, mount: PaneMount) => {
    paneManager.mount(paneId, mount)
  })

  ipcMain.handle(IPC.pane.setVisible, (_event, visible: boolean) => {
    paneManager.setPanesVisible(visible)
  })

  ipcMain.handle(IPC.pane.setFocused, (_event, paneId: PaneId | null) => {
    paneManager.setFocusedPane(paneId)
  })

  ipcMain.handle(IPC.inspection.setMode, async (_event, enabled: boolean) => {
    await paneManager.setInspectionMode(enabled)
    return paneManager.getInspectionState()
  })

  ipcMain.handle(IPC.inspection.getState, () => paneManager.getInspectionState())

  ipcMain.handle(IPC.chrome.setHidden, (_event, hidden: boolean) => {
    panelManager.setChromeHidden(hidden)
  })

  ipcMain.handle(IPC.pane.setDeviceProfile, async (_event, paneId: string, profile: unknown) => {
    await paneManager.setDeviceProfile(
      paneId as import('../shared/pane-types').PaneId,
      profile as import('../shared/pane-types').DeviceProfile
    )
  })

  ipcMain.handle(IPC.preview.navigate, async (_event, rawUrl: string) => {
    const url = normalizeUrl(rawUrl)
    await paneManager.navigateAll(url)
    return url
  })

  ipcMain.handle(IPC.preview.navigationState, () => {
    return paneManager.getNavigationState()
  })

  ipcMain.handle(IPC.preview.reload, async () => {
    await paneManager.reloadAll()
  })

  ipcMain.handle(IPC.preview.stop, () => {
    paneManager.stopLoadingAll()
  })

  ipcMain.handle(IPC.preview.screenshot, async (event, paneId: PaneId) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    if (!parentWindow) {
      return { saved: false }
    }
    return paneManager.savePaneScreenshot(paneId, parentWindow)
  })

  ipcMain.handle(
    IPC.media.download,
    async (event, payload: { url: string; suggestedName?: string }) => {
      if (!payload?.url) return { saved: false }
      const parentWindow = BrowserWindow.fromWebContents(event.sender)
      return downloadMedia(
        parentWindow,
        payload.url,
        paneManager.getPreviewSession(),
        payload.suggestedName
      )
    }
  )

  ipcMain.handle(IPC.preview.goBack, async () => {
    await paneManager.goBack()
  })

  ipcMain.handle(IPC.preview.goForward, async () => {
    await paneManager.goForward()
  })

  ipcMain.handle(IPC.pane.recreateAll, async () => {
    await paneManager.recreateAll()
  })

  ipcMain.handle(IPC.sync.setPaneLinked, (_event, paneId: PaneId, linked: boolean) => {
    paneManager.setPaneLinked(paneId, linked)
    return paneManager.getLinkedPanes()
  })

  ipcMain.handle(IPC.sync.getLinkedPanes, () => {
    return paneManager.getLinkedPanes()
  })

  ipcMain.handle(IPC.safariChrome.setEnabled, (_event, enabled: boolean) => {
    return safariChromeManager.setEnabled(enabled)
  })

  ipcMain.handle(IPC.safariChrome.getEnabled, () => {
    return safariChromeManager.isEnabled()
  })

  ipcMain.handle(IPC.paneTheme.setPreference, async (_event, preference: ThemePreference) => {
    await paneManager.setThemePreference(preference)
    // Broadcast so a change from either the toolbar toggle or the Rendering tab
    // keeps every overlay panel's prefers-color-scheme control in sync.
    panelManager.notifyOverlayPanels(IPC.panel.themeChanged, preference)
    return preference
  })

  ipcMain.handle(IPC.mediaFeatures.get, () => {
    return paneManager.getMediaFeatures()
  })

  ipcMain.handle(IPC.mediaFeatures.set, async (_event, state: MediaFeatureState) => {
    await paneManager.setMediaFeatures(state)
    panelManager.notifyOverlayPanels(IPC.panel.mediaFeaturesChanged, state)
    return state
  })

  ipcMain.on(
    IPC.pane.scroll,
    (_event, paneId: PaneId, ratio: number, programmatic: boolean, scrollY = 0) => {
      void paneManager.syncScroll(paneId, ratio, programmatic, scrollY)
    }
  )

  ipcMain.on(IPC.pane.click, (_event, paneId: PaneId, fingerprint: ElementFingerprint) => {
    void paneManager.syncClick(paneId, fingerprint)
  })

  ipcMain.on(
    IPC.pane.value,
    (_event, paneId: PaneId, fingerprint: ElementFingerprint, value: string) => {
      void paneManager.syncValue(paneId, fingerprint, value)
    }
  )

  ipcMain.on(
    IPC.pane.select,
    (
      _event,
      paneId: PaneId,
      fingerprint: ElementFingerprint,
      value: string,
      selectedIndex: number
    ) => {
      void paneManager.syncSelectValue(paneId, fingerprint, value, selectedIndex)
    }
  )

  ipcMain.on(IPC.pane.submit, (_event, paneId: PaneId, fingerprint: ElementFingerprint) => {
    void paneManager.syncSubmit(paneId, fingerprint)
  })

  ipcMain.on(IPC.pane.key, (_event, paneId: PaneId, key: MirroredKey) => {
    paneManager.syncKey(paneId, key)
  })

  ipcMain.on(
    IPC.pane.inspectionSelect,
    (_event, paneId: PaneId, target: InspectionTarget, snapshot: InspectionPageSnapshot) => {
      void paneManager.selectInspectionElement(paneId, target, snapshot)
    }
  )

  ipcMain.on(
    IPC.pane.inspectionPreview,
    (_event, paneId: PaneId, target: InspectionTarget, snapshot: InspectionPageSnapshot) => {
      void paneManager.previewInspectionElement(paneId, target, snapshot)
    }
  )

  ipcMain.handle(IPC.inspection.markupChildren, (_event, paneId: PaneId, nodeId: string) =>
    paneManager.loadInspectionMarkupChildren(paneId, nodeId)
  )

  ipcMain.on(IPC.pane.inspectionEscape, () => {
    paneManager.closeInspection()
  })

  ipcMain.on(IPC.pane.inspectionStale, (_event, paneId: PaneId) => {
    paneManager.markInspectionPaneStale(paneId)
  })

  ipcMain.handle(IPC.pane.loadingStates, () => {
    return paneManager.getLoadingStates()
  })

  ipcMain.handle(IPC.runtimeEvidence.get, () => {
    return paneManager.getRuntimeEvidenceSnapshot()
  })

  ipcMain.handle(IPC.runtimeEvidence.clear, (_event, channel: 'console' | 'network') => {
    return paneManager.clearRuntimeEvidence(channel)
  })

  ipcMain.handle(IPC.application.getData, () => paneManager.getApplicationData())

  ipcMain.handle(IPC.devContext.get, () => paneManager.getDevContextAsync())

  ipcMain.handle(IPC.url.openExternal, async (_event, rawUrl: string) => {
    const url = new URL(rawUrl)
    if (!['http:', 'https:', 'file:'].includes(url.protocol)) {
      throw new Error('Only http, https, and file URLs can be opened externally')
    }
    await shell.openExternal(url.toString())
  })

  ipcMain.handle(IPC.panel.open, async (_event, options: PanelOpenOptions) => {
    await panelManager.open(options)
  })

  ipcMain.handle(IPC.panel.close, (_event, panelId: PanelId, options?: PanelCloseOptions) => {
    panelManager.close(panelId, options)
  })

  ipcMain.handle(IPC.panel.getOpen, () => {
    return panelManager.getOpenPanelIds()
  })

  ipcMain.handle(IPC.panel.getDiagnosticsWidth, () => {
    return panelManager.getDiagnosticsWidth()
  })

  ipcMain.on(IPC.panel.dockedResize, (event, width: number, phase: 'preview' | 'commit') => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleDockedResize(panelId, width, phase)
  })

  ipcMain.on(IPC.panel.size, (event, size: Size) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleSizeReport(panelId, size)
  })

  ipcMain.on(IPC.panel.exitComplete, (event) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleExitComplete(panelId)
  })

  ipcMain.on(IPC.panel.focusOnClose, (event) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleFocusOnClose(panelId)
  })

  ipcMain.on(IPC.panel.ready, (event) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleRendererReady(panelId)
  })

  ipcMain.on(IPC.panel.action, (event, action: PanelAction) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return

    if (action.type === 'close-panel') {
      panelManager.close(panelId)
      return
    }

    if (action.type === 'set-zoom' || action.type === 'set-theme' || action.type === 'fit-zoom') {
      void panelManager.handleAction(panelId, action)
      return
    }

    if (action.type === 'toggle-sidebar') {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send(IPC.panel.toggleSidebar)
      }
      return
    }

    if (action.type === 'enter-preview-view') {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send(IPC.app.previewView)
      }
      return
    }

    if (action.type === 'enter-seo-view') {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send(IPC.app.seoView)
      }
      return
    }

    if (action.type === 'enter-devices-view') {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send(IPC.app.devicesView)
      }
      return
    }

    if (action.type === 'enter-lighthouse-view') {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send(IPC.app.lighthouseView)
      }
      return
    }

    if (action.type === 'enter-settings-view') {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send(IPC.app.settingsView)
      }
      return
    }

    if (action.type === 'toggle-diagnostics') {
      panelManager.notifyToolbarPanel(IPC.panel.toggleDiagnostics)
      return
    }

    if (action.type === 'set-inspection-mode') {
      void paneManager.setInspectionMode(action.active)
      return
    }

    if (action.type === 'toggle-chrome') {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send(IPC.app.toggleChrome)
      }
      return
    }

    if (action.type === 'go-back') {
      void paneManager.goBack()
      return
    }

    if (action.type === 'go-forward') {
      void paneManager.goForward()
      return
    }

    if (action.type === 'reload') {
      void paneManager.reloadAll()
      return
    }

    if (action.type === 'stop-loading') {
      paneManager.stopLoadingAll()
      return
    }

    if (action.type === 'navigate') {
      // Sidebar history/project navigation originates in a panel renderer, so
      // tell the main renderer to keep its current full-screen workspace before
      // the pane navigation event arrives.
      if (currentWorkspaceView !== 'browser') {
        const mainWindow = BrowserWindow.getAllWindows()[0]
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send(IPC.panel.action, action)
        }
      }
      void paneManager.navigateAll(normalizeUrl(action.url))
      if (panelId === 'url-history') {
        panelManager.close(panelId)
      }
      return
    }

    if (action.type === 'delete-history') {
      historyStore.remove(action.url)
      return
    }

    if (action.type === 'clear-history') {
      historyStore.clear()
      return
    }

    if (action.type === 'toggle-project') {
      projectStore.toggle(
        {
          name: action.name,
          url: action.url,
          faviconUrl: action.faviconUrl
        },
        action.pageTitle
      )
    }
  })

  ipcMain.handle(IPC.history.list, () => {
    return historyStore.list()
  })

  ipcMain.handle(IPC.history.delete, (_event, url: string) => {
    historyStore.remove(url)
  })

  ipcMain.handle(IPC.history.clear, () => {
    historyStore.clear()
  })

  ipcMain.handle(IPC.e2e.evaluateInPane, async (_event, paneId: PaneId, expression: string) => {
    return paneManager.evaluateInPane(paneId, expression)
  })

  ipcMain.handle(IPC.e2e.focusPane, (_event, paneId: PaneId) => {
    paneManager.focusPane(paneId)
  })

  ipcMain.handle(IPC.e2e.getMirrorFailureLogs, () => {
    return paneManager.getMirrorFailureLogs()
  })

  ipcMain.handle(IPC.e2e.getSyncTraceLogs, () => {
    return paneManager.getSyncTraceLogs()
  })

  ipcMain.handle(IPC.projects.list, () => {
    return projectStore.list()
  })

  ipcMain.handle(IPC.projects.toggle, (_event, input: NewProjectInput & { pageTitle: string }) => {
    const { pageTitle, ...projectInput } = input
    return projectStore.toggle(projectInput, pageTitle)
  })
}
