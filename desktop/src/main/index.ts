import { app, shell, BrowserWindow, Menu } from 'electron'
import localShortcut from 'electron-localshortcut'
import { electronAccelerator } from '../shared/shortcuts'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { HistoryStore } from './stores/history-store'
import { registerIpcHandlers, makeSnapshotPort, makeAuditPort } from './ipc'
import { captureSnapshot } from './services/snapshot-service'
import { AuditManager } from './seo/audit-manager'
import { LighthouseManager } from './seo/lighthouse-manager'
import { composeMcpToolPort } from './mcp/compose-tool-port'
import { startMcpServer, type McpServerHandle } from './mcp/mcp-server'
import { PaneManager } from './panes/pane-manager'
import { PanelManager } from './panels/panel-manager'
import { SafariChromeManager } from './chrome/safari-chrome-manager'
import { ProjectStore } from './stores/project-store'
import { initializeAppLogging } from './services/app-logging'

initializeAppLogging()

// E2E runs get an isolated profile so parallel/leftover instances never share
// caches or locks with the dev profile (a crashed instance corrupts the disk
// cache for every later launch).
if (process.env.E2E_USER_DATA_DIR) {
  app.setPath('userData', process.env.E2E_USER_DATA_DIR)
}

const paneManager = new PaneManager()
const auditManager = new AuditManager(makeAuditPort(paneManager))
// Hoisted out of registerIpcHandlers so the IPC and MCP surfaces share one
// LighthouseManager instance (and therefore one Lighthouse state).
const lighthouseManager = new LighthouseManager((state) => {
  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('seo-lighthouse:state', state)
  }
})
const panelManager = new PanelManager(paneManager)
const safariChromeManager = new SafariChromeManager(paneManager)
const projectStore = new ProjectStore()
const historyStore = new HistoryStore()

let mcpServerHandle: McpServerHandle | null = null

if (process.env.E2E_TEST) {
  ;(globalThis as { __paneManager?: PaneManager }).__paneManager = paneManager
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    show: process.env.E2E_TEST === '1',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    ...(process.platform === 'darwin'
      ? {
          vibrancy: 'under-window' as const,
          visualEffectState: 'active' as const
        }
      : {}),
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      spellcheck: false
    }
  })
  mainWindow.setBackgroundColor('#00000000')
  if (process.platform === 'darwin') {
    mainWindow.setVibrancy('under-window')
  }

  const sendWindowFocusState = (): void => {
    if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
    const focused = mainWindow.isFocused()
    mainWindow.webContents.send('window:focus-changed', focused)
    panelManager.notifyToolbarPanel('window:focus-changed', focused)
  }

  const sendWindowFullscreenState = (): void => {
    if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
    const fullscreen = mainWindow.isFullScreen()
    mainWindow.webContents.send('window:fullscreen-changed', fullscreen)
    panelManager.notifyToolbarPanel('window:fullscreen-changed', fullscreen)
  }

  mainWindow.on('focus', sendWindowFocusState)
  mainWindow.on('blur', sendWindowFocusState)
  mainWindow.on('enter-full-screen', sendWindowFullscreenState)
  mainWindow.on('leave-full-screen', sendWindowFullscreenState)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    sendWindowFocusState()
    sendWindowFullscreenState()
  })

  mainWindow.once('close', () => {
    projectStore.destroy()
    historyStore.destroy()
    panelManager.destroy()
    safariChromeManager.destroy()
    paneManager.destroy()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  paneManager.initialize(mainWindow)
  safariChromeManager.initialize(mainWindow)
  safariChromeManager.setPanelReassert(() => panelManager.reassertZOrder())
  panelManager.setChromeZOrderHook(() => safariChromeManager.enforceZOrder())
  panelManager.initialize(mainWindow)
  paneManager.setSafariChromeHooks({
    onMount: (paneId, mount) => safariChromeManager.onPaneMounted(paneId, mount),
    onScroll: (paneId, scrollY, programmatic) =>
      safariChromeManager.onScroll(paneId, scrollY, programmatic),
    onNavigationState: (urls) => safariChromeManager.setPaneUrls(urls),
    setPanesVisible: (visible) => safariChromeManager.setPanesVisible(visible),
    captureComposited: (paneId, capturePage) =>
      safariChromeManager.captureComposited(paneId, capturePage),
    destroy: () => safariChromeManager.destroy()
  })
  paneManager.onPaneBeforeInput((input, preventDefault) => {
    panelManager.handlePaneBeforeInput(input, preventDefault)
  })
  paneManager.setOverlayBroadcast((channel, ...args) => {
    panelManager.notifyOverlayPanels(channel, ...args)
  })
  paneManager.setDiagnosticsEvidenceSink({
    isOpen: () => panelManager.isPanelOpen('diagnostics-right'),
    send: (snapshot) => {
      panelManager.notifyPanel('diagnostics-right', 'runtime-evidence:changed', snapshot)
    }
  })
  paneManager.setHistoryHooks({
    onVisitCommitted: ({ url, title, faviconUrl }) => {
      historyStore.logVisit(url, title, faviconUrl)
    },
    onMetadataUpdated: ({ url, title, faviconUrl }) => {
      historyStore.refreshMetadata(url, title, faviconUrl)
    }
  })
  // The audit job is owned in the main process, so a pane's document changing
  // cancels a bound job and staleness follows navigation regardless of whether
  // the SEO panel is open. Its state is broadcast to overlay panels so the SEO
  // panel restores progress on reopen.
  paneManager.onPaneDocumentChange((paneId) => {
    auditManager.handlePaneDocumentChange(paneId)
    lighthouseManager.handlePaneDocumentChange(paneId)
  })
  auditManager.subscribe((state) => {
    panelManager.notifyOverlayPanels('seo-audit:state', state)
    if (!mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('seo-audit:state', state)
    }
  })
  registerIpcHandlers(
    paneManager,
    panelManager,
    projectStore,
    historyStore,
    safariChromeManager,
    auditManager,
    lighthouseManager
  )
  projectStore.setOnChange((projects) => {
    if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
    mainWindow.webContents.send('projects:changed', projects)
    panelManager.notifyOverlayPanels('projects:changed', projects)
  })
  historyStore.setOnChange((entries) => {
    if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
    mainWindow.webContents.send('history:updated', entries)
    panelManager.notifyOverlayPanels('history:updated', entries)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// macOS gotcha: if previous instances crashed, AppKit shows a modal "reopen
// windows?" prompt *before* finishing launch, so this promise never resolves in
// headless/background launches. Launchers must pass -ApplePersistenceIgnoreState YES
// (the E2E harness does) or set it via `defaults write com.github.Electron`.
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.audit-screens')
  Menu.setApplicationMenu(null)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()

  localShortcut.register(mainWindow, electronAccelerator('share'), () => {
    void captureSnapshot(makeSnapshotPort(paneManager)).then((result) => {
      panelManager.notifyToolbarPanel('snapshot:taken', result)
    })
  })

  // Start the local MCP server so an MCP-aware agent can drive the live panes and
  // read observed context. Binds loopback only; started after managers exist.
  startMcpServer({ port: composeMcpToolPort({ paneManager }) })
    .then((handle) => {
      mcpServerHandle = handle
      console.log(`MCP server listening at ${handle.url}`)
    })
    .catch((error) => {
      console.error('Failed to start MCP server:', error)
    })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  if (mcpServerHandle) {
    void mcpServerHandle.stop()
    mcpServerHandle = null
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export { paneManager }
