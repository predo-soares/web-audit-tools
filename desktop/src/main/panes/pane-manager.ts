import { dialog, session, type BrowserWindow, type WebContents } from 'electron'
import { writeFile } from 'fs/promises'
import { DEVICE_PRESETS, PANE_IDS } from '../../shared/device-presets'
import type { ElementFingerprint } from '../../shared/element-mirror'
import {
  createInspectionRecord,
  EMPTY_INSPECTION_STATE,
  getInspectionMarkupChildrenExpression,
  type InspectionMarkupNode,
  type InspectionPageSnapshot,
  type InspectionState,
  type InspectionTarget
} from '../../shared/inspection'
import type {
  DeviceProfile,
  MediaFeatureState,
  PaneId,
  PaneMount,
  PaneNavigationState,
  ThemePreference
} from '../../shared/pane-types'
import { DEFAULT_MEDIA_FEATURES } from '../../shared/pane-types'
import { normalizeMediaFeatures } from '../../shared/media-features'
import {
  RUNTIME_EVIDENCE_EMIT_WINDOW_MS,
  type RuntimeEvidenceChannel,
  type RuntimeEvidenceProblemCount,
  type RuntimeEvidenceSnapshot
} from '../../shared/runtime-evidence'
import type { DevContext } from '../../shared/dev-context'
import {
  APPLICATION_DATA_EXPRESSION,
  EMPTY_APPLICATION_DATA,
  type ApplicationData
} from '../../shared/application-data'
import { isLocalhostUrl } from '../../shared/dev-context'
import { resolveDevContext } from '../services/dev-context'
import { createActivePaneTracker } from './active-pane-tracker'
import { createEchoLedger } from './echo-ledger'
import type {
  EngineView,
  EngineViewEventMap,
  MirroredKey,
  ValueSyncPayload
} from '../engine/engine-view'
import {
  createRuntimeEvidenceBuffer,
  type RuntimeEvidenceBuffer
} from '../evidence/runtime-evidence-buffer'
import { summarizeFingerprint, syncTrace, getSyncTraceLogs } from '../services/sync-trace'
import { getPanePreloadPath, WebContentsViewEngine } from '../engine/web-contents-view-engine'

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
  onVisitCommitted?: (state: { url: string; title: string; faviconUrl: string | null }) => void
  onMetadataUpdated?: (state: { url: string; title: string; faviconUrl: string | null }) => void
}

export class PaneManager {
  private readonly engines = new Map<PaneId, EngineView>()
  private readonly runtimeEvidence = new Map<PaneId, RuntimeEvidenceBuffer>()
  private readonly paneInteractionEpoch = new Map<PaneId, number>()
  private readonly echoLedger = createEchoLedger()
  private readonly webContentsToPane = new Map<number, PaneId>()
  private readonly loadingState = new Map<PaneId, boolean>()
  private readonly loadErrorState = new Map<PaneId, { code: number; description: string } | null>()
  private readonly lastNavTimestamps = new Map<PaneId, number>()
  private readonly tracker = createActivePaneTracker()
  private readonly pendingProgrammaticNavigation = new Set<PaneId>()
  // Pane last used for goBack()/goForward(). Keeps resolveNavigationPane()
  // pointing at the history source even when a synced pane steals focus.
  // Cleared on URL-bar navigation or any explicit user navigation in a pane.
  private historySourcePane: PaneId | null = null
  private readonly pendingHistoryNavigation = new Set<PaneId>()
  private readonly linkedPanes = new Set<PaneId>(PANE_IDS)
  private readonly valueSyncGeneration = new Map<string, number>()
  private mainWindow: BrowserWindow | null = null
  private sharedSession: Electron.Session | null = null
  private deviceReady: Promise<void> = Promise.resolve()
  private readonly lastMount = new Map<PaneId, PaneMount>()
  private readonly paneProfiles = new Map<PaneId, DeviceProfile>()
  private panesVisible = true
  // When set, only this pane's native view is shown; the others are hidden even
  // while the workspace-level panes are visible. Kept in the main process so it
  // survives events that re-show all panes (navigation, workspace switches).
  private focusedPane: PaneId | null = null
  private themePreference: ThemePreference = 'system'
  private mediaFeatures: MediaFeatureState = DEFAULT_MEDIA_FEATURES
  private paneBeforeInputHooks: Array<EngineViewEventMap['before-input']> = []
  private destroyed = false
  private readonly childViewStackListeners = new Set<() => void>()
  private readonly paneDocumentChangeListeners = new Set<(paneId: PaneId) => void>()
  private historyHooks: NavigationHistoryHooks | null = null
  private overlayBroadcast: ((channel: string, ...args: unknown[]) => void) | null = null
  private safariChromeHooks: {
    onMount: (paneId: PaneId, mount: PaneMount) => void
    onScroll: (paneId: PaneId, scrollY: number, programmatic: boolean) => void
    onNavigationState: (urls: Partial<Record<PaneId, string>>) => void
    setPanesVisible: (visible: boolean) => void
    captureComposited: (paneId: PaneId, capturePage: () => Promise<Buffer>) => Promise<Buffer>
    destroy: () => void
  } | null = null
  private diagnosticsEvidenceSink: {
    isOpen: () => boolean
    send: (snapshot: RuntimeEvidenceSnapshot) => void
  } | null = null
  private evidenceEmitTimer: ReturnType<typeof setTimeout> | null = null
  private evidenceEmitPending = false
  private pendingVisitUrl: string | null = null
  private pendingVisitFailed = false
  private pendingVisitInPage = false
  private activeClickMirrors = 0
  private clickMirrorSourcePane: PaneId | null = null
  private clickMirrorCooldownUntil = 0
  private historySourceLock: { paneId: PaneId; until: number } | null = null
  private readonly mirrorLinkTargetPanes = new Set<PaneId>()
  private devContext: DevContext | null | undefined = undefined
  private devContextPromise: Promise<void> | null = null
  private inspectionMode = false
  private inspectionRequestId = 0
  private inspectionState: InspectionState = EMPTY_INSPECTION_STATE

