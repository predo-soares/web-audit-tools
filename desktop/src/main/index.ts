import { app, shell, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc'
import { PaneManager } from './pane-manager'

// E2E runs get an isolated profile so parallel/leftover instances never share
// caches or locks with the dev profile (a crashed instance corrupts the disk
// cache for every later launch).
if (process.env.E2E_USER_DATA_DIR) {
  app.setPath('userData', process.env.E2E_USER_DATA_DIR)
}

const paneManager = new PaneManager()

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
      sandbox: false
    }
  })
  mainWindow.setBackgroundColor('#00000000')
  if (process.platform === 'darwin') {
    mainWindow.setVibrancy('under-window')
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.once('close', () => {
    paneManager.destroy()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  paneManager.initialize(mainWindow)
  registerIpcHandlers(paneManager)

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
