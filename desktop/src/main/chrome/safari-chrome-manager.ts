import { WebContentsView, type BrowserWindow } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'
import { DEVICE_PRESETS } from '../../shared/device-presets'
import type { PaneId, PaneMount } from '../../shared/pane-types'
import {
  SAFARI_CHROME_COMPACT_SCROLL_Y,
  SAFARI_CHROME_EXPAND_SCROLL_Y,
  SAFARI_CHROME_PANE_IDS,
  type SafariChromeState
} from '../../shared/safari-chrome'
import type { PaneManager } from '../panes/pane-manager'
import { overlayPng } from './png-overlay'

interface PaneChromeState {
  compact: boolean
  url: string
  view: WebContentsView
  ready: Promise<void>
  mounted: boolean
}

const CHROME_PANE_IDS = SAFARI_CHROME_PANE_IDS

function getSafariChromePreloadPath(): string {
  return join(__dirname, '../preload/safari-chrome-preload.js')
}

function getSafariChromeUrl(paneId: PaneId): string {
  const params = new URLSearchParams({ pane: paneId })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/safari-chrome.html?${params}`
  }
  return `${pathToFileURL(join(__dirname, '../renderer/safari-chrome.html')).href}?${params}`
}

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (remaining: number): void => {
      if (remaining <= 0) {
        resolve()
        return
      }
      setTimeout(() => step(remaining - 1), 16)
    }
    step(count)
  })
}

export class SafariChromeManager {
  private enabled = false
  private panesVisible = true
  private mainWindow: BrowserWindow | null = null
  private paneState = new Map<PaneId, PaneChromeState>()
  private reassertPanels: (() => void) | null = null

  constructor(private readonly paneManager: PaneManager) {}

  setPanelReassert(handler: () => void): void {
    this.reassertPanels = handler
  }

  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(enabled: boolean): boolean {
    this.enabled = enabled
    if (enabled) {
      void this.ensureChromePanes().then(() => {
        if (!this.enabled) return
        this.refreshAllBounds()
        this.pushAllState()
        this.enforceZOrder()
      })
    } else {
      this.hideAll()
    }
    this.broadcastEnabled()
    return this.enabled
  }

  setPanesVisible(visible: boolean): void {
    this.panesVisible = visible
    if (!this.enabled) return
    if (visible) {
      this.refreshAllBounds()
      this.pushAllState()
      this.enforceZOrder()
    } else {
      this.hideAll()
    }
  }

  onPaneMounted(paneId: PaneId, mount: PaneMount): void {
    if (!this.enabled || !CHROME_PANE_IDS.includes(paneId)) return
    void this.ensurePane(paneId).then(() => {
      this.applyBounds(paneId, mount)
      this.pushPaneState(paneId)
      this.enforceZOrder()
    })
  }

  onScroll(paneId: PaneId, scrollY: number, programmatic: boolean): void {
    if (!this.enabled || programmatic || !CHROME_PANE_IDS.includes(paneId)) return
    const state = this.paneState.get(paneId)
    if (!state) return

    let next = state.compact
    if (!state.compact && scrollY >= SAFARI_CHROME_COMPACT_SCROLL_Y) {
      next = true
    } else if (state.compact && scrollY <= SAFARI_CHROME_EXPAND_SCROLL_Y) {
      next = false
    }
    if (next === state.compact) return

    state.compact = next
    this.pushPaneState(paneId)
  }

  setPaneUrl(paneId: PaneId, url: string): void {
    if (!CHROME_PANE_IDS.includes(paneId)) return
    const state = this.paneState.get(paneId)
    if (!state) {
      void this.ensurePane(paneId).then(() => {
        const ready = this.paneState.get(paneId)
        if (!ready) return
        ready.url = url
        this.pushPaneState(paneId)
      })
      return
    }
    if (state.url === url) return
    state.url = url
    this.pushPaneState(paneId)
  }

  setPaneUrls(urls: Partial<Record<PaneId, string>>): void {
    for (const paneId of CHROME_PANE_IDS) {
      const url = urls[paneId]
      if (typeof url === 'string') this.setPaneUrl(paneId, url)
    }
  }

  async captureComposited(paneId: PaneId, capturePage: () => Promise<Buffer>): Promise<Buffer> {
    if (!this.enabled || !this.panesVisible || !CHROME_PANE_IDS.includes(paneId)) {
      return capturePage()
    }

    const state = this.paneState.get(paneId)
    const mount = this.paneManager.getLastMount(paneId)
    if (!state || !mount) {
      return capturePage()
    }

    await state.ready

    const profile = DEVICE_PRESETS[paneId]
    const scale = profile.deviceScaleFactor
    const width = mount.logicalSize.width
    const height = mount.logicalSize.height
    const originX = Math.round(mount.screenBounds.x)
    const originY = Math.round(mount.screenBounds.y)

    try {
      state.view.setBounds({ x: originX, y: originY, width, height })
      state.view.setVisible(true)
      this.pushPaneState(paneId)
      await waitFrames(2)

      const pagePng = await capturePage()
      const chromePng = await this.captureOverlay(state, width, height, scale)
      return overlayPng(pagePng, chromePng, 0, 0)
    } finally {
      this.applyBounds(paneId, mount)
      this.enforceZOrder()
    }
  }

  enforceZOrder(): void {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || !this.enabled) {
      this.reassertPanels?.()
      return
    }

    for (const paneId of CHROME_PANE_IDS) {
      const state = this.paneState.get(paneId)
      if (!state?.mounted) continue
      mainWindow.contentView.addChildView(state.view)
    }
    this.reassertPanels?.()
  }

  destroy(): void {
    for (const state of this.paneState.values()) {
      this.destroyView(state)
    }
    this.paneState.clear()
    this.mainWindow = null
  }

  private broadcastEnabled(): void {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send('safari-chrome:enabled-changed', this.enabled)
    this.paneManager.broadcastOverlayEvent('safari-chrome:enabled-changed', this.enabled)
  }

  private async ensureChromePanes(): Promise<void> {
    await Promise.all(CHROME_PANE_IDS.map((paneId) => this.ensurePane(paneId)))
  }

  private async ensurePane(paneId: PaneId): Promise<PaneChromeState> {
    const existing = this.paneState.get(paneId)
    if (existing) {
      await existing.ready
      return existing
    }

    const state = this.createOverlay(paneId)
    this.paneState.set(paneId, state)
    await state.ready
    return state
  }

  private createOverlay(paneId: PaneId): PaneChromeState {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error('SafariChromeManager has no window')
    }

    const view = new WebContentsView({
      webPreferences: {
        preload: getSafariChromePreloadPath(),
        sandbox: true,
        contextIsolation: true
      }
    })
    view.setBackgroundColor('#00000000')
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
    view.setVisible(false)

    const state: PaneChromeState = {
      compact: false,
      url: this.paneManager.getTrackedPaneUrl(paneId),
      view,
      mounted: false,
      ready: Promise.resolve()
    }

    state.ready = new Promise<void>((resolve, reject) => {
      const onReady = (): void => resolve()
      const onFail = (_event: Electron.Event, _code: number, description: string): void => {
        reject(new Error(`Safari chrome overlay failed to load: ${description}`))
      }

      mainWindow.contentView.addChildView(view)
      state.mounted = true
      view.webContents.once('did-finish-load', onReady)
      view.webContents.once('did-fail-load', onFail)
      void view.webContents.loadURL(getSafariChromeUrl(paneId))
    })

    return state
  }

  private refreshAllBounds(): void {
    for (const paneId of CHROME_PANE_IDS) {
      const mount = this.paneManager.getLastMount(paneId)
      if (mount) this.applyBounds(paneId, mount)
    }
  }

  private applyBounds(paneId: PaneId, mount: PaneMount): void {
    const state = this.paneState.get(paneId)
    if (!state) return

    if (!this.enabled || !this.panesVisible) {
      this.zeroView(state)
      return
    }

    const { screenBounds } = mount
    state.view.setBounds({
      x: Math.round(screenBounds.x),
      y: Math.round(screenBounds.y),
      width: Math.round(screenBounds.width),
      height: Math.round(screenBounds.height)
    })
    state.view.setVisible(true)
  }

  private hideAll(): void {
    for (const state of this.paneState.values()) {
      this.zeroView(state)
    }
  }

  private zeroView(state: PaneChromeState): void {
    state.view.setVisible(false)
    state.view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  }

  private pushAllState(): void {
    for (const paneId of CHROME_PANE_IDS) {
      this.pushPaneState(paneId)
    }
  }

  private pushPaneState(paneId: PaneId): void {
    const state = this.paneState.get(paneId)
    if (!state || state.view.webContents.isDestroyed()) return
    const payload: SafariChromeState = {
      paneId,
      url: state.url,
      compact: state.compact,
      visible: this.enabled && this.panesVisible
    }
    state.view.webContents.send('safari-chrome:state', payload)
  }

  private async captureOverlay(
    state: PaneChromeState,
    cssWidth: number,
    cssHeight: number,
    scale: number
  ): Promise<Buffer> {
    const webContents = state.view.webContents
    if (webContents.isDestroyed()) {
      throw new Error('Safari chrome overlay is not capturable')
    }

    if (!webContents.debugger.isAttached()) {
      webContents.debugger.attach('1.3')
    }

    const response = (await webContents.debugger.sendCommand('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      optimizeForSpeed: false,
      captureBeyondViewport: false,
      clip: {
        x: 0,
        y: 0,
        width: cssWidth,
        height: cssHeight,
        scale
      }
    })) as { data?: string }

    if (!response.data) {
      throw new Error('Safari chrome overlay capture returned no data')
    }

    return Buffer.from(response.data, 'base64')
  }

  private destroyView(state: PaneChromeState): void {
    const mainWindow = this.mainWindow
    if (mainWindow && !mainWindow.isDestroyed() && state.mounted) {
      try {
        mainWindow.contentView.removeChildView(state.view)
      } catch {
        // already detached
      }
    }
    if (!state.view.webContents.isDestroyed()) {
      state.view.webContents.close()
    }
  }
}