  setHistoryHooks(hooks: NavigationHistoryHooks | null): void {
    this.historyHooks = hooks
  }

  getDevContext(): DevContext | null {
    return this.devContext ?? null
  }

  async getDevContextAsync(): Promise<DevContext | null> {
    if (this.devContextPromise) await this.devContextPromise
    return this.getDevContext()
  }

  private maybeResolveDevContext(url: string): void {
    if (this.devContext !== undefined || this.devContextPromise) return
    if (!isLocalhostUrl(url)) return

    this.devContextPromise = resolveDevContext(process.cwd())
      .then((ctx) => {
        this.devContext = ctx
      })
      .catch(() => {
        this.devContext = null
      })
      .finally(() => {
        this.devContextPromise = null
      })
  }

  setOverlayBroadcast(handler: (channel: string, ...args: unknown[]) => void): void {
    this.overlayBroadcast = handler
  }

  setSafariChromeHooks(
    hooks: {
      onMount: (paneId: PaneId, mount: PaneMount) => void
      onScroll: (paneId: PaneId, scrollY: number, programmatic: boolean) => void
      onNavigationState: (urls: Partial<Record<PaneId, string>>) => void
      setPanesVisible: (visible: boolean) => void
      captureComposited: (paneId: PaneId, capturePage: () => Promise<Buffer>) => Promise<Buffer>
      destroy: () => void
    } | null
  ): void {
    this.safariChromeHooks = hooks
  }

  getLastMount(paneId: PaneId): PaneMount | undefined {
    return this.lastMount.get(paneId)
  }

  getTrackedPaneUrl(paneId: PaneId): string {
    return this.tracker.getPaneUrl(paneId) ?? ''
  }

  broadcastOverlayEvent(channel: string, ...args: unknown[]): void {
    this.overlayBroadcast?.(channel, ...args)
  }

