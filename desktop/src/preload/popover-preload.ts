import { contextBridge, ipcRenderer } from 'electron'
import type { PopoverAction, PopoverShowMessage } from '../shared/popover-types'
import type { Size } from '../shared/types'

export interface PopoverOverlayApi {
  onShow: (callback: (message: PopoverShowMessage) => void) => () => void
  onHide: (callback: () => void) => () => void
  reportSize: (size: Size) => void
  sendAction: (action: PopoverAction) => void
}

const popoverApi: PopoverOverlayApi = {
  onShow: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, message: PopoverShowMessage): void =>
      callback(message)
    ipcRenderer.on('popover:show', listener)
    return () => ipcRenderer.removeListener('popover:show', listener)
  },
  onHide: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('popover:hide', listener)
    return () => ipcRenderer.removeListener('popover:hide', listener)
  },
  reportSize: (size) => {
    ipcRenderer.send('popover:size', size)
  },
  sendAction: (action) => {
    ipcRenderer.send('popover:action', action)
  }
}

contextBridge.exposeInMainWorld('popoverApi', popoverApi)
