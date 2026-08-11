import { contextBridge, ipcRenderer } from 'electron'
import type { SafariChromeState } from '../shared/safari-chrome'

export interface SafariChromeApi {
  onState: (callback: (state: SafariChromeState) => void) => () => void
}

const safariChromeApi: SafariChromeApi = {
  onState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: SafariChromeState): void => {
      callback(state)
    }
    ipcRenderer.on('safari-chrome:state', listener)
    return () => ipcRenderer.removeListener('safari-chrome:state', listener)
  }
}

contextBridge.exposeInMainWorld('safariChromeApi', safariChromeApi)
