import { WebContentsView, type BrowserWindow } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'
import { DEVICE_PRESETS } from '../../shared/device-presets'
import type { Bounds, PaneId, PaneMount } from '../../shared/types'
import {
  getSafariBottomHeight,
  getSafariTopHeight,
  SAFARI_CHROME_COMPACT_SCROLL_Y,
  SAFARI_CHROME_EXPAND_SCROLL_Y,
  SAFARI_CHROME_PANE_IDS,
  type SafariChromeStrip,
  type SafariChromeStripState
} from '../../shared/safari-chrome'
import type { PaneManager } from '../panes/pane-manager'
import { overlayPng } from './png-overlay'

interface StripEntry {
  strip: SafariChromeStrip
  view: WebContentsView
  ready: Promise<void>
  mounted: boolean
}

interface PaneChromeState {
  compact: boolean
  url: string
  strips: { top: StripEntry; bottom: StripEntry }
}

const CHROME_PANE_IDS = SAFARI_CHROME_PANE_IDS

function getSafariChromePreloadPath(): string {
  return join(__dirname, '../preload/safari-chrome-preload.js')
}

function getSafariChromeUrl(strip: SafariChromeStrip, paneId: PaneId): string {
  const params = new URLSearchParams({ strip, pane: paneId })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/safari-chrome.html?${params}`
  }
  return `${pathToFileURL(join(__dirname, '../renderer/safari-chrome.html')).href}?${params}`
}

function scaleRound(value: number, zoom: number): number {
  return Math.max(0, Math.round(value * zoom))
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
      this.hideAllStrips()
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
      this.hideAllStrips()
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
    const mount = this.paneManager.getLastMount(paneId)
    if (mount) this.applyBounds(paneId, mount)
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

  /**
   * Runs `capturePage` while chrome strips are sized to logical device chrome
   * heights, then CDP-captures the strips at the pane deviceScaleFactor and
   * composites them onto the page PNG.
   */
  async captureComposited(
    paneId: PaneId,
    capturePage: () => Promise<Buffer>
  ): Promise<Buffer> {
    if (!this.enabled || !this.panesVisible || !CHROME_PANE_IDS.includes(paneId)) {
      return capturePage()
    }

    const state = this.paneState.get(paneId)
    const mount = this.paneManager.getLastMount(paneId)
    if (!state || !mount) {
      return capturePage()
    }

    await Promise.all([state.strips.top.ready, state.strips.bottom.ready])

    const profile = DEVICE_PRESETS[paneId]
    const scale = profile.deviceScaleFactor
    const width = mount.logicalSize.width
    const height = mount.logicalSize.height
    const topCss = getSafariTopHeight(paneId, state.compact)
    const bottomCss = getSafariBottomHeight(paneId)
    const originX = Math.round(mount.screenBounds.x)
    const originY = Math.round(mount.screenBounds.y)

    try {
      this.applyLogicalCaptureBounds(paneId, originX, originY, width, height, state.compact)
      this.pushPaneState(paneId)
      await waitFrames(2)

      const pagePng = await capturePage()

      let result = pagePng
      if (topCss > 0) {
        const topPng = await this.captureStrip(state.strips.top, width, topCss, scale)
        result = overlayPng(result, topPng, 0, 0)
      }
      if (bottomCss > 0) {
        const bottomPng = await this.captureStrip(state.strips.bottom, width, bottomCss, scale)
        result = overlayPng(result, bottomPng, 0, Math.round((height - bottomCss) * scale))
      }
      return result
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
      if (!state) continue
      for (const strip of [state.strips.top, state.strips.bottom]) {
        if (!strip.mounted) continue
        mainWindow.contentView.addChildView(strip.view)
      }
    }
    this.reassertPanels?.()
  }

  destroy(): void {
    for (const state of this.paneState.values()) {
      for (const strip of [state.strips.top, state.strips.bottom]) {
        this.destroyStrip(strip)
      }
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
      await Promise.all([existing.strips.top.ready, existing.strips.bottom.ready])
      return existing
    }

    const url = this.paneManager.getTrackedPaneUrl(paneId)
    const state: PaneChromeState = {
      compact: false,
      url,
      strips: {
        top: this.createStrip(paneId, 'top'),
        bottom: this.createStrip(paneId, 'bottom')
      }
    }
    this.paneState.set(paneId, state)
    await Promise.all([state.strips.top.ready, state.strips.bottom.ready])
    return state
  }

  private createStrip(paneId: PaneId, strip: SafariChromeStrip): StripEntry {
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

    const entry: StripEntry = {
      strip,
      view,
      mounted: false,
      ready: Promise.resolve()
    }

    entry.ready = new Promise<void>((resolve, reject) => {
      const onReady = (): void => resolve()
      const onFail = (_event: Electron.Event, _code: number, description: string): void => {
        reject(new Error(`Safari chrome strip failed to load: ${description}`))
      }

      mainWindow.contentView.addChildView(view)
      entry.mounted = true
      view.webContents.once('did-finish-load', onReady)
      view.webContents.once('did-fail-load', onFail)
      void view.webContents.loadURL(getSafariChromeUrl(strip, paneId))
    })

    return entry
  }

  private applyLogicalCaptureBounds(
    paneId: PaneId,
    originX: number,
    originY: number,
    logicalWidth: number,
    logicalHeight: number,
    compact: boolean
  ): void {
    const state = this.paneState.get(paneId)
    if (!state) return

    const topHeight = getSafariTopHeight(paneId, compact)
    const bottomHeight = getSafariBottomHeight(paneId)

    state.strips.top.view.setBounds({
      x: originX,
      y: originY,
      width: logicalWidth,
      height: topHeight
    })
    state.strips.top.view.setVisible(topHeight > 0)

    state.strips.bottom.view.setBounds({
      x: originX,
      y: originY + logicalHeight - bottomHeight,
      width: logicalWidth,
      height: bottomHeight
    })
    state.strips.bottom.view.setVisible(bottomHeight > 0)
  }

  private async captureStrip(
    strip: StripEntry,
    cssWidth: number,
    cssHeight: number,
    scale: number
  ): Promise<Buffer> {
    const webContents = strip.view.webContents
    if (webContents.isDestroyed() || cssWidth <= 0 || cssHeight <= 0) {
      throw new Error('Safari chrome strip is not capturable')
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
      throw new Error('Safari chrome strip capture returned no data')
    }

    return Buffer.from(response.data, 'base64')
  }

  private refreshAllBounds(): void {
    for (const paneId of CHROME_PANE_IDS) {
      const mount = this.paneManager.getLastMount(paneId)
      if (mount) this.applyBounds(paneId, mount)
    }
  }

  private applyBounds(paneId: PaneId, mount: PaneMount): void {
    const state = this.paneState.get(paneId)
    const mainWindow = this.mainWindow
    if (!state || !mainWindow || mainWindow.isDestroyed()) return

    if (!this.enabled || !this.panesVisible) {
      this.zeroStrip(state.strips.top)
      this.zeroStrip(state.strips.bottom)
      return
    }

    const { screenBounds, zoom } = mount
    const topHeight = scaleRound(getSafariTopHeight(paneId, state.compact), zoom)
    const bottomHeight = scaleRound(getSafariBottomHeight(paneId), zoom)

    const topBounds: Bounds = {
      x: Math.round(screenBounds.x),
      y: Math.round(screenBounds.y),
      width: Math.round(screenBounds.width),
      height: topHeight
    }
    const bottomBounds: Bounds = {
      x: Math.round(screenBounds.x),
      y: Math.round(screenBounds.y + screenBounds.height - bottomHeight),
      width: Math.round(screenBounds.width),
      height: bottomHeight
    }

    state.strips.top.view.setBounds(topBounds)
    state.strips.top.view.setVisible(topHeight > 0)
    state.strips.bottom.view.setBounds(bottomBounds)
    state.strips.bottom.view.setVisible(bottomHeight > 0)
  }

  private hideAllStrips(): void {
    for (const state of this.paneState.values()) {
      this.zeroStrip(state.strips.top)
      this.zeroStrip(state.strips.bottom)
    }
  }

  private zeroStrip(strip: StripEntry): void {
    strip.view.setVisible(false)
    strip.view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  }

  private pushAllState(): void {
    for (const paneId of CHROME_PANE_IDS) {
      this.pushPaneState(paneId)
    }
  }

  private pushPaneState(paneId: PaneId): void {
    const state = this.paneState.get(paneId)
    if (!state) return
    const visible = this.enabled && this.panesVisible
    for (const strip of [state.strips.top, state.strips.bottom]) {
      if (strip.view.webContents.isDestroyed()) continue
      const payload: SafariChromeStripState = {
        paneId,
        strip: strip.strip,
        url: state.url,
        compact: state.compact,
        visible
      }
      strip.view.webContents.send('safari-chrome:state', payload)
    }
  }

  private destroyStrip(strip: StripEntry): void {
    const mainWindow = this.mainWindow
    if (mainWindow && !mainWindow.isDestroyed() && strip.mounted) {
      try {
        mainWindow.contentView.removeChildView(strip.view)
      } catch {
        // already detached
      }
    }
    if (!strip.view.webContents.isDestroyed()) {
      strip.view.webContents.close()
    }
  }
}
