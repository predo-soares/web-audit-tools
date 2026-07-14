import { contextBridge, ipcRenderer } from 'electron'
import type { SafariChromeStripState } from '../shared/safari-chrome'

export interface SafariChromeApi {
  onState: (callback: (state: SafariChromeStripState) => void) => () => void
}

const safariChromeApi: SafariChromeApi = {
  onState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: SafariChromeStripState): void => {
      callback(state)
    }
    ipcRenderer.on('safari-chrome:state', listener)
    return () => ipcRenderer.removeListener('safari-chrome:state', listener)
  }
}

contextBridge.exposeInMainWorld('safariChromeApi', safariChromeApi)
