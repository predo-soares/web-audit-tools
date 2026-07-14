import { BrowserWindow, ipcMain } from 'electron'
import { normalizeUrl } from '../shared/url'
import type { ElementFingerprint } from '../shared/element-mirror'
import type { NewProjectInput } from '../shared/project'
import type { PanelAction, PanelId, PanelOpenOptions } from '../shared/panel-types'
import type { MediaFeatureState, PaneMount, PaneId, Size, ThemePreference } from '../shared/types'
import type { PaneManager } from './panes/pane-manager'
import type { PanelManager } from './panels/panel-manager'
import type { SafariChromeManager } from './chrome/safari-chrome-manager'
import type { HistoryStore } from './stores/history-store'
import type { ProjectStore } from './stores/project-store'
import { captureSnapshot, type SnapshotPort } from './services/snapshot-service'
import type { AuditPort } from './seo/audit-service'
import type { AuditManager } from './seo/audit-manager'
import {
  RENDERED_EXTRACTION_EXPRESSION,
  normalizeRenderedSnapshot
} from './seo/rendered-extraction'
import { captureDeliveredEvidence } from './seo/delivered-evidence'
import { nodeFetchTransport } from './seo/referenced-fetch'
import { UNAVAILABLE_DELIVERED_EVIDENCE, type IndexingIntent } from '../shared/seo-audit'
import { unavailableIndexability, verifyIndexability } from './seo/indexability'
import { resolveSocialSharing, unavailableSocialSharing } from './seo/social-sharing'
import {
  unavailableInternationalization,
  verifyInternationalization
} from './seo/internationalization'
import { LighthouseManager } from './seo/lighthouse-manager'
import type { LighthouseProfile } from '../shared/seo-audit'

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
  auditManager: AuditManager
): void {
  const lighthouseManager = new LighthouseManager((state) =>
    panelManager.notifyPanel('seo-right', 'seo-lighthouse:state', state)
  )
  ipcMain.handle('snapshot:take', async (_event, includeSeoAudit = false) => {
    return captureSnapshot(makeSnapshotPort(paneManager), undefined, {
      includeSeoAudit,
      seoAuditState: includeSeoAudit ? auditManager.getState() : undefined
    })
  })

  ipcMain.handle('seo-audit:run', async (_event, indexingIntent: IndexingIntent) => {
    return auditManager.run({ indexingIntent })
  })

  ipcMain.handle('seo-audit:cancel', () => {
    auditManager.cancel()
  })

  ipcMain.handle('seo-audit:get-state', () => {
    return auditManager.getState()
  })
  ipcMain.handle('seo-lighthouse:get-state', () => lighthouseManager.getState())
  ipcMain.handle(
    'seo-lighthouse:run',
    async (_event, profile: LighthouseProfile, shareSession: boolean) => {
      const navigation = paneManager.getNavigationState()
      if (!navigation.barUrl) return lighthouseManager.getState()
      const headers: Record<string, string> = {
        'User-Agent': paneManager.getUserAgentForPane(navigation.activePane ?? 'desktop')
      }
      if (shareSession) {
        const cookieHeader = await sessionCookieHeader(
          paneManager.getPreviewSession(),
          navigation.barUrl
        )
        if (cookieHeader) headers.Cookie = cookieHeader
      }
      return lighthouseManager.run({
        url: navigation.barUrl,
        profile,
        shareSession,
        headers,
        pageAuditId: auditManager.getState().result?.id ?? null
      })
    }
  )
  ipcMain.handle('seo-lighthouse:cancel', () => lighthouseManager.cancel())

  ipcMain.on('diagnostics:toggle', () => {
    panelManager.notifyToolbarPanel('panel:toggle-diagnostics')
  })

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    if (window.isFullScreen()) {
      window.setFullScreen(false)
    } else {
      window.setFullScreen(true)
    }
  })

  ipcMain.handle('window:is-focused', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isFocused() ?? false
  })

  ipcMain.handle('window:is-fullscreen', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false
  })

  ipcMain.handle('pane:mount', (_event, paneId: PaneId, mount: PaneMount) => {
    paneManager.mount(paneId, mount)
  })

  ipcMain.handle('preview:navigate', async (_event, rawUrl: string) => {
    const url = normalizeUrl(rawUrl)
    await paneManager.navigateAll(url)
    return url
  })

  ipcMain.handle('preview:navigation-state', () => {
    return paneManager.getNavigationState()
  })

  ipcMain.handle('preview:reload', async () => {
    await paneManager.reloadAll()
  })

  ipcMain.handle('preview:stop', () => {
    paneManager.stopLoadingAll()
  })

  ipcMain.handle('preview:screenshot', async (event, paneId: PaneId) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    if (!parentWindow) {
      return { saved: false }
    }
    return paneManager.savePaneScreenshot(paneId, parentWindow)
  })

  ipcMain.handle('preview:go-back', async () => {
    await paneManager.goBack()
  })

  ipcMain.handle('preview:go-forward', async () => {
    await paneManager.goForward()
  })

  ipcMain.handle('pane:recreate-all', async () => {
    await paneManager.recreateAll()
  })

  ipcMain.handle('sync:set-enabled', (_event, enabled: boolean) => {
    paneManager.setSyncEnabled(enabled)
    return paneManager.isSyncEnabled()
  })

  ipcMain.handle('sync:get-enabled', () => {
    return paneManager.isSyncEnabled()
  })

  ipcMain.handle('safari-chrome:set-enabled', (_event, enabled: boolean) => {
    return safariChromeManager.setEnabled(enabled)
  })

  ipcMain.handle('safari-chrome:get-enabled', () => {
    return safariChromeManager.isEnabled()
  })

  ipcMain.handle('pane-theme:set-preference', async (_event, preference: ThemePreference) => {
    await paneManager.setThemePreference(preference)
    // Broadcast so a change from either the toolbar toggle or the Rendering tab
    // keeps every overlay panel's prefers-color-scheme control in sync.
    panelManager.notifyOverlayPanels('panel:theme-changed', preference)
    return preference
  })

  ipcMain.handle('media-features:get', () => {
    return paneManager.getMediaFeatures()
  })

  ipcMain.handle('media-features:set', async (_event, state: MediaFeatureState) => {
    await paneManager.setMediaFeatures(state)
    panelManager.notifyOverlayPanels('panel:media-features-changed', state)
    return state
  })

  ipcMain.on(
    'pane:scroll',
    (_event, paneId: PaneId, ratio: number, programmatic: boolean, scrollY = 0) => {
      void paneManager.syncScroll(paneId, ratio, programmatic, scrollY)
    }
  )

  ipcMain.on('pane:click', (_event, paneId: PaneId, fingerprint: ElementFingerprint) => {
    void paneManager.syncClick(paneId, fingerprint)
  })

  ipcMain.on(
    'pane:value',
    (_event, paneId: PaneId, fingerprint: ElementFingerprint, value: string) => {
      void paneManager.syncValue(paneId, fingerprint, value)
    }
  )

  ipcMain.on(
    'pane:select',
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

  ipcMain.on('pane:submit', (_event, paneId: PaneId, fingerprint: ElementFingerprint) => {
    void paneManager.syncSubmit(paneId, fingerprint)
  })

  ipcMain.handle('pane:loading-states', () => {
    return paneManager.getLoadingStates()
  })

  ipcMain.handle('runtime-evidence:get', () => {
    return paneManager.getRuntimeEvidenceSnapshot()
  })

  ipcMain.handle('runtime-evidence:clear', (_event, channel: 'console' | 'network') => {
    return paneManager.clearRuntimeEvidence(channel)
  })

  ipcMain.handle('panel:open', async (_event, options: PanelOpenOptions) => {
    await panelManager.open(options)
  })

  ipcMain.handle('panel:close', (_event, panelId: PanelId) => {
    panelManager.close(panelId)
  })

  ipcMain.handle('panel:get-open', () => {
    return panelManager.getOpenPanelIds()
  })

  ipcMain.handle('panel:get-diagnostics-width', () => {
    return panelManager.getDiagnosticsWidth()
  })

  ipcMain.on('panel:docked-resize', (event, width: number, phase: 'preview' | 'commit') => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleDockedResize(panelId, width, phase)
  })

  ipcMain.on('panel:size', (event, size: Size) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleSizeReport(panelId, size)
  })

  ipcMain.on('panel:exit-complete', (event) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleExitComplete(panelId)
  })

  ipcMain.on('panel:focus-on-close', (event) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleFocusOnClose(panelId)
  })

  ipcMain.on('panel:ready', (event) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return
    panelManager.handleRendererReady(panelId)
  })

  ipcMain.on('panel:action', (event, action: PanelAction) => {
    const panelId = panelManager.getPanelIdForWebContents(event.sender)
    if (!panelId) return

    if (action.type === 'set-zoom' || action.type === 'set-theme' || action.type === 'fit-zoom') {
      void panelManager.handleAction(panelId, action)
      return
    }

    if (action.type === 'toggle-sidebar') {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('panel:toggle-sidebar')
      }
      return
    }

    if (action.type === 'toggle-diagnostics') {
      panelManager.notifyToolbarPanel('panel:toggle-diagnostics')
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

    if (action.type === 'set-sync-enabled') {
      paneManager.setSyncEnabled(action.enabled)
      return
    }

    if (action.type === 'navigate') {
      void paneManager.navigateAll(normalizeUrl(action.url))
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

  ipcMain.handle('history:list', () => {
    return historyStore.list()
  })

  ipcMain.handle('history:delete', (_event, url: string) => {
    historyStore.remove(url)
  })

  ipcMain.handle('history:clear', () => {
    historyStore.clear()
  })

  ipcMain.handle('e2e:evaluate-in-pane', async (_event, paneId: PaneId, expression: string) => {
    return paneManager.evaluateInPane(paneId, expression)
  })

  ipcMain.handle('e2e:focus-pane', (_event, paneId: PaneId) => {
    paneManager.focusPane(paneId)
  })

  ipcMain.handle('e2e:get-mirror-failure-logs', () => {
    return paneManager.getMirrorFailureLogs()
  })

  ipcMain.handle('e2e:get-sync-trace-logs', () => {
    return paneManager.getSyncTraceLogs()
  })

  ipcMain.handle('projects:list', () => {
    return projectStore.list()
  })

  ipcMain.handle('projects:toggle', (_event, input: NewProjectInput & { pageTitle: string }) => {
    const { pageTitle, ...projectInput } = input
    return projectStore.toggle(projectInput, pageTitle)
  })
}
