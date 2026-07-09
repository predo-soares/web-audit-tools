import { dialog, session, type BrowserWindow, type WebContents } from 'electron'
import { writeFile } from 'fs/promises'
import { DEVICE_PRESETS, PANE_IDS } from '../shared/device-presets'
import type { ElementFingerprint } from '../shared/element-mirror'
import type { PaneId, PaneMount, PaneNavigationState, ThemePreference } from '../shared/types'
import { createActivePaneTracker } from './active-pane-tracker'
import { createEchoLedger } from './echo-ledger'
import type { EngineView, ValueSyncPayload } from './engine-view'
import { summarizeFingerprint, syncTrace, getSyncTraceLogs } from './sync-trace'
import { getPanePreloadPath, WebContentsViewEngine } from './web-contents-view-engine'

const SHARED_PARTITION = 'persist:audit-screens-preview'

export interface ScreenshotResult {
  saved: boolean
  filePath?: string
}

function screenshotDefaultName(paneId: PaneId): string {
  const slug = DEVICE_PRESETS[paneId].name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${slug}-${stamp}.png`
}
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
  private readonly engines = new Map<PaneId, WebContentsViewEngine>()
  private readonly paneInteractionEpoch = new Map<PaneId, number>()
  private readonly echoLedger = createEchoLedger()
  private readonly webContentsToPane = new Map<number, PaneId>()
  private readonly loadingState = new Map<PaneId, boolean>()
  private readonly tracker = createActivePaneTracker()
  private readonly pendingProgrammaticNavigation = new Set<PaneId>()
  // Pane last used for goBack()/goForward(). Keeps resolveNavigationPane()
  // pointing at the history source even when a synced pane steals focus.
  // Cleared on URL-bar navigation or any explicit user navigation in a pane.
  private historySourcePane: PaneId | null = null
  private readonly pendingHistoryNavigation = new Set<PaneId>()
  private syncEnabled = true
  private readonly valueSyncGeneration = new Map<string, number>()
  private mainWindow: BrowserWindow | null = null
  private sharedSession: Electron.Session | null = null
  private deviceReady: Promise<void> = Promise.resolve()
  private readonly lastMount = new Map<PaneId, PaneMount>()
  private themePreference: ThemePreference = 'system'
  private destroyed = false
  private readonly childViewStackListeners = new Set<() => void>()
  private historyHooks: NavigationHistoryHooks | null = null
  private overlayBroadcast: ((channel: string, ...args: unknown[]) => void) | null = null
  private pendingVisitUrl: string | null = null
  private pendingVisitFailed = false
  private pendingVisitInPage = false
  private activeClickMirrors = 0
  private clickMirrorCooldownUntil = 0

  setHistoryHooks(hooks: NavigationHistoryHooks | null): void {
    this.historyHooks = hooks
  }

  setOverlayBroadcast(handler: (channel: string, ...args: unknown[]) => void): void {
    this.overlayBroadcast = handler
  }

  private broadcastRendererEvent(channel: string, ...args: unknown[]): void {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
    mainWindow.webContents.send(channel, ...args)
    this.overlayBroadcast?.(channel, ...args)
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

  private restorePaneMount(paneId: PaneId): void {
    const mount = this.lastMount.get(paneId)
    if (mount) {
      this.getEngine(paneId).mount(mount)
    }
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
    }
    this.historySourcePane = null
    this.tracker.didNavigateAll(url)
    this.markPendingVisit(url, false)
    this.emitNavigationState()
    await Promise.all(PANE_IDS.map((paneId) => this.getEngine(paneId).navigate(url)))
  }

  stopLoadingAll(): void {
    for (const paneId of PANE_IDS) {
      this.pendingProgrammaticNavigation.delete(paneId)
      this.pendingHistoryNavigation.delete(paneId)
      this.getEngine(paneId).stop()
    }
  }

  async savePaneScreenshot(
    paneId: PaneId,
    parentWindow: BrowserWindow
  ): Promise<ScreenshotResult> {
    await this.deviceReady

    const { activePane } = this.tracker.getSnapshot()
    if (activePane !== paneId) {
      return { saved: false }
    }

    const trackedUrl = this.tracker.getPaneUrl(paneId)
    if (!trackedUrl || trackedUrl === 'about:blank') {
      return { saved: false }
    }

    let png: Buffer
    try {
      png = await this.getEngine(paneId).captureScreenshot()
    } finally {
      this.restorePaneMount(paneId)
    }

    const { canceled, filePath } = await dialog.showSaveDialog(parentWindow, {
      title: 'Save screenshot',
      defaultPath: screenshotDefaultName(paneId),
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    })

    if (canceled || !filePath) {
      return { saved: false }
    }

    await writeFile(filePath, png)
    return { saved: true, filePath }
  }

  async reloadAll(): Promise<void> {
    await this.deviceReady
    await Promise.all(
      PANE_IDS.map(async (paneId) => {
        const trackedUrl = this.tracker.getPaneUrl(paneId)
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
    const { activePane, barUrl, pageTitle, faviconUrl } = this.tracker.getSnapshot()
    return { activePane, barUrl, pageTitle, faviconUrl, canGoBack, canGoForward }
  }

  async goBack(): Promise<void> {
    await this.deviceReady
    const paneId = this.resolveNavigationPane()
    const webContents = this.getEngine(paneId).webContents
    if (!webContents.canGoBack()) return
    this.historySourcePane = paneId
    this.pendingHistoryNavigation.add(paneId)
    webContents.goBack()
  }

  async goForward(): Promise<void> {
    await this.deviceReady
    const paneId = this.resolveNavigationPane()
    const webContents = this.getEngine(paneId).webContents
    if (!webContents.canGoForward()) return
    this.historySourcePane = paneId
    this.pendingHistoryNavigation.add(paneId)
    webContents.goForward()
  }

  private resolveNavigationPane(): PaneId {
    return this.historySourcePane ?? this.tracker.getSnapshot().activePane ?? 'desktop'
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
    if (this.echoLedger.isEcho(paneId, 'click')) {
      syncTrace('click:echo-suppressed', { paneId })
      return
    }
    if (!this.syncEnabled) {
      syncTrace('click:sync-disabled', { sourcePane: paneId })
      return
    }

    this.activeClickMirrors += 1
    try {
      await Promise.all(
        PANE_IDS.map(async (targetId) => {
          if (targetId === paneId) return

          const engine = this.getEngine(targetId)
          const epochBeforeResolution = this.getPaneInteractionEpoch(targetId)

          // Prevent the scrollIntoView inside resolveClickPoint from
          // being broadcast as a real scroll to other panes.
          this.echoLedger.expect(targetId, 'scroll')

          const clickExpectation = this.echoLedger.expect(targetId, 'click')
          const resolution = await engine.resolveClickPoint(fingerprint)
          const epochAfterResolution = this.getPaneInteractionEpoch(targetId)
          const engineStale = engine !== this.engines.get(targetId)
          const epochStale = epochBeforeResolution !== epochAfterResolution

          const isHandled = resolution !== null && 'handled' in resolution
          const isLinkNav = resolution !== null && 'skipDispatch' in resolution
          const isDispatched = resolution !== null && 'dispatched' in resolution
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
                : isLinkNav
                  ? { matched: true, skipDispatch: true }
                  : isDispatched
                    ? { matched: true, dispatched: true }
                    : { matched: false }
              : { matched: false }
          })

          if (!resolution) {
            clickExpectation.revoke()
            return
          }
          if (engineStale) {
            clickExpectation.revoke()
            syncTrace('click:skipped-stale-engine', { targetPane: targetId })
            return
          }
          if (epochStale) {
            clickExpectation.revoke()
            syncTrace('click:skipped-stale-epoch', { targetPane: targetId, epochBefore: epochBeforeResolution, epochAfter: epochAfterResolution })
            return
          }

          if (isLinkNav && 'navigateTo' in resolution) {
            syncTrace('click:link-navigating', {
              targetPane: targetId,
              url: resolution.navigateTo
            })
            clickExpectation.revoke()
            this.pendingProgrammaticNavigation.add(targetId)
            this.setPaneLoading(targetId, true)
            try {
              await engine.navigate(resolution.navigateTo)
            } catch (error) {
              this.pendingProgrammaticNavigation.delete(targetId)
              this.setPaneLoading(targetId, false)
              syncTrace('click:link-navigate-failed', {
                targetPane: targetId,
                error: String(error)
              })
            }
            return
          }

          if (isHandled) {
            syncTrace('click:js-handled', { targetPane: targetId })
            clickExpectation.revoke()
            return
          }

          if (isDispatched) {
            syncTrace('click:dispatching', { targetPane: targetId })
            return
          }
        })
      )
    } finally {
      this.activeClickMirrors -= 1
      if (this.activeClickMirrors === 0) {
        this.clickMirrorCooldownUntil = Date.now() + 250
      }
    }
  }

  async syncValue(sourcePaneId: PaneId, fingerprint: ElementFingerprint, value: string): Promise<void> {
    syncTrace('value:received', { sourcePane: sourcePaneId, value, fingerprint: summarizeFingerprint(fingerprint) })
    if (this.echoLedger.isEcho(sourcePaneId, 'value')) {
      syncTrace('value:echo-suppressed', { sourcePane: sourcePaneId })
      return
    }
    if (!this.syncEnabled) return

    const fieldKey = JSON.stringify(fingerprint)
    const generation = (this.valueSyncGeneration.get(fieldKey) ?? 0) + 1
    this.valueSyncGeneration.set(fieldKey, generation)
    const payload: ValueSyncPayload = { value, generation }

    await Promise.all(
      PANE_IDS.map(async (targetId) => {
        if (targetId === sourcePaneId) return
        syncTrace('value:applying', { sourcePane: sourcePaneId, targetPane: targetId, generation })
        this.echoLedger.expect(targetId, 'value')
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
    if (this.echoLedger.isEcho(sourcePaneId, 'value')) {
      syncTrace('select:echo-suppressed', { sourcePane: sourcePaneId })
      return
    }
    if (!this.syncEnabled) return

    const fieldKey = JSON.stringify(fingerprint)
    const generation = (this.valueSyncGeneration.get(fieldKey) ?? 0) + 1
    this.valueSyncGeneration.set(fieldKey, generation)
    const payload: ValueSyncPayload = { value, selectedIndex, generation }

    await Promise.all(
      PANE_IDS.map(async (targetId) => {
        if (targetId === sourcePaneId) return
        syncTrace('select:applying', { sourcePane: sourcePaneId, targetPane: targetId, generation })
        this.echoLedger.expect(targetId, 'value')
        await this.getEngine(targetId).applyValue(fingerprint, payload)
      })
    )
  }

  async syncSubmit(sourcePaneId: PaneId, fingerprint: ElementFingerprint): Promise<void> {
    syncTrace('submit:received', { sourcePane: sourcePaneId, fingerprint: summarizeFingerprint(fingerprint) })
    if (this.echoLedger.isEcho(sourcePaneId, 'submit')) {
      syncTrace('submit:echo-suppressed', { sourcePane: sourcePaneId })
      return
    }
    if (!this.syncEnabled) return

    await Promise.all(
      PANE_IDS.map(async (targetId) => {
        if (targetId === sourcePaneId) return

        this.echoLedger.expect(targetId, 'submit')

        // Mark as programmatic so the resulting navigation doesn't cascade
        // back to the source pane via handleNavigation.
        this.pendingProgrammaticNavigation.add(targetId)

        syncTrace('submit:applying', { sourcePane: sourcePaneId, targetPane: targetId })
        await this.getEngine(targetId).submitForm(fingerprint)
      })
    )
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

  async syncScroll(paneId: PaneId, ratio: number, programmatic: boolean): Promise<void> {
    if (!this.syncEnabled) return

    // Always consume: a programmatic report from a pane also settles any
    // pending scroll-echo expectation for it.
    const isEcho = this.echoLedger.isEcho(paneId, 'scroll')
    if (programmatic || isEcho) return

    // A source-pane scroll from an in-flight mirrored click must not move
    // target panes before their replayed click lands.
    if (this.activeClickMirrors > 0 || Date.now() < this.clickMirrorCooldownUntil) return

    const targets = PANE_IDS.filter((targetId) => targetId !== paneId)
    for (const targetId of targets) {
      this.echoLedger.expect(targetId, 'scroll')
    }

    await Promise.all(targets.map((targetId) => this.getEngine(targetId).syncScroll(ratio)))
  }

  setSyncEnabled(enabled: boolean): void {
    this.syncEnabled = enabled
    // Pending scroll-echo expectations belong to the previous sync session;
    // clear them so a stale flag can't swallow the first scroll after re-enable.
    this.echoLedger.clear('scroll')
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
    this.broadcastRendererEvent('pane:loading', {
      paneId,
      loading
    })
  }

  private attachNavigationListeners(webContents: WebContents, paneId: PaneId): void {
    const handleNavigation = (url: string, inPage: boolean): void => {
      if (url === 'about:blank') return

      const isProgrammatic = this.pendingProgrammaticNavigation.has(paneId)
      if (isProgrammatic) {
        this.pendingProgrammaticNavigation.delete(paneId)
      }

      const isHistoryNav = this.pendingHistoryNavigation.has(paneId)
      this.pendingHistoryNavigation.delete(paneId)

      this.tracker.didNavigate(paneId, url, { inPage, isProgrammatic })

      if (isProgrammatic) return

      // A link click / JS navigation clears the history source so the newly
      // active pane becomes the one used for subsequent back/forward.
      if (!isHistoryNav) {
        this.historySourcePane = null
      }

      this.markPendingVisit(url, inPage)
      this.emitNavigationState()
    }

    webContents.on('did-navigate', (_event, url) => handleNavigation(url, false))
    webContents.on('did-navigate-in-page', (_event, url) => handleNavigation(url, true))
    webContents.on('did-start-loading', () => {
      this.bumpPaneInteractionEpoch(paneId)
    })
    webContents.on('page-title-updated', (_event, title) => {
      if (this.tracker.didTitleUpdate(paneId, title)) {
        this.emitNavigationState()
        this.emitMetadataUpdate()
      }
    })
    webContents.on('page-favicon-updated', (_event, favicons) => {
      const favicon = favicons[0] ?? null
      const applied = this.tracker.didFaviconUpdate(paneId, favicon)
      console.debug(
        '[favicon]',
        JSON.stringify({
          paneId,
          favicon,
          allCandidates: favicons,
          appliedToToolbar: applied,
          activePane: this.tracker.getSnapshot().activePane
        })
      )
      if (applied) {
        this.emitNavigationState()
        this.emitMetadataUpdate()
      }
    })
    webContents.on('did-fail-load', () => {
      this.pendingProgrammaticNavigation.delete(paneId)
      this.pendingHistoryNavigation.delete(paneId)
      if (this.pendingVisitUrl && this.tracker.getSnapshot().barUrl === this.pendingVisitUrl) {
        this.pendingVisitFailed = true
      }
    })
    webContents.on('did-stop-loading', () => {
      this.tryCommitVisit()
      // Re-emit after loading settles: canGoBack/canGoForward read from
      // Electron's navigation history, which may not be fully updated at
      // did-navigate time (e.g. after goBack/goForward).
      this.emitNavigationState()
    })
    webContents.on('focus', () => {
      this.tracker.didFocus(paneId)
      this.emitNavigationState()
    })
  }

  private emitNavigationState(): void {
    this.broadcastRendererEvent('pane:navigation', this.getNavigationState())
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
    const { barUrl, pageTitle, faviconUrl } = this.tracker.getSnapshot()
    if (this.pendingVisitUrl !== barUrl) return
    if (this.pendingVisitInPage === false && this.isAnyPaneLoading()) return

    this.historyHooks?.onVisitCommitted?.({ url: barUrl, title: pageTitle, faviconUrl })
    this.pendingVisitUrl = null
    this.pendingVisitInPage = false
  }

  private emitMetadataUpdate(): void {
    const { barUrl, pageTitle, faviconUrl } = this.tracker.getSnapshot()
    if (!barUrl || barUrl === 'about:blank') return
    this.historyHooks?.onMetadataUpdated?.({ url: barUrl, title: pageTitle, faviconUrl })
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
