import { session, type BrowserWindow, type WebContents } from 'electron'
import { DEVICE_PRESETS, PANE_IDS } from '../shared/device-presets'
import {
  createScrollSyncState,
  handleScrollEvent,
  setScrollSyncEnabled,
  type ScrollSyncState
} from '../shared/scroll-sync'
import type { ElementFingerprint } from '../shared/element-fingerprint'
import type { PaneId, PaneMount, PaneNavigationState, ThemePreference } from '../shared/types'
import type { EngineView, ValueSyncPayload } from './engine-view'
import { summarizeFingerprint, syncTrace, getSyncTraceLogs } from './sync-trace'
import { getPanePreloadPath, WebContentsViewEngine } from './web-contents-view-engine'

const SHARED_PARTITION = 'persist:audit-screens-preview'
export interface NavigationHistoryHooks {
  onVisitCommitted?: (state: {
    url: string
    title: string
    faviconUrl: string | null
  }) => void
  onMetadataUpdated?: (state: {
    url: string
    title: string
    faviconUrl: string | null
  }) => void
}

export class PaneManager {
  private static readonly SYNTHETIC_CLICK_TTL_MS = 1000
  private static readonly SYNTHETIC_SUBMIT_TTL_MS = 1000

  private readonly engines = new Map<PaneId, WebContentsViewEngine>()
  private readonly paneInteractionEpoch = new Map<PaneId, number>()
  private readonly syntheticClickExpiry = new Map<PaneId, number[]>()
  private readonly syntheticSubmitExpiry = new Map<PaneId, number[]>()
  private readonly webContentsToPane = new Map<number, PaneId>()
  private readonly loadingState = new Map<PaneId, boolean>()
  private readonly paneUrls = new Map<PaneId, string>()
  private readonly paneTitles = new Map<PaneId, string>()
  private readonly paneFavicons = new Map<PaneId, string>()
  private activePane: PaneId | null = null
  private barUrl = ''
  private pageTitle = ''
  private faviconUrl: string | null = null
  private readonly pendingProgrammaticNavigation = new Set<PaneId>()
  private syncEnabled = true
  private scrollSyncState: ScrollSyncState = createScrollSyncState(true)
  private mainWindow: BrowserWindow | null = null
  private sharedSession: Electron.Session | null = null
  private deviceReady: Promise<void> = Promise.resolve()
  private readonly lastMount = new Map<PaneId, PaneMount>()
  private themePreference: ThemePreference = 'system'
  private destroyed = false
  private readonly childViewStackListeners = new Set<() => void>()
  private historyHooks: NavigationHistoryHooks | null = null
  private pendingVisitUrl: string | null = null
  private pendingVisitFailed = false
  private pendingVisitInPage = false

  setHistoryHooks(hooks: NavigationHistoryHooks | null): void {
    this.historyHooks = hooks
  }

  onChildViewStackChanged(listener: () => void): () => void {
    this.childViewStackListeners.add(listener)
    return () => {
      this.childViewStackListeners.delete(listener)
    }
  }

  private notifyChildViewStackChanged(): void {
    for (const listener of this.childViewStackListeners) {
      listener()
    }
  }

  initialize(mainWindow: BrowserWindow): void {
    this.destroyed = false
    this.mainWindow = mainWindow
    this.sharedSession = session.fromPartition(SHARED_PARTITION)
    this.setupSessionHeaders()

    this.deviceReady = Promise.all(
      PANE_IDS.map(async (paneId) => {
        await this.createEngine(paneId, mainWindow, null)
      })
    )
      .catch((error) => {
        console.error('Failed to initialize preview panes:', error)
      })
      .then(() => {})
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
    await this.doNavigateAll(url)
  }

