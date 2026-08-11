import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { SafariChromeState } from '../shared/safari-chrome'

export interface SafariChromeApi {
  onState: (callback: (state: SafariChromeState) => void) => () => void
}

const safariChromeApi: SafariChromeApi = {
  onState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: SafariChromeState): void => {
      callback(state)
    }
    ipcRenderer.on(IPC.safariChrome.state, listener)
    return () => ipcRenderer.removeListener(IPC.safariChrome.state, listener)
  }
}

contextBridge.exposeInMainWorld('safariChromeApi', safariChromeApi)
