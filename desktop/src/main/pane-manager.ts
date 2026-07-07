import { session, type BrowserWindow, type WebContents } from 'electron'
import { DEVICE_PRESETS, PANE_IDS } from '../shared/device-presets'
import {
  createScrollSyncState,
  handleScrollEvent,
  setScrollSyncEnabled,
  type ScrollSyncState
} from '../shared/scroll-sync'
import type { PaneId, PaneMount } from '../shared/types'
import type { EngineView } from './engine-view'
import { getPanePreloadPath, WebContentsViewEngine } from './web-contents-view-engine'

const SHARED_PARTITION = 'persist:audit-screens-preview'

export class PaneManager {
  private readonly engines = new Map<PaneId, WebContentsViewEngine>()
  private readonly webContentsToPane = new Map<number, PaneId>()
  private readonly loadingState = new Map<PaneId, boolean>()
  private scrollSyncState: ScrollSyncState = createScrollSyncState(true)
  private mainWindow: BrowserWindow | null = null
  private sharedSession: Electron.Session | null = null
  private deviceReady: Promise<void> = Promise.resolve()
  private readonly lastMount = new Map<PaneId, PaneMount>()
  private destroyed = false

  initialize(mainWindow: BrowserWindow): void {
    this.destroyed = false
    this.mainWindow = mainWindow
    this.sharedSession = session.fromPartition(SHARED_PARTITION)
    this.setupSessionHeaders()

    this.deviceReady = Promise.all(
      PANE_IDS.map(async (paneId) => {
        await this.createEngine(paneId, mainWindow, null)
      })
    ).then(() => {})
  }

  getPaneIdForWebContents(webContents: WebContents): PaneId | null {
    return this.webContentsToPane.get(webContents.id) ?? null
  }

  mount(paneId: PaneId, mount: PaneMount): void {
    this.lastMount.set(paneId, mount)
    this.getEngine(paneId).mount(mount)
  }

  async navigateAll(url: string): Promise<void> {
    await this.deviceReady
    for (const paneId of PANE_IDS) {
      this.setPaneLoading(paneId, true)
    }
    await Promise.all(PANE_IDS.map((paneId) => this.getEngine(paneId).navigate(url)))
  }

  async recreateAll(): Promise<void> {
    await this.deviceReady
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return

    await Promise.all(
      PANE_IDS.map(async (paneId) => {
        const previousEngine = this.getEngine(paneId)
        const currentUrl = previousEngine.webContents.getURL()

        try {
          mainWindow.contentView.removeChildView(previousEngine.view)
        } catch {
          // The view may already be detached while Electron is relaying layout updates.
        }
        this.webContentsToPane.delete(previousEngine.webContents.id)
        previousEngine.destroy()

        await this.createEngine(paneId, mainWindow, currentUrl)
      })
    )
  }

  async syncScroll(paneId: PaneId, ratio: number, programmatic: boolean): Promise<void> {
    const { state, targets } = handleScrollEvent(
      this.scrollSyncState,
      { paneId, ratio, programmatic },
      PANE_IDS
    )
    this.scrollSyncState = state

    await Promise.all(targets.map((target) => this.getEngine(target.paneId).syncScroll(target.ratio)))
  }

  setScrollSyncEnabled(enabled: boolean): void {
    this.scrollSyncState = setScrollSyncEnabled(this.scrollSyncState, enabled)
  }

  isScrollSyncEnabled(): boolean {
    return this.scrollSyncState.enabled
  }

  getLoadingStates(): Record<PaneId, boolean> {
    return {
      iphone: this.loadingState.get('iphone') ?? false,
      ipad: this.loadingState.get('ipad') ?? false,
      desktop: this.loadingState.get('desktop') ?? false
    }
  }

  getEngineView(paneId: PaneId): EngineView {
    return this.getEngine(paneId)
  }

  async evaluateInPane<T>(paneId: PaneId, expression: string): Promise<T> {
    return this.getEngine(paneId).webContents.executeJavaScript(expression)
  }

  getUserAgentForPane(paneId: PaneId): string {
    return DEVICE_PRESETS[paneId].userAgent
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true

    const mainWindow = this.mainWindow
    for (const engine of this.engines.values()) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.contentView.removeChildView(engine.view)
        } catch {
          // Electron may already be tearing down the window tree.
        }
      }
      engine.destroy()
    }
    this.engines.clear()
    this.webContentsToPane.clear()
    this.mainWindow = null
    this.sharedSession = null
  }

  private getSharedSession(): Electron.Session {
    if (!this.sharedSession) {
      throw new Error('PaneManager.initialize must be called before using the shared session')
    }
    return this.sharedSession
  }

  private getEngine(paneId: PaneId): WebContentsViewEngine {
    const engine = this.engines.get(paneId)
    if (!engine) throw new Error(`Unknown pane: ${paneId}`)
    return engine
  }

  private async createEngine(
    paneId: PaneId,
    mainWindow: BrowserWindow,
    restoreUrl: string | null
  ): Promise<WebContentsViewEngine> {
    const engine = new WebContentsViewEngine(
      paneId,
      this.getSharedSession(),
      getPanePreloadPath()
    )
    this.engines.set(paneId, engine)
    this.webContentsToPane.set(engine.webContents.id, paneId)
    this.loadingState.set(paneId, false)
    mainWindow.contentView.addChildView(engine.view)
    this.attachLoadingListeners(engine.webContents, paneId)

    try {
      await engine.setDevice(DEVICE_PRESETS[paneId])
      const mount = this.lastMount.get(paneId)
      if (mount) {
        engine.mount(mount)
      }
      if (restoreUrl && restoreUrl !== 'about:blank') {
        await engine.navigate(restoreUrl)
      }
    } catch (error) {
      console.error(`Failed to create pane ${paneId}:`, error)
    }

    return engine
  }

  private setupSessionHeaders(): void {
    this.getSharedSession().webRequest.onBeforeSendHeaders(
      { urls: ['<all_urls>'] },
      (details, callback) => {
      const paneId = details.webContentsId
        ? this.webContentsToPane.get(details.webContentsId)
        : undefined

      if (paneId) {
        const headers = { ...details.requestHeaders }
        headers['User-Agent'] = DEVICE_PRESETS[paneId].userAgent
        callback({ requestHeaders: headers })
        return
      }

      callback({ requestHeaders: details.requestHeaders })
    }
    )
  }

  private setPaneLoading(paneId: PaneId, loading: boolean): void {
    this.loadingState.set(paneId, loading)
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return

    mainWindow.webContents.send('pane:loading', {
      paneId,
      loading
    })
  }

  private attachLoadingListeners(webContents: WebContents, paneId: PaneId): void {
    const setLoading = (loading: boolean): void => {
      this.setPaneLoading(paneId, loading)
    }

    webContents.on('did-start-loading', () => setLoading(true))
    webContents.on('did-stop-loading', () => setLoading(false))
    webContents.on('did-fail-load', () => setLoading(false))
  }
}