  private async doNavigateAll(url: string): Promise<void> {
    this.setPanesVisible(true)
    for (const paneId of PANE_IDS) {
      this.pendingProgrammaticNavigation.add(paneId)
      this.setPaneLoading(paneId, true)
      this.paneUrls.set(paneId, url)
      this.paneTitles.set(paneId, '')
    }
    this.barUrl = url
    this.activePane = null
    this.pageTitle = ''
    this.faviconUrl = null
    this.markPendingVisit(url, false)
    this.emitNavigationState()
    await Promise.all(PANE_IDS.map((paneId) => this.getEngine(paneId).navigate(url)))
  }

  async reloadAll(): Promise<void> {
    await this.deviceReady
    await Promise.all(
      PANE_IDS.map(async (paneId) => {
        const trackedUrl = this.paneUrls.get(paneId)
        const liveUrl = this.getEngine(paneId).webContents.getURL()
        const url =
          trackedUrl && trackedUrl !== 'about:blank'
            ? trackedUrl
            : liveUrl !== 'about:blank'
              ? liveUrl
              : null
        if (!url) return

        this.pendingProgrammaticNavigation.add(paneId)
        this.setPaneLoading(paneId, true)
        await this.getEngine(paneId).navigate(url)
      })
    )
  }

  getNavigationState(): PaneNavigationState {
    const { canGoBack, canGoForward } = this.getNavigationCapabilities()
    return {
      activePane: this.activePane,
      barUrl: this.barUrl,
      pageTitle: this.pageTitle,
      faviconUrl: this.faviconUrl,
      canGoBack,
      canGoForward
    }
  }

  async goBack(): Promise<void> {
    await this.deviceReady
    const paneId = this.resolveNavigationPane()
    const webContents = this.getEngine(paneId).webContents
    if (!webContents.canGoBack()) return
    webContents.goBack()
  }

  async goForward(): Promise<void> {
    await this.deviceReady
    const paneId = this.resolveNavigationPane()
    const webContents = this.getEngine(paneId).webContents
    if (!webContents.canGoForward()) return
    webContents.goForward()
  }

  private resolveNavigationPane(): PaneId {
    return this.activePane ?? 'desktop'
  }