  setDiagnosticsEvidenceSink(sink: {
    isOpen: () => boolean
    send: (snapshot: RuntimeEvidenceSnapshot) => void
  }): void {
    this.diagnosticsEvidenceSink = sink
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

  /**
   * Subscribe to a pane's document changing — a new top-level load starting
   * (reload or navigation) or the pane being torn down. Lets the Page SEO audit
   * cancel a job bound to that pane before findings can describe the new
   * document, and mark a completed result stale.
   */
  onPaneDocumentChange(listener: (paneId: PaneId) => void): () => void {
    this.paneDocumentChangeListeners.add(listener)
    return () => {
      this.paneDocumentChangeListeners.delete(listener)
    }
  }

  private notifyPaneDocumentChange(paneId: PaneId): void {
    this.markInspectionPaneStatus(paneId, 'stale')
    for (const listener of this.paneDocumentChangeListeners) {
      listener(paneId)
    }
  }

  /**
   * Subscribe to `before-input` on every pane engine — existing and any created
   * later — through the EngineView seam. Lets callers observe keyboard input
   * (e.g. a pane-scoped shortcut) without reaching into raw webContents.
   */
  onPaneBeforeInput(handler: EngineViewEventMap['before-input']): void {
    this.paneBeforeInputHooks.push(handler)
    for (const engine of this.engines.values()) {
      engine.on('before-input', handler)
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
    this.safariChromeHooks?.onMount(paneId, mount)
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

  async savePaneScreenshot(paneId: PaneId, parentWindow: BrowserWindow): Promise<ScreenshotResult> {
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
      png = await this.capturePaneScreenshot(paneId)
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
        const liveUrl = this.getEngine(paneId).getCurrentUrl()
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

  getRuntimeEvidenceSnapshot(): RuntimeEvidenceSnapshot {
    const paneId = this.resolveActivePaneForEvidence()
    const buffer = this.runtimeEvidence.get(paneId)
    return buffer?.snapshot(paneId) ?? { paneId, console: [], network: [], problemCount: 0 }
  }

  getRuntimeEvidenceProblemCount(): RuntimeEvidenceProblemCount {
    const paneId = this.resolveActivePaneForEvidence()
    const buffer = this.runtimeEvidence.get(paneId)
    const problemCount = buffer
      ? buffer.getConsoleProblemCount() + buffer.getNetworkProblemCount()
      : 0
    return { paneId, problemCount }
  }

  async getApplicationData(): Promise<ApplicationData> {
    const paneId = this.resolveActivePaneForEvidence()
    const url = this.getTrackedPaneUrl(paneId)
    if (!url || url === 'about:blank') {
      return { ...EMPTY_APPLICATION_DATA, paneId, url }
    }

    try {
      const data = await this.evaluateInPane<Omit<ApplicationData, 'paneId'>>(
        paneId,
        APPLICATION_DATA_EXPRESSION
      )
      return { ...data, paneId }
    } catch {
      return { ...EMPTY_APPLICATION_DATA, paneId, url }
    }
  }

  clearRuntimeEvidence(channel: RuntimeEvidenceChannel): RuntimeEvidenceSnapshot {
    const paneId = this.resolveActivePaneForEvidence()
    const buffer = this.runtimeEvidence.get(paneId)
    if (buffer) {
      if (channel === 'console') {
        buffer.clearConsole()
      } else {
        buffer.clearNetwork()
      }
    }
    const snapshot = this.getRuntimeEvidenceSnapshot()
    this.scheduleRuntimeEvidenceEmit()
    return snapshot
  }

  focusPane(paneId: PaneId): void {
    this.historySourcePane = paneId
    this.tracker.didFocus(paneId)
    this.emitNavigationState()
    this.getEngine(paneId).focus()
  }

  private resolveActivePaneForEvidence(): PaneId {
    return this.tracker.getSnapshot().activePane ?? 'desktop'
  }

  private notifyRuntimeEvidenceChanged(paneId: PaneId): void {
    if (paneId !== this.resolveActivePaneForEvidence()) return
    this.scheduleRuntimeEvidenceEmit()
  }

  private emitRuntimeEvidenceIfActivePaneChanged(): void {
    this.scheduleRuntimeEvidenceEmit()
  }

  // Leading + trailing coalescing: the first event after idle emits
  // immediately (a single error on a quiet page reaches the badge instantly);
  // a burst collapses into one trailing emission with the final state per
  // window. Under sustained load this emits at most once per window.
  private scheduleRuntimeEvidenceEmit(): void {
    if (this.evidenceEmitTimer) {
      this.evidenceEmitPending = true
      return
    }
    this.emitRuntimeEvidence()
    this.evidenceEmitTimer = setTimeout(
      this.flushEvidenceEmitWindow,
      RUNTIME_EVIDENCE_EMIT_WINDOW_MS
    )
  }

  private flushEvidenceEmitWindow = (): void => {
    if (this.evidenceEmitPending) {
      this.evidenceEmitPending = false
      this.emitRuntimeEvidence()
      this.evidenceEmitTimer = setTimeout(
        this.flushEvidenceEmitWindow,
        RUNTIME_EVIDENCE_EMIT_WINDOW_MS
      )
      return
    }
    this.evidenceEmitTimer = null
  }

  // Evidence notifications are sized to their consumers: overlay panels get
  // the lightweight problem-count payload (toolbar badge); full snapshots go
  // only to the diagnostics drawer, whose lazy Panel lifecycle is the gate —
  // closed drawer means the snapshot is never even assembled. The shell
  // window has no evidence subscriber, so it gets no send at all.
  private emitRuntimeEvidence(): void {
    this.overlayBroadcast?.('runtime-evidence:problem-count', this.getRuntimeEvidenceProblemCount())
    if (this.diagnosticsEvidenceSink?.isOpen()) {
      this.diagnosticsEvidenceSink.send(this.getRuntimeEvidenceSnapshot())
    }
  }

  async goBack(): Promise<void> {
    await this.deviceReady
    const paneId = this.resolveNavigationPane()
    const engine = this.getEngine(paneId)
    if (!engine.canGoBack()) return
    if (engine.getPreviousEntryUrl() === 'about:blank') return
    this.historySourcePane = paneId
    this.pendingHistoryNavigation.add(paneId)
    await engine.evaluate('history.back()')
  }

  async goForward(): Promise<void> {
    await this.deviceReady
    const paneId = this.resolveNavigationPane()
    const engine = this.getEngine(paneId)
    if (!engine.canGoForward()) return
    this.historySourcePane = paneId
    this.pendingHistoryNavigation.add(paneId)
    await engine.evaluate('history.forward()')
  }

  private resolveNavigationPane(): PaneId {
    return this.historySourcePane ?? this.tracker.getSnapshot().activePane ?? 'desktop'
  }

  private getNavigationCapabilities(): { canGoBack: boolean; canGoForward: boolean } {
    const engine = this.getEngine(this.resolveNavigationPane())
    // Electron counts the initial about:blank → real-page navigation as a
    // history entry, so canGoBack() is true after the very first load.
    // Only report canGoBack if there is a meaningful (non-blank) entry behind.
    const canGoBack = engine.canGoBack() && engine.getPreviousEntryUrl() !== 'about:blank'
    return {
      canGoBack,
      canGoForward: engine.canGoForward()
    }
  }

  async recreateAll(): Promise<void> {
    await this.deviceReady
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return

    await Promise.all(
      PANE_IDS.map(async (paneId) => {
        const previousEngine = this.getEngine(paneId)
        const currentUrl = previousEngine.getCurrentUrl()

        // The pane's document is being torn down; cancel any audit bound to it.
        this.notifyPaneDocumentChange(paneId)

        previousEngine.detach(mainWindow)
        this.webContentsToPane.delete(previousEngine.getWebContentsId())
        previousEngine.destroy()

        await this.createEngine(paneId, mainWindow, currentUrl)
      })
    )
  }

  async syncClick(paneId: PaneId, fingerprint: ElementFingerprint): Promise<void> {
    syncTrace('click:received', {
      sourcePane: paneId,
      fingerprint: summarizeFingerprint(fingerprint)
    })

    // Synthetic clicks are real input events, so the target pane's preload
    // re-reports them. Consume that echo here instead of broadcasting it,
    // otherwise panes ping-pong clicks forever.
    if (this.echoLedger.isEcho(paneId, 'click')) {
      syncTrace('click:echo-suppressed', { paneId })
      return
    }
    if (!this.isLinked(paneId)) {
      syncTrace('click:sync-disabled', { sourcePane: paneId })
      return
    }

    this.clickMirrorSourcePane = paneId
    this.activeClickMirrors += 1
    try {
      await Promise.all(
        PANE_IDS.map(async (targetId) => {
          if (targetId === paneId || !this.isLinked(targetId)) return

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
            syncTrace('click:skipped-stale-epoch', {
              targetPane: targetId,
              epochBefore: epochBeforeResolution,
              epochAfter: epochAfterResolution
            })
            return
          }

          if (isLinkNav && 'navigateTo' in resolution) {
            syncTrace('click:link-navigating', {
              targetPane: targetId,
              url: resolution.navigateTo
            })
            clickExpectation.revoke()
            this.mirrorLinkTargetPanes.add(targetId)
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
        this.historySourceLock = { paneId, until: Date.now() + 500 }
        this.clickMirrorSourcePane = null
        this.clickMirrorCooldownUntil = Date.now() + 250
      }
    }
  }

  async syncValue(
    sourcePaneId: PaneId,
    fingerprint: ElementFingerprint,
    value: string
  ): Promise<void> {
    syncTrace('value:received', {
      sourcePane: sourcePaneId,
      value,
      fingerprint: summarizeFingerprint(fingerprint)
    })
    if (this.echoLedger.isEcho(sourcePaneId, 'value')) {
      syncTrace('value:echo-suppressed', { sourcePane: sourcePaneId })
      return
    }
    if (!this.isLinked(sourcePaneId)) return

    const fieldKey = JSON.stringify(fingerprint)
    const generation = (this.valueSyncGeneration.get(fieldKey) ?? 0) + 1
    this.valueSyncGeneration.set(fieldKey, generation)
    const payload: ValueSyncPayload = { value, generation }

    await Promise.all(
      PANE_IDS.map(async (targetId) => {
        if (targetId === sourcePaneId || !this.isLinked(targetId)) return
        const engine = this.getEngine(targetId)
        const epochBefore = this.getPaneInteractionEpoch(targetId)
        syncTrace('value:applying', { sourcePane: sourcePaneId, targetPane: targetId, generation })
        const expectation = this.echoLedger.expect(targetId, 'value')
        await engine.applyValue(fingerprint, payload)
        // If the target navigated or its engine was recreated mid-apply, drop the
        // echo reservation so a real value event on the new document isn't
        // mistaken for this apply's echo.
        if (this.isInteractionStale(engine, targetId, epochBefore)) {
          expectation.revoke()
          syncTrace('value:skipped-stale', { targetPane: targetId })
        }
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
    if (!this.isLinked(sourcePaneId)) return

    const fieldKey = JSON.stringify(fingerprint)
    const generation = (this.valueSyncGeneration.get(fieldKey) ?? 0) + 1
    this.valueSyncGeneration.set(fieldKey, generation)
    const payload: ValueSyncPayload = { value, selectedIndex, generation }

    await Promise.all(
      PANE_IDS.map(async (targetId) => {
        if (targetId === sourcePaneId || !this.isLinked(targetId)) return
        const engine = this.getEngine(targetId)
        const epochBefore = this.getPaneInteractionEpoch(targetId)
        syncTrace('select:applying', { sourcePane: sourcePaneId, targetPane: targetId, generation })
        const expectation = this.echoLedger.expect(targetId, 'value')
        await engine.applyValue(fingerprint, payload)
        if (this.isInteractionStale(engine, targetId, epochBefore)) {
          expectation.revoke()
          syncTrace('select:skipped-stale', { targetPane: targetId })
        }
      })
    )
  }

  async syncSubmit(sourcePaneId: PaneId, fingerprint: ElementFingerprint): Promise<void> {
    syncTrace('submit:received', {
      sourcePane: sourcePaneId,
      fingerprint: summarizeFingerprint(fingerprint)
    })
    if (this.echoLedger.isEcho(sourcePaneId, 'submit')) {
      syncTrace('submit:echo-suppressed', { sourcePane: sourcePaneId })
      return
    }
    if (!this.isLinked(sourcePaneId)) return

    await Promise.all(
      PANE_IDS.map(async (targetId) => {
        if (targetId === sourcePaneId || !this.isLinked(targetId)) return

        const engine = this.getEngine(targetId)
        const expectation = this.echoLedger.expect(targetId, 'submit')

        // Mark as programmatic so the resulting navigation doesn't cascade
        // back to the source pane via handleNavigation.
        this.pendingProgrammaticNavigation.add(targetId)

        syncTrace('submit:applying', { sourcePane: sourcePaneId, targetPane: targetId })
        await engine.submitForm(fingerprint)
        // A successful submit navigates (bumps the epoch), so only engine
        // recreation counts as stale here — not an epoch change. If the engine
        // was swapped mid-submit, the submit never landed on the live pane, so
        // drop both the echo reservation and the pending-navigation marker.
        if (this.isEngineStale(engine, targetId)) {
          expectation.revoke()
          this.pendingProgrammaticNavigation.delete(targetId)
          syncTrace('submit:skipped-stale-engine', { targetPane: targetId })
        }
      })
    )
  }

  // Mirror a command-style keyboard shortcut (⌘K, Ctrl+B, …) to the other
  // panes so a global page handler fires everywhere. The preload only forwards
  // shortcuts (a non-shift modifier is held), so text entry never reaches here —
  // that stays with value sync. Dispatch is synchronous native input, so unlike
  // click/value there is no async gap and no staleness guard is needed; echo
  // suppression is handled entirely by the ledger (no in-page flag, so no
  // cross-world concern).
  syncKey(sourcePaneId: PaneId, key: MirroredKey): void {
    syncTrace('key:received', { sourcePane: sourcePaneId, key: key.key })
    if (this.echoLedger.isEcho(sourcePaneId, 'key')) {
      syncTrace('key:echo-suppressed', { sourcePane: sourcePaneId })
      return
    }
    if (!this.isLinked(sourcePaneId)) return

    for (const targetId of PANE_IDS) {
      if (targetId === sourcePaneId || !this.isLinked(targetId)) continue
      this.echoLedger.expect(targetId, 'key')
      syncTrace('key:dispatching', { sourcePane: sourcePaneId, targetPane: targetId, key: key.key })
      this.getEngine(targetId).dispatchKey(key)
    }
  }

  getMirrorFailureLogs(): Record<PaneId, ReturnType<EngineView['getMirrorFailureLogs']>> {
    return {
      iphone: this.getEngine('iphone').getMirrorFailureLogs(),
      ipad: this.getEngine('ipad').getMirrorFailureLogs(),
      desktop: this.getEngine('desktop').getMirrorFailureLogs()
    }
  }

  getSyncTraceLogs(): ReturnType<typeof import('../services/sync-trace').getSyncTraceLogs> {
    return getSyncTraceLogs()
  }

  async syncScroll(
    paneId: PaneId,
    ratio: number,
    programmatic: boolean,
    scrollY = 0
  ): Promise<void> {
    this.safariChromeHooks?.onScroll(paneId, scrollY, programmatic)

    if (!this.isLinked(paneId)) return

    // Always consume: a programmatic report from a pane also settles any
    // pending scroll-echo expectation for it.
    const isEcho = this.echoLedger.isEcho(paneId, 'scroll')
    if (programmatic || isEcho) return

    // A source-pane scroll from an in-flight mirrored click must not move
    // target panes before their replayed click lands.
    if (this.activeClickMirrors > 0 || Date.now() < this.clickMirrorCooldownUntil) return

    const targets = PANE_IDS.filter((targetId) => targetId !== paneId && this.isLinked(targetId))
    for (const targetId of targets) {
      this.echoLedger.expect(targetId, 'scroll')
    }

    await Promise.all(targets.map((targetId) => this.getEngine(targetId).syncScroll(ratio)))
  }

  setPaneLinked(paneId: PaneId, linked: boolean): void {
    if (linked) this.linkedPanes.add(paneId)
    else this.linkedPanes.delete(paneId)
    // Pending scroll-echo expectations belong to the previous link topology;
    // clear them so a stale expectation can't swallow the first scroll after relink.
    this.echoLedger.clear('scroll')
  }

  getLinkedPanes(): PaneId[] {
    return PANE_IDS.filter((paneId) => this.linkedPanes.has(paneId))
  }

  private isLinked(paneId: PaneId): boolean {
    return this.linkedPanes.has(paneId)
  }

  async setDeviceProfile(paneId: PaneId, profile: DeviceProfile): Promise<void> {
    this.paneProfiles.set(paneId, profile)
    await this.deviceReady
    await this.getEngine(paneId).setDevice(profile)
    if (this.inspectionMode) {
      if (this.inspectionState.record?.paneId === paneId) {
        await this.refreshInspectionSource()
      }
      void this.refreshInspectionTargets()
    }
  }

  getInspectionState(): InspectionState {
    return {
      active: this.inspectionMode,
      record: this.inspectionState.record,
      records: [...this.inspectionState.records]
    }
  }

  async setInspectionMode(enabled: boolean): Promise<void> {
    await this.deviceReady
    this.inspectionRequestId += 1
    this.inspectionMode = enabled
    if (!enabled) {
      this.inspectionState = { ...EMPTY_INSPECTION_STATE }
    }

    await Promise.all(
      PANE_IDS.map((paneId) =>
        this.getEngine(paneId).setInspectionMode(enabled && this.isPaneVisible(paneId))
      )
    )
    this.broadcastRendererEvent('inspection:state', this.getInspectionState())
  }

  async selectInspectionElement(
    paneId: PaneId,
    target: InspectionTarget,
    snapshot: InspectionPageSnapshot,
    applySelection = true
  ): Promise<void> {
    if (!this.inspectionMode) return
    const requestId = ++this.inspectionRequestId

    const profile = this.paneProfiles.get(paneId) ?? DEVICE_PRESETS[paneId]
    const url = this.getEngine(paneId).getCurrentUrl()
    const sourceRecord = createInspectionRecord({
      paneId,
      source: true,
      target,
      profile,
      url,
      snapshot,
      status: 'matched',
      provenance: null
    })

    const visiblePanes = PANE_IDS.filter((id) => this.isPaneVisible(id))
    const targetResults = await Promise.all(
      visiblePanes.map(async (targetPaneId) => {
        if (targetPaneId === paneId) {
          return { paneId: targetPaneId, status: 'matched' as const, snapshot, provenance: null }
        }

        const engine = this.getEngine(targetPaneId)
        const url = engine.getCurrentUrl()
        if (url === 'about:blank' || this.loadingState.get(targetPaneId)) {
          return {
            paneId: targetPaneId,
            status: 'unavailable' as const,
            snapshot: null,
            provenance: null
          }
        }

        try {
          const result = await engine.inspectElement(target)
          return { paneId: targetPaneId, ...result }
        } catch {
          return {
            paneId: targetPaneId,
            status: 'unavailable' as const,
            snapshot: null,
            provenance: null
          }
        }
      })
    )

    if (!this.inspectionMode || requestId !== this.inspectionRequestId) return

    const records = targetResults.map((result) => {
      if (result.paneId === paneId) return sourceRecord
      const profile = this.paneProfiles.get(result.paneId) ?? DEVICE_PRESETS[result.paneId]
      const engine = this.getEngine(result.paneId)
      return createInspectionRecord({
        paneId: result.paneId,
        source: false,
        target,
        profile,
        url: engine.getCurrentUrl(),
        snapshot: result.snapshot,
        status: result.status,
        provenance: result.provenance,
        error:
          result.status === 'unavailable' ? 'Pane did not return inspection evidence' : undefined
      })
    })

    await Promise.all(
      targetResults.map(async (result) => {
        const engine = this.getEngine(result.paneId)
        await engine.setInspectionMismatch(result.status !== 'matched')
        await engine.setInspectionSelection(
          applySelection && result.status === 'matched' ? target : null
        )
      })
    )

    this.inspectionState = {
      active: true,
      record: sourceRecord,
      records
    }
    this.broadcastRendererEvent('inspection:state', this.getInspectionState())
  }

  async previewInspectionElement(
    paneId: PaneId,
    target: InspectionTarget,
    snapshot: InspectionPageSnapshot
  ): Promise<void> {
    await this.selectInspectionElement(paneId, target, snapshot, false)
  }

  async loadInspectionMarkupChildren(
    paneId: PaneId,
    nodeId: string
  ): Promise<InspectionMarkupNode[]> {
    if (!this.inspectionMode || !/^root(?:\.\d+)*$/.test(nodeId)) return []
    const record = this.inspectionState.records.find((candidate) => candidate.paneId === paneId)
    if (!record || record.status !== 'matched' || !record.snapshot) return []

    const engine = this.getEngine(paneId)
    if (engine.getCurrentUrl() === 'about:blank' || this.loadingState.get(paneId)) return []

    try {
      const children = await engine.evaluate<InspectionMarkupNode[]>(
        getInspectionMarkupChildrenExpression(record.target, nodeId)
      )
      return Array.isArray(children) ? children : []
    } catch {
      return []
    }
  }

  clearInspectionSelection(): void {
    if (!this.inspectionState.record && !this.inspectionState.records.length) return
    this.inspectionRequestId += 1
    for (const paneId of PANE_IDS) {
      void this.getEngine(paneId).setInspectionMismatch(false)
      void this.getEngine(paneId).setInspectionSelection(null)
    }
    this.inspectionState = {
      active: this.inspectionMode,
      record: null,
      records: []
    }
    this.broadcastRendererEvent('inspection:state', this.getInspectionState())
  }

  markInspectionPaneStale(paneId: PaneId): void {
    this.markInspectionPaneStatus(paneId, 'stale')
  }

  private markInspectionPaneStatus(paneId: PaneId, status: 'stale' | 'unavailable'): void {
    if (!this.inspectionState.records.length) return
    const records = this.inspectionState.records.map((record) =>
      record.paneId === paneId ? { ...record, status, snapshot: null, provenance: null } : record
    )
    this.inspectionState = {
      ...this.inspectionState,
      record: records.find((record) => record.source) ?? this.inspectionState.record,
      records
    }
    void this.getEngine(paneId).setInspectionSelection(null)
    void this.getEngine(paneId).setInspectionMismatch(true)
    this.broadcastRendererEvent('inspection:state', this.getInspectionState())
  }

  private async refreshInspectionTargets(): Promise<void> {
    if (!this.inspectionMode) return
    const sourceRecord = this.inspectionState.records.find((record) => record.source)
    if (!sourceRecord?.snapshot || sourceRecord.status !== 'matched') return

    const visiblePanes = PANE_IDS.filter((id) => this.isPaneVisible(id))
    const targetResults = await Promise.all(
      visiblePanes
        .filter((paneId) => paneId !== sourceRecord.paneId)
        .map(async (paneId) => {
          const engine = this.getEngine(paneId)
          if (engine.getCurrentUrl() === 'about:blank' || this.loadingState.get(paneId)) {
            return {
              paneId,
              status: 'unavailable' as const,
              snapshot: null,
              provenance: null
            }
          }
          try {
            return { paneId, ...(await engine.inspectElement(sourceRecord.target)) }
          } catch {
            return {
              paneId,
              status: 'unavailable' as const,
              snapshot: null,
              provenance: null
            }
          }
        })
    )

    const refreshed = targetResults.map((result) => {
      const profile = this.paneProfiles.get(result.paneId) ?? DEVICE_PRESETS[result.paneId]
      return createInspectionRecord({
        paneId: result.paneId,
        source: false,
        target: sourceRecord.target,
        profile,
        url: this.getEngine(result.paneId).getCurrentUrl(),
        snapshot: result.snapshot,
        status: result.status,
        provenance: result.provenance,
        error:
          result.status === 'unavailable' ? 'Pane did not return inspection evidence' : undefined
      })
    })
    const byPane = new Map(
      this.inspectionState.records
        .filter((record) => !visiblePanes.includes(record.paneId))
        .map((record) => [record.paneId, record])
    )
    byPane.set(sourceRecord.paneId, sourceRecord)
    for (const record of refreshed) byPane.set(record.paneId, record)
    const records = PANE_IDS.flatMap((paneId) => {
      const record = byPane.get(paneId)
      return record ? [record] : []
    })

    await Promise.all(
      targetResults.map(async (result) => {
        const engine = this.getEngine(result.paneId)
        await engine.setInspectionMismatch(result.status !== 'matched')
        await engine.setInspectionSelection(
          result.status === 'matched' ? sourceRecord.target : null
        )
      })
    )
    this.inspectionState = { ...this.inspectionState, records }
    this.broadcastRendererEvent('inspection:state', this.getInspectionState())
  }

  private async refreshInspectionSource(): Promise<void> {
    const sourceRecord = this.inspectionState.records.find((record) => record.source)
    if (!sourceRecord) return
    const engine = this.getEngine(sourceRecord.paneId)
    if (engine.getCurrentUrl() === 'about:blank' || this.loadingState.get(sourceRecord.paneId)) {
      this.markInspectionPaneStatus(sourceRecord.paneId, 'unavailable')
      return
    }

    try {
      const result = await engine.inspectElement(sourceRecord.target)
      if (result.status !== 'matched' || !result.snapshot) {
        this.markInspectionPaneStatus(
          sourceRecord.paneId,
          result.status === 'unavailable' ? 'unavailable' : 'stale'
        )
        return
      }
      const profile =
        this.paneProfiles.get(sourceRecord.paneId) ?? DEVICE_PRESETS[sourceRecord.paneId]
      const refreshedSource = createInspectionRecord({
        paneId: sourceRecord.paneId,
        source: true,
        target: result.snapshot.target,
        profile,
        url: engine.getCurrentUrl(),
        snapshot: result.snapshot,
        status: 'matched',
        provenance: result.provenance
      })
      this.inspectionState = {
        ...this.inspectionState,
        record: refreshedSource,
        records: this.inspectionState.records.map((record) =>
          record.source ? refreshedSource : record
        )
      }
      await engine.setInspectionMismatch(false)
      await engine.setInspectionSelection(result.snapshot.target)
      this.broadcastRendererEvent('inspection:state', this.getInspectionState())
    } catch {
      this.markInspectionPaneStatus(sourceRecord.paneId, 'unavailable')
    }
  }

  closeInspection(): void {
    void this.setInspectionMode(false)
  }

  async setThemePreference(preference: ThemePreference): Promise<void> {
    this.themePreference = preference
    await this.deviceReady
    await Promise.all(
      PANE_IDS.map((paneId) => this.getEngine(paneId).setThemePreference(preference))
    )
  }

  async setMediaFeatures(state: MediaFeatureState): Promise<void> {
    this.mediaFeatures = normalizeMediaFeatures(state)
    await this.deviceReady
    await Promise.all(
      PANE_IDS.map((paneId) => this.getEngine(paneId).setMediaFeatures(this.mediaFeatures))
    )
  }

  getMediaFeatures(): MediaFeatureState {
    return this.mediaFeatures
  }

  isAnyPaneLoading(): boolean {
    for (const paneId of PANE_IDS) {
      if (this.loadingState.get(paneId)) return true
    }
    return false
  }

  getLastNavTimestamp(paneId: PaneId): number | null {
    return this.lastNavTimestamps.get(paneId) ?? null
  }

  private async capturePaneScreenshot(paneId: PaneId): Promise<Buffer> {
    const capturePage = (): Promise<Buffer> => this.getEngine(paneId).captureScreenshot()
    if (this.safariChromeHooks) {
      return this.safariChromeHooks.captureComposited(paneId, capturePage)
    }
    return capturePage()
  }

  async captureActivePaneScreenshot(): Promise<Buffer> {
    return this.capturePaneImage(this.resolveActivePaneForEvidence())
  }

  /** Capture a specific pane, restoring its mount afterwards (like the active-pane capture). */
  async capturePaneImage(paneId: PaneId): Promise<Buffer> {
    await this.deviceReady
    try {
      return await this.capturePaneScreenshot(paneId)
    } finally {
      this.restorePaneMount(paneId)
    }
  }

  getLoadingStates(): Record<PaneId, boolean> {
    return {
      iphone: this.loadingState.get('iphone') ?? false,
      ipad: this.loadingState.get('ipad') ?? false,
      desktop: this.loadingState.get('desktop') ?? false
    }
  }

  setPanesVisible(visible: boolean): void {
    this.panesVisible = visible
    this.safariChromeHooks?.setPanesVisible(visible)
    this.applyPaneVisibility()
    if (this.inspectionMode) {
      for (const paneId of PANE_IDS) {
        void this.getEngine(paneId).setInspectionMode(this.isPaneVisible(paneId))
      }
      void this.refreshInspectionTargets()
    }
  }

  setFocusedPane(paneId: PaneId | null): void {
    if (this.focusedPane === paneId) return
    this.focusedPane = paneId
    this.applyPaneVisibility()
    if (this.inspectionMode) {
      for (const id of PANE_IDS) {
        void this.getEngine(id).setInspectionMode(this.isPaneVisible(id))
      }
      void this.refreshInspectionTargets()
    }
  }

  /** The soloed pane, or null when every pane is visible. */
  getFocusedPane(): PaneId | null {
    return this.focusedPane
  }

  private isPaneVisible(paneId: PaneId): boolean {
    return this.panesVisible && (this.focusedPane === null || this.focusedPane === paneId)
  }

  private applyPaneVisibility(): void {
    for (const paneId of PANE_IDS) {
      this.getEngine(paneId).setVisible(this.isPaneVisible(paneId))
    }

    for (const paneId of PANE_IDS) {
      if (!this.isPaneVisible(paneId)) continue
      const mount = this.lastMount.get(paneId)
      if (mount) {
        this.getEngine(paneId).mount(mount)
      }
    }
  }

  getEngineView(paneId: PaneId): EngineView {
    return this.getEngine(paneId)
  }

  async evaluateInPane<T>(paneId: PaneId, expression: string): Promise<T> {
    return this.getEngine(paneId).evaluate<T>(expression)
  }

  getUserAgentForPane(paneId: PaneId): string {
    return DEVICE_PRESETS[paneId].userAgent
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true

    this.safariChromeHooks?.destroy()
    this.safariChromeHooks = null

    if (this.evidenceEmitTimer) {
      clearTimeout(this.evidenceEmitTimer)
      this.evidenceEmitTimer = null
      this.evidenceEmitPending = false
    }

    const mainWindow = this.mainWindow
    for (const engine of this.engines.values()) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        engine.detach(mainWindow)
      }
      engine.destroy()
    }
    this.engines.clear()
    this.runtimeEvidence.clear()
    this.inspectionMode = false
    this.inspectionState = { ...EMPTY_INSPECTION_STATE }
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

  /** The shared preview session, or null before initialize(). */
  getPreviewSession(): Electron.Session | null {
    return this.sharedSession
  }

  private getEngine(paneId: PaneId): EngineView {
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

  // A mirrored interaction is stale if the target's engine was recreated, or —
  // for interactions that don't themselves navigate (value/select) — if the
  // pane's document changed mid-flight (a load bumped the interaction epoch).
  // syncClick uses the same rule; this shares it with value/select/submit.
  private isEngineStale(engine: EngineView, paneId: PaneId): boolean {
    return engine !== this.engines.get(paneId)
  }

  private isInteractionStale(engine: EngineView, paneId: PaneId, epochBefore: number): boolean {
    return (
      this.isEngineStale(engine, paneId) || epochBefore !== this.getPaneInteractionEpoch(paneId)
    )
  }

  private async createEngine(
    paneId: PaneId,
    mainWindow: BrowserWindow,
    restoreUrl: string | null
  ): Promise<void> {
    const engine = new WebContentsViewEngine(paneId, this.getSharedSession(), getPanePreloadPath())
    const evidenceBuffer = createRuntimeEvidenceBuffer()
    this.runtimeEvidence.set(paneId, evidenceBuffer)
    engine.bindRuntimeEvidence({
      pushConsole: (entry) => {
        evidenceBuffer.pushConsole(entry)
        this.notifyRuntimeEvidenceChanged(paneId)
      },
      pushNetwork: (entry) => {
        evidenceBuffer.pushNetwork(entry)
        this.notifyRuntimeEvidenceChanged(paneId)
      }
    })
    this.engines.set(paneId, engine)
    this.bumpPaneInteractionEpoch(paneId)
    this.webContentsToPane.set(engine.getWebContentsId(), paneId)
    this.loadingState.set(paneId, false)
    this.loadErrorState.set(paneId, null)
    engine.attach(mainWindow)
    engine.setVisible(false)
    this.notifyChildViewStackChanged()
    this.attachLoadingListeners(engine, paneId)
    this.attachNavigationListeners(engine, paneId)
    for (const handler of this.paneBeforeInputHooks) {
      engine.on('before-input', handler)
    }

    try {
      const profile = this.paneProfiles.get(paneId) ?? DEVICE_PRESETS[paneId]
      this.paneProfiles.set(paneId, profile)
      await engine.setDevice(profile)
      await engine.setThemePreference(this.themePreference)
      await engine.setMediaFeatures(this.mediaFeatures)
      await engine.setInspectionMode(this.inspectionMode && this.isPaneVisible(paneId))
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

  private attachNavigationListeners(engine: EngineView, paneId: PaneId): void {
    const handleNavigation = (url: string, inPage: boolean): void => {
      if (url === 'about:blank') return

      const isProgrammatic = this.pendingProgrammaticNavigation.has(paneId)
      if (isProgrammatic) {
        this.pendingProgrammaticNavigation.delete(paneId)
      }

      const isHistoryNav = this.pendingHistoryNavigation.has(paneId)
      this.pendingHistoryNavigation.delete(paneId)

      this.tracker.didNavigate(paneId, url, { inPage, isProgrammatic })
      this.lastNavTimestamps.set(paneId, Date.now())
      this.maybeResolveDevContext(url)

      if (isProgrammatic) {
        return
      }

      if (!isHistoryNav) {
        this.historySourcePane = paneId
        this.mirrorLinkTargetPanes.clear()
      }

      this.markPendingVisit(url, inPage)
      this.emitNavigationState()
    }

    engine.on('did-navigate', (url) => {
      if (url !== 'about:blank') {
        const buffer = this.runtimeEvidence.get(paneId)
        if (buffer) {
          buffer.clearConsole()
          buffer.clearNetwork()
        }
      }
      handleNavigation(url, false)
    })
    engine.on('did-navigate-in-page', (url) => handleNavigation(url, true))
    engine.on('did-start-loading', () => {
      this.bumpPaneInteractionEpoch(paneId)
      // A new top-level load is starting (reload or navigation): the document
      // is about to change, so notify audit owners before the old page's
      // evidence can be attributed to the new one.
      this.notifyPaneDocumentChange(paneId)
      if (this.inspectionMode) this.markInspectionPaneStatus(paneId, 'unavailable')
    })
    engine.on('page-title-updated', (title) => {
      if (this.tracker.didTitleUpdate(paneId, title)) {
        this.emitNavigationState()
        this.emitMetadataUpdate()
      }
    })
    engine.on('page-favicon-updated', (favicons) => {
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
    engine.on('did-fail-load', () => {
      this.pendingProgrammaticNavigation.delete(paneId)
      this.pendingHistoryNavigation.delete(paneId)
      if (this.pendingVisitUrl && this.tracker.getSnapshot().barUrl === this.pendingVisitUrl) {
        this.pendingVisitFailed = true
      }
    })
    engine.on('did-stop-loading', () => {
      this.tryCommitVisit()
      // Re-emit after loading settles: canGoBack/canGoForward read from
      // Electron's navigation history, which may not be fully updated at
      // did-navigate time (e.g. after goBack/goForward).
      this.emitNavigationState()
      if (this.inspectionMode) void this.refreshInspectionTargets()
    })
    engine.on('focus', () => {
      if (this.pendingProgrammaticNavigation.has(paneId)) return
      if (this.loadingState.get(paneId)) return
      if (
        this.activeClickMirrors > 0 &&
        this.clickMirrorSourcePane !== null &&
        paneId !== this.clickMirrorSourcePane
      ) {
        return
      }
      if (
        this.historySourceLock &&
        Date.now() < this.historySourceLock.until &&
        paneId !== this.historySourceLock.paneId
      ) {
        return
      }
      if (this.mirrorLinkTargetPanes.has(paneId)) return
      this.historySourcePane = paneId
      this.tracker.didFocus(paneId)
      this.emitNavigationState()
    })
  }

  private emitNavigationState(): void {
    this.broadcastRendererEvent('pane:navigation', this.getNavigationState())
    this.emitRuntimeEvidenceIfActivePaneChanged()
    const urls: Partial<Record<PaneId, string>> = {}
    for (const paneId of PANE_IDS) {
      urls[paneId] = this.tracker.getPaneUrl(paneId) ?? this.getEngine(paneId).getCurrentUrl()
    }
    this.safariChromeHooks?.onNavigationState(urls)
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

  private setPaneLoadError(
    paneId: PaneId,
    error: { code: number; description: string } | null
  ): void {
    this.loadErrorState.set(paneId, error)
    this.broadcastRendererEvent('pane:load-error', { paneId, error })
  }

  private attachLoadingListeners(engine: EngineView, paneId: PaneId): void {
    engine.on('did-start-loading', () => {
      // If the pane was hidden to reveal the React error overlay, restore it
      // now that a new navigation has begun (goBack, goForward, reload, etc.).
      // doNavigateAll calls setPanesVisible(true) separately, so this is only
      // the fallback path for navigations that don't go through doNavigateAll.
      const hadError = !!this.loadErrorState.get(paneId)
      this.setPaneLoadError(paneId, null)
      this.setPaneLoading(paneId, true)
      if (hadError) engine.setVisible(true)
    })
    engine.on('did-stop-loading', () => this.setPaneLoading(paneId, false))
    engine.on('did-fail-load', (errorCode, errorDescription, isMainFrame) => {
      this.setPaneLoading(paneId, false)
      // ERR_ABORTED (-3) is a cancelled navigation, not a real failure.
      // Sub-frame failures don't affect the page's main content.
      if (errorCode === -3 || !isMainFrame) return
      if (this.inspectionMode) this.markInspectionPaneStatus(paneId, 'unavailable')
      // Hide the WebContentsView: Chromium's built-in error page is a native
      // layer that sits above all React HTML, so the error overlay in the
      // renderer would be invisible behind it. Setting the view invisible lets
      // the React overlay show through.
      engine.setVisible(false)
      this.setPaneLoadError(paneId, { code: errorCode, description: errorDescription })
    })
  }
}
