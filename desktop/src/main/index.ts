import { app, shell, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { HistoryStore } from './history-store'
import { registerIpcHandlers } from './ipc'
import { PaneManager } from './pane-manager'
import { PanelManager } from './panel-manager'
import { ProjectStore } from './project-store'

// E2E runs get an isolated profile so parallel/leftover instances never share
// caches or locks with the dev profile (a crashed instance corrupts the disk
// cache for every later launch).
if (process.env.E2E_USER_DATA_DIR) {
  app.setPath('userData', process.env.E2E_USER_DATA_DIR)
}

const paneManager = new PaneManager()
const panelManager = new PanelManager(paneManager)
const projectStore = new ProjectStore()
const historyStore = new HistoryStore()

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
    paneManager.destroy()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  paneManager.initialize(mainWindow)
  panelManager.initialize(mainWindow)
  paneManager.onWebContentsCreated((webContents) => {
    panelManager.registerDiagnosticsToggleShortcut(webContents)
  })
  paneManager.setOverlayBroadcast((channel, ...args) => {
    panelManager.notifyOverlayPanels(channel, ...args)
  })
  paneManager.setHistoryHooks({
    onVisitCommitted: ({ url, title, faviconUrl }) => {
      historyStore.logVisit(url, title, faviconUrl)
    },
    onMetadataUpdated: ({ url, title, faviconUrl }) => {
      historyStore.refreshMetadata(url, title, faviconUrl)
    }
  })
  registerIpcHandlers(paneManager, panelManager, projectStore, historyStore)
  projectStore.setOnChange((projects) => {
    if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
    mainWindow.webContents.send('projects:changed', projects)
    panelManager.notifyToolbarPanel('projects:changed', projects)
  })
  historyStore.setOnChange((entries) => {
    if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
    mainWindow.webContents.send('history:updated', entries)
    panelManager.notifyToolbarPanel('history:updated', entries)
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

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export { paneManager }