  private getNavigationCapabilities(): { canGoBack: boolean; canGoForward: boolean } {
    const webContents = this.getEngine(this.resolveNavigationPane()).webContents
    // Electron counts the initial about:blank → real-page navigation as a
    // history entry, so canGoBack() is true after the very first load.
    // Only report canGoBack if there is a meaningful (non-blank) entry behind.
    const history = webContents.navigationHistory
    const activeIndex = history.getActiveIndex()
    const prevEntry = activeIndex > 0 ? history.getEntryAtIndex(activeIndex - 1) : null
    const canGoBack = webContents.canGoBack() && prevEntry?.url !== 'about:blank'
    return {
      canGoBack,
      canGoForward: webContents.canGoForward()
    }
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

  async syncClick(paneId: PaneId, fingerprint: ElementFingerprint): Promise<void> {
    syncTrace('click:received', { sourcePane: paneId, fingerprint: summarizeFingerprint(fingerprint) })

    // Synthetic clicks are real input events, so the target pane's preload
    // re-reports them. Consume that echo here instead of broadcasting it,
    // otherwise panes ping-pong clicks forever.
    if (this.consumeSyntheticClick(paneId)) {
      syncTrace('click:echo-suppressed', { paneId })
      return
    }
    if (!this.syncEnabled) {
      syncTrace('click:sync-disabled', { sourcePane: paneId })
      return
    }

    await Promise.all(
      PANE_IDS.map(async (targetId) => {
        if (targetId === paneId) return

        const engine = this.getEngine(targetId)
        const epochBeforeResolution = this.getPaneInteractionEpoch(targetId)

        // Prevent the scrollIntoView inside resolveClickPoint from
        // being broadcast as a real scroll to other panes.
        this.scrollSyncState = {
          ...this.scrollSyncState,
          echoFrom: { ...this.scrollSyncState.echoFrom, [targetId]: true }
        }

        const resolution = await engine.resolveClickPoint(fingerprint)
        const epochAfterResolution = this.getPaneInteractionEpoch(targetId)
        const engineStale = engine !== this.engines.get(targetId)
        const epochStale = epochBeforeResolution !== epochAfterResolution

        const isHandled = resolution !== null && 'handled' in resolution
        syncTrace('click:target-resolved', {
          sourcePane: paneId,
          targetPane: targetId,
          epochBefore: epochBeforeResolution,
          epochAfter: epochAfterResolution,
          engineStale,
          epochStale,
          resolution: resolution
            ? isHandled
              ? { matched: true, handled: true }
              : { matched: true, x: (resolution as { x: number; y: number }).x, y: (resolution as { x: number; y: number }).y }
            : { matched: false }
        })

        if (!resolution) return
        if (engineStale) {
          syncTrace('click:skipped-stale-engine', { targetPane: targetId })
          return
        }
        if (epochStale) {
          syncTrace('click:skipped-stale-epoch', { targetPane: targetId, epochBefore: epochBeforeResolution, epochAfter: epochAfterResolution })
          return
        }

        const queue = this.syntheticClickExpiry.get(targetId) ?? []
        queue.push(Date.now() + PaneManager.SYNTHETIC_CLICK_TTL_MS)
        this.syntheticClickExpiry.set(targetId, queue)

        if (isHandled) {
          syncTrace('click:js-handled', { targetPane: targetId })
          return
        }

        const coords = resolution as { x: number; y: number }
        syncTrace('click:dispatching', { targetPane: targetId, x: coords.x, y: coords.y })
        engine.dispatchClick(coords.x, coords.y)
      })
    )
  }

  async syncValue(sourcePaneId: PaneId, fingerprint: ElementFingerprint, value: string): Promise<void> {
    syncTrace('value:received', { sourcePane: sourcePaneId, value, fingerprint: summarizeFingerprint(fingerprint) })
    if (!this.syncEnabled) return
    const payload: ValueSyncPayload = { value }

    await Promise.all(
      PANE_IDS.map(async (targetId) => {
        if (targetId === sourcePaneId) return
        syncTrace('value:applying', { sourcePane: sourcePaneId, targetPane: targetId })
        await this.getEngine(targetId).applyValue(fingerprint, payload)
      })
    )
  }

  async syncSelectValue(
    sourcePaneId: PaneId,
    fingerprint: ElementFingerprint,
    value: string,
    selectedIndex: number
  ): Promise<void> {
    syncTrace('select:received', {
      sourcePane: sourcePaneId,
      value,
      selectedIndex,
      fingerprint: summarizeFingerprint(fingerprint)
    })
    if (!this.syncEnabled) return
    const payload: ValueSyncPayload = { value, selectedIndex }

    await Promise.all(
      PANE_IDS.map(async (targetId) => {
        if (targetId === sourcePaneId) return
        syncTrace('select:applying', { sourcePane: sourcePaneId, targetPane: targetId })
        await this.getEngine(targetId).applyValue(fingerprint, payload)
      })
    )
  }

  async syncSubmit(sourcePaneId: PaneId, fingerprint: ElementFingerprint): Promise<void> {
    syncTrace('submit:received', { sourcePane: sourcePaneId, fingerprint: summarizeFingerprint(fingerprint) })
    if (this.consumeSyntheticSubmit(sourcePaneId)) {
      syncTrace('submit:echo-suppressed', { sourcePane: sourcePaneId })
      return
    }
    if (!this.syncEnabled) return

    await Promise.all(
      PANE_IDS.map(async (targetId) => {
        if (targetId === sourcePaneId) return

        const queue = this.syntheticSubmitExpiry.get(targetId) ?? []
        queue.push(Date.now() + PaneManager.SYNTHETIC_SUBMIT_TTL_MS)
        this.syntheticSubmitExpiry.set(targetId, queue)

        syncTrace('submit:applying', { sourcePane: sourcePaneId, targetPane: targetId })
        await this.getEngine(targetId).submitForm(fingerprint)
      })
    )
  }

  private consumeSyntheticSubmit(paneId: PaneId): boolean {
    const queue = this.syntheticSubmitExpiry.get(paneId)
    if (!queue?.length) return false
    const now = Date.now()
    while (queue.length) {
      const expiry = queue.shift()
      if (expiry !== undefined && expiry >= now) return true
    }
    return false
  }

  getMirrorFailureLogs(): Record<PaneId, ReturnType<EngineView['getMirrorFailureLogs']>> {
    return {
      iphone: this.getEngine('iphone').getMirrorFailureLogs(),
      ipad: this.getEngine('ipad').getMirrorFailureLogs(),
      desktop: this.getEngine('desktop').getMirrorFailureLogs()
    }
  }

  getSyncTraceLogs(): ReturnType<typeof import('./sync-trace').getSyncTraceLogs> {
    return getSyncTraceLogs()
  }

  private consumeSyntheticClick(paneId: PaneId): boolean {
    const queue = this.syntheticClickExpiry.get(paneId)
    if (!queue?.length) return false
    const now = Date.now()
    // Expired entries mean the synthetic click never produced a click event
    // (e.g. mousedown/mouseup landed on different elements) — drop them so
    // they can't swallow a later real click.
    while (queue.length) {
      const expiry = queue.shift()
      if (expiry !== undefined && expiry >= now) return true
    }
    return false
  }

  async syncScroll(paneId: PaneId, ratio: number, programmatic: boolean): Promise<void> {
    const { state, targets } = handleScrollEvent(
      this.scrollSyncState,
      { paneId, ratio, programmatic },
      PANE_IDS
    )
    this.scrollSyncState = state

    await Promise.all(
      targets.map((target) => this.getEngine(target.paneId).syncScroll(target.ratio))
    )
  }

  setSyncEnabled(enabled: boolean): void {
    this.syncEnabled = enabled
    this.scrollSyncState = setScrollSyncEnabled(this.scrollSyncState, enabled)
  }

  isSyncEnabled(): boolean {
    return this.syncEnabled
  }

  async setThemePreference(preference: ThemePreference): Promise<void> {
    this.themePreference = preference
    await this.deviceReady
    await Promise.all(
      PANE_IDS.map((paneId) => this.getEngine(paneId).setThemePreference(preference))
    )
  }

  getLoadingStates(): Record<PaneId, boolean> {
    return {
      iphone: this.loadingState.get('iphone') ?? false,
      ipad: this.loadingState.get('ipad') ?? false,
      desktop: this.loadingState.get('desktop') ?? false
    }
  }

  setPanesVisible(visible: boolean): void {
    for (const paneId of PANE_IDS) {
      this.getEngine(paneId).view.setVisible(visible)
    }

    if (visible) {
      for (const paneId of PANE_IDS) {
        const mount = this.lastMount.get(paneId)
        if (mount) {
          this.getEngine(paneId).mount(mount)
        }
      }
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

  private bumpPaneInteractionEpoch(paneId: PaneId): void {
    this.paneInteractionEpoch.set(paneId, this.getPaneInteractionEpoch(paneId) + 1)
  }

  private getPaneInteractionEpoch(paneId: PaneId): number {
    return this.paneInteractionEpoch.get(paneId) ?? 0
  }

  private async createEngine(
    paneId: PaneId,
    mainWindow: BrowserWindow,
    restoreUrl: string | null
  ): Promise<WebContentsViewEngine> {
    const engine = new WebContentsViewEngine(paneId, this.getSharedSession(), getPanePreloadPath())
    this.engines.set(paneId, engine)
    this.bumpPaneInteractionEpoch(paneId)
    this.webContentsToPane.set(engine.webContents.id, paneId)
    this.loadingState.set(paneId, false)
    mainWindow.contentView.addChildView(engine.view)
    engine.view.setVisible(false)
    this.notifyChildViewStackChanged()
    this.attachLoadingListeners(engine.webContents, paneId)
    this.attachNavigationListeners(engine.webContents, paneId)

    try {
      await engine.setDevice(DEVICE_PRESETS[paneId])
      await engine.setThemePreference(this.themePreference)
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

  private attachNavigationListeners(webContents: WebContents, paneId: PaneId): void {
    const handleNavigation = (url: string, inPage: boolean): void => {
      if (url === 'about:blank') return

      if (this.pendingProgrammaticNavigation.has(paneId)) {
        this.pendingProgrammaticNavigation.delete(paneId)
        this.paneUrls.set(paneId, url)
        return
      }

      this.paneUrls.set(paneId, url)
      this.activePane = paneId
      this.barUrl = url
      this.pageTitle = this.paneTitles.get(paneId) ?? ''
      this.faviconUrl = this.paneFavicons.get(paneId) ?? null
      this.markPendingVisit(url, inPage)
      this.emitNavigationState()
    }

    webContents.on('did-navigate', (_event, url) => handleNavigation(url, false))
    webContents.on('did-navigate-in-page', (_event, url) => handleNavigation(url, true))
    webContents.on('did-start-loading', () => {
      this.bumpPaneInteractionEpoch(paneId)
    })
    webContents.on('page-title-updated', (_event, title) => {
      this.paneTitles.set(paneId, title)
      if (this.activePane === paneId || (this.activePane === null && this.barUrl === this.paneUrls.get(paneId))) {
        this.pageTitle = title
        this.emitNavigationState()
        this.emitMetadataUpdate()
      }
    })
    webContents.on('page-favicon-updated', (_event, favicons) => {
      const favicon = favicons[0] ?? null
      this.paneFavicons.set(paneId, favicon ?? '')
      if (this.activePane === paneId || (this.activePane === null && this.barUrl === this.paneUrls.get(paneId))) {
        this.faviconUrl = favicon
        this.emitNavigationState()
        this.emitMetadataUpdate()
      }
    })
    webContents.on('did-fail-load', () => {
      this.pendingProgrammaticNavigation.delete(paneId)
      if (this.pendingVisitUrl && this.barUrl === this.pendingVisitUrl) {
        this.pendingVisitFailed = true
      }
    })
    webContents.on('did-stop-loading', () => {
      this.tryCommitVisit()
    })
    webContents.on('focus', () => {
      this.activePane = paneId
      const url = this.paneUrls.get(paneId)
      if (url && url !== 'about:blank') {
        this.barUrl = url
        this.pageTitle = this.paneTitles.get(paneId) ?? ''
        this.faviconUrl = this.paneFavicons.get(paneId) ?? null
        this.emitNavigationState()
      }
    })
  }

  private emitNavigationState(): void {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return

    mainWindow.webContents.send('pane:navigation', this.getNavigationState())
  }

  private markPendingVisit(url: string, inPage: boolean): void {
    if (url === 'about:blank') return

    this.pendingVisitUrl = url
    this.pendingVisitFailed = false
    this.pendingVisitInPage = inPage

    if (inPage) {
      this.tryCommitVisit()
    }
  }

  private tryCommitVisit(): void {
    if (!this.pendingVisitUrl || this.pendingVisitFailed) return
    if (this.pendingVisitUrl !== this.barUrl) return
    if (this.pendingVisitInPage === false && this.isAnyPaneLoading()) return

    this.historyHooks?.onVisitCommitted?.({
      url: this.barUrl,
      title: this.pageTitle,
      faviconUrl: this.faviconUrl
    })
    this.pendingVisitUrl = null
    this.pendingVisitInPage = false
  }

  private emitMetadataUpdate(): void {
    if (!this.barUrl || this.barUrl === 'about:blank') return

    this.historyHooks?.onMetadataUpdated?.({
      url: this.barUrl,
      title: this.pageTitle,
      faviconUrl: this.faviconUrl
    })
  }

  private isAnyPaneLoading(): boolean {
    for (const paneId of PANE_IDS) {
      if (this.loadingState.get(paneId)) return true
    }
    return false
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
