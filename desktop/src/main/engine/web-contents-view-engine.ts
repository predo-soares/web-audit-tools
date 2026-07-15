import { WebContentsView, type BrowserWindow, type Session, type WebContents } from 'electron'
import { join } from 'path'
import type {
  Bounds,
  DeviceProfile,
  MediaFeatureState,
  PaneId,
  PaneMount,
  Size,
  ThemePreference
} from '../../shared/types'
import { DEFAULT_MEDIA_FEATURES } from '../../shared/types'
import { buildEmulatedMedia } from '../../shared/media-features'
import {
  createElementMirror,
  type ElementFingerprint,
  type MirrorFailureLog
} from '../../shared/element-mirror'
import { DEFAULT_ZOOM } from '../../shared/mockup-layout'
import { normalizeUrl } from '../../shared/url'
import type { ConsoleEvidenceEntry, NetworkEvidenceEntry } from '../../shared/runtime-evidence'
import { enableConsoleEvidenceCapture } from '../evidence/console-evidence-capture'
import { enableNetworkEvidenceCapture } from '../evidence/network-evidence-capture'
import type { EngineView, EngineViewEventMap, ValueSyncPayload } from './engine-view'
import { syncTrace } from '../services/sync-trace'

interface RuntimeEvaluateResponse {
  result?: {
    value?: unknown
  }
  exceptionDetails?: unknown
}

interface CaptureScreenshotResponse {
  data?: string
}

function isNavigationAborted(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: string | number; errno?: number }
  return record.code === 'ERR_ABORTED' || record.errno === -3 || record.code === -3
}

interface ResolvedClickPoint {
  matched: boolean
  x?: number
  y?: number
  handled?: boolean
  skipDispatch?: boolean
  navigateTo?: string
  failureReason?: 'not-found' | 'ambiguous' | 'occluded'
}

interface ResolvedMirrorAction {
  matched: boolean
  failureReason?: 'not-found' | 'ambiguous' | 'occluded'
}

export class WebContentsViewEngine implements EngineView {
  readonly view: WebContentsView
  readonly webContents: WebContents
  private profile: DeviceProfile | null = null
  private debuggerAttached = false
  // Match the renderer's initial zoom so setDevice() applies the right scale
  // before the first mountPane IPC arrives from the renderer.
  private zoom = DEFAULT_ZOOM
  private screenBounds: Bounds | null = null
  private logicalSize: Size | null = null
  private themePreference: ThemePreference = 'system'
  private mediaFeatures: MediaFeatureState = DEFAULT_MEDIA_FEATURES
  private mirrorFailureLogs: MirrorFailureLog[] = []
  private runtimeEvidencePush:
    ((entry: Omit<ConsoleEvidenceEntry, 'id' | 'timestamp'>) => void) | null = null
  private runtimeNetworkPush:
    | ((
        entry: Omit<NetworkEvidenceEntry, 'id' | 'timestamp' | 'failed'> &
          Partial<Pick<NetworkEvidenceEntry, 'failed'>>
      ) => void)
    | null = null
  private disposeConsoleCapture: (() => void) | null = null
  private disposeNetworkCapture: (() => void) | null = null
  private runtimeCapturePromise: Promise<void> | null = null

  constructor(
    readonly paneId: PaneId,
    session: Session,
    preloadPath: string
  ) {
    this.view = new WebContentsView({
      webPreferences: {
        preload: preloadPath,
        session,
        sandbox: true,
        contextIsolation: true,
        additionalArguments: [`--pane-id=${paneId}`]
      }
    })
    this.webContents = this.view.webContents

    this.webContents.debugger.on('detach', (_event, reason) => {
      this.debuggerAttached = false
      this.disposeConsoleCapture?.()
      this.disposeConsoleCapture = null
      this.disposeNetworkCapture?.()
      this.disposeNetworkCapture = null
      this.runtimeCapturePromise = null
      console.error(`[pane:${paneId}] debugger detached: ${reason}`)
    })

    this.webContents.setWindowOpenHandler(({ url }) => {
      void this.webContents.loadURL(normalizeUrl(url))
      return { action: 'deny' }
    })
  }

  mount(mount: PaneMount): void {
    const previousBounds = this.screenBounds
    const { screenBounds, logicalSize, cornerRadius, zoom } = mount
    const sizeChanged =
      !previousBounds ||
      Math.round(previousBounds.width) !== Math.round(screenBounds.width) ||
      Math.round(previousBounds.height) !== Math.round(screenBounds.height)

    const logicalSizeChanged =
      !this.logicalSize ||
      this.logicalSize.width !== logicalSize.width ||
      this.logicalSize.height !== logicalSize.height

    this.screenBounds = screenBounds
    this.logicalSize = logicalSize

    this.view.setBounds({
      x: Math.round(screenBounds.x),
      y: Math.round(screenBounds.y),
      width: Math.round(screenBounds.width),
      height: Math.round(screenBounds.height)
    })
    this.view.setBorderRadius(Math.max(0, Math.round(cornerRadius)))
    if (zoom !== this.zoom || sizeChanged || logicalSizeChanged) {
      this.zoom = zoom
      this.webContents.setZoomFactor(1)
      this.applyDeviceEmulation()
    }
  }

  stop(): void {
    if (this.webContents.isDestroyed()) return
    if (this.webContents.isLoading()) {
      this.webContents.stop()
    }
  }

  async captureScreenshot(): Promise<Buffer> {
    if (!this.profile) {
      throw new Error(`[pane:${this.paneId}] captureScreenshot called before setDevice`)
    }

    const logicalSize = this.logicalSize ?? {
      width: this.profile.width,
      height: this.profile.height
    }

    const savedZoom = this.zoom
    const savedScreenBounds = this.screenBounds ? { ...this.screenBounds } : null

    try {
      this.zoom = 1
      if (savedScreenBounds) {
        this.view.setBounds({
          x: Math.round(savedScreenBounds.x),
          y: Math.round(savedScreenBounds.y),
          width: logicalSize.width,
          height: logicalSize.height
        })
      }
      this.applyDeviceEmulation()
      await this.waitForPaint()

      await this.ensureDebugger()

      const response = (await this.webContents.debugger.sendCommand('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        optimizeForSpeed: false,
        captureBeyondViewport: false,
        clip: {
          x: 0,
          y: 0,
          width: logicalSize.width,
          height: logicalSize.height,
          scale: this.profile.deviceScaleFactor
        }
      })) as CaptureScreenshotResponse

      if (!response.data) {
        throw new Error(`[pane:${this.paneId}] Page.captureScreenshot returned no data`)
      }

      return Buffer.from(response.data, 'base64')
    } finally {
      if (savedScreenBounds) {
        this.view.setBounds({
          x: Math.round(savedScreenBounds.x),
          y: Math.round(savedScreenBounds.y),
          width: Math.round(savedScreenBounds.width),
          height: Math.round(savedScreenBounds.height)
        })
      }
      this.zoom = savedZoom
      this.applyDeviceEmulation()
    }
  }

  async navigate(url: string): Promise<void> {
    this.stop()
    try {
      await this.webContents.loadURL(url)
    } catch (error) {
      if (isNavigationAborted(error)) return
      throw error
    }
    await this.applyEmulatedMedia()
    void this.ensureRuntimeEvidenceCapture()
    // Re-apply after every load: enableDeviceEmulation can be silently ignored
    // when the renderer is still initialising, so the initial call in setDevice
    // may not take. After a completed load the WebContents is always ready.
    this.applyDeviceEmulation()
  }

  async setDevice(profile: DeviceProfile): Promise<void> {
    this.profile = profile
    if (this.webContents.getURL() === '') {
      await this.webContents.loadURL('about:blank')
    }
    try {
      await this.ensureDebugger()

      await this.webContents.debugger.sendCommand('Emulation.setUserAgentOverride', {
        userAgent: profile.userAgent
      })

      await this.webContents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {
        enabled: profile.touch
      })

      // Convert real mouse input into touch events on touch panes (same as
      // DevTools device mode), so hovering the mouse never triggers :hover
      // styles or mouseover handlers — a finger can't hover.
      await this.webContents.debugger.sendCommand('Emulation.setEmitTouchEventsForMouse', {
        enabled: profile.touch,
        ...(profile.touch ? { configuration: 'mobile' } : {})
      })
    } catch (error) {
      console.error(`[pane:${this.paneId}] CDP UA/touch override failed:`, error)
    }

    this.webContents.setZoomFactor(1)
    this.applyDeviceEmulation()
    await this.applyEmulatedMedia()
    void this.ensureRuntimeEvidenceCapture()
  }

  async setThemePreference(preference: ThemePreference): Promise<void> {
    this.themePreference = preference
    await this.applyEmulatedMedia()
  }

  async setMediaFeatures(state: MediaFeatureState): Promise<void> {
    this.mediaFeatures = state
    await this.applyEmulatedMedia()
  }

  async resolveClickPoint(
    fingerprint: ElementFingerprint
  ): Promise<
    { dispatched: true } | { handled: true } | { skipDispatch: true; navigateTo: string } | null
  > {
    try {
      await this.ensureDebugger()
      const response = (await this.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: this.getClickResolutionExpression(fingerprint),
        returnByValue: true
      })) as RuntimeEvaluateResponse

      if (response.exceptionDetails) {
        syncTrace('click:evaluate-exception', {
          paneId: this.paneId,
          exceptionDetails: response.exceptionDetails
        })
        console.error(
          `[pane:${this.paneId}] click resolution evaluate failed:`,
          response.exceptionDetails
        )
        return null
      }
      const value = response.result?.value as ResolvedClickPoint | undefined
      if (!value?.matched) {
        if (value && !value.matched) {
          syncTrace('click:resolution-failed', {
            paneId: this.paneId,
            failureReason: value.failureReason ?? 'not-found'
          })
          this.logMirrorFailure({
            fingerprint,
            paneId: this.paneId,
            reason:
              value.failureReason === 'ambiguous'
                ? 'ambiguous'
                : value.failureReason === 'occluded'
                  ? 'occluded'
                  : 'not-found'
          })
        }
        return null
      }
      if (value.handled) return { handled: true }
      if (value.skipDispatch && value.navigateTo)
        return { skipDispatch: true, navigateTo: value.navigateTo }
      if (typeof value.x !== 'number' || typeof value.y !== 'number') return null
      this.dispatchClick(value.x, value.y)
      return { dispatched: true }
    } catch (error) {
      syncTrace('click:resolution-error', { paneId: this.paneId, error: String(error) })
      console.error(`[pane:${this.paneId}] click resolution failed:`, error)
      return null
    }
  }

  logMirrorFailure(log: MirrorFailureLog): void {
    this.mirrorFailureLogs.push(log)
    console.debug('[mirror-failure]', JSON.stringify(log))
  }

  bindRuntimeEvidence(handlers: {
    pushConsole: (entry: Omit<ConsoleEvidenceEntry, 'id' | 'timestamp'>) => void
    pushNetwork: (
      entry: Omit<NetworkEvidenceEntry, 'id' | 'timestamp' | 'failed'> &
        Partial<Pick<NetworkEvidenceEntry, 'failed'>>
    ) => void
  }): void {
    this.runtimeEvidencePush = handlers.pushConsole
    this.runtimeNetworkPush = handlers.pushNetwork
    void this.ensureRuntimeEvidenceCapture()
  }

  private async ensureRuntimeEvidenceCapture(): Promise<void> {
    if (!this.runtimeEvidencePush || !this.runtimeNetworkPush) return
    if (this.disposeConsoleCapture && this.disposeNetworkCapture) return
    if (this.runtimeCapturePromise) {
      await this.runtimeCapturePromise
      return
    }

    this.runtimeCapturePromise = (async () => {
      try {
        await this.ensureDebugger()
        if (!this.disposeConsoleCapture) {
          this.disposeConsoleCapture = await enableConsoleEvidenceCapture(
            this.webContents,
            (entry) => this.runtimeEvidencePush?.(entry)
          )
        }
        if (!this.disposeNetworkCapture) {
          this.disposeNetworkCapture = await enableNetworkEvidenceCapture(
            this.webContents,
            (entry) => this.runtimeNetworkPush?.(entry)
          )
        }
      } catch (error) {
        console.error(`[pane:${this.paneId}] runtime evidence capture failed:`, error)
        this.runtimeCapturePromise = null
      }
    })()

    await this.runtimeCapturePromise
  }

  async applyValue(fingerprint: ElementFingerprint, payload: ValueSyncPayload): Promise<void> {
    try {
      await this.ensureDebugger()
      const response = (await this.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: this.getValueApplyExpression(fingerprint, payload),
        returnByValue: true
      })) as RuntimeEvaluateResponse

      if (response.exceptionDetails) {
        console.error(
          `[pane:${this.paneId}] value apply evaluate failed:`,
          response.exceptionDetails
        )
        return
      }
      const result = response.result?.value as ResolvedMirrorAction | undefined
      if (result && !result.matched) {
        syncTrace('value:apply-failed', {
          paneId: this.paneId,
          failureReason: result.failureReason ?? 'not-found'
        })
        this.logMirrorFailure({
          fingerprint,
          paneId: this.paneId,
          reason: result.failureReason === 'ambiguous' ? 'ambiguous' : 'not-found'
        })
      }
    } catch (error) {
      console.error(`[pane:${this.paneId}] value apply failed:`, error)
    }
  }

  async submitForm(fingerprint: ElementFingerprint): Promise<void> {
    try {
      await this.ensureDebugger()
      const response = (await this.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: this.getSubmitExpression(fingerprint),
        returnByValue: true
      })) as RuntimeEvaluateResponse

      if (response.exceptionDetails) {
        console.error(`[pane:${this.paneId}] submit evaluate failed:`, response.exceptionDetails)
        return
      }
      const result = response.result?.value as ResolvedMirrorAction | undefined
      if (result && !result.matched) {
        syncTrace('submit:apply-failed', {
          paneId: this.paneId,
          failureReason: result.failureReason ?? 'not-found'
        })
        this.logMirrorFailure({
          fingerprint,
          paneId: this.paneId,
          reason: result.failureReason === 'ambiguous' ? 'ambiguous' : 'not-found'
        })
      }
    } catch (error) {
      console.error(`[pane:${this.paneId}] submit failed:`, error)
    }
  }

  getMirrorFailureLogs(): MirrorFailureLog[] {
    return [...this.mirrorFailureLogs]
  }

  dispatchClick(x: number, y: number): void {
    // Native input injection: executeJavaScript is deferred while the page is
    // loading (real sites can hold isLoading for seconds), sendInputEvent is
    // not. Device emulation scales logical page coords by zoom into view
    // coords, so the injection point must be pre-scaled the same way.
    const viewX = Math.round(x * this.zoom)
    const viewY = Math.round(y * this.zoom)
    this.webContents.sendInputEvent({ type: 'mouseMove', x: viewX, y: viewY })
    this.webContents.sendInputEvent({
      type: 'mouseDown',
      x: viewX,
      y: viewY,
      button: 'left',
      clickCount: 1
    })
    this.webContents.sendInputEvent({
      type: 'mouseUp',
      x: viewX,
      y: viewY,
      button: 'left',
      clickCount: 1
    })
  }

  async evaluate<T = unknown>(expression: string): Promise<T> {
    return this.webContents.executeJavaScript(expression) as Promise<T>
  }

  async syncScroll(ratio: number): Promise<void> {
    const clamped = Math.min(1, Math.max(0, ratio))
    await this.webContents.executeJavaScript(`
      (function () {
        window.__suppressScrollReport = true;
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        // behavior: 'instant' bypasses CSS scroll-behavior: smooth. A smooth
        // scroll animates over many frames and emits a scroll event per frame,
        // overflowing the one-shot echo suppression into a feedback loop.
        window.scrollTo({ top: max > 0 ? max * ${clamped} : 0, behavior: 'instant' });
        requestAnimationFrame(function () {
          window.__suppressScrollReport = false;
        });
      })();
    `)
  }

  getCurrentUrl(): string {
    return this.webContents.getURL()
  }

  canGoBack(): boolean {
    return this.webContents.navigationHistory.canGoBack()
  }

  canGoForward(): boolean {
    return this.webContents.navigationHistory.canGoForward()
  }

  goBack(): void {
    this.webContents.navigationHistory.goBack()
  }

  goForward(): void {
    this.webContents.navigationHistory.goForward()
  }

  getPreviousEntryUrl(): string | null {
    const history = this.webContents.navigationHistory
    const activeIndex = history.getActiveIndex()
    const prevEntry = activeIndex > 0 ? history.getEntryAtIndex(activeIndex - 1) : null
    return prevEntry?.url ?? null
  }

  setVisible(visible: boolean): void {
    this.view.setVisible(visible)
  }

  attach(window: BrowserWindow): void {
    window.contentView.addChildView(this.view)
  }

  detach(window: BrowserWindow): void {
    try {
      window.contentView.removeChildView(this.view)
    } catch {
      // The view may already be detached while Electron is relaying layout
      // updates or tearing down the window tree.
    }
  }

  focus(): void {
    this.webContents.focus()
  }

  on<E extends keyof EngineViewEventMap>(event: E, handler: EngineViewEventMap[E]): () => void {
    const wc = this.webContents
    // Each typed event maps to one Electron webContents listener that adapts
    // the raw event shape to the typed handler. Guard every dispatch on
    // isDestroyed so a listener that outlives destroy() never fires.
    let dispose: () => void

    switch (event) {
      case 'did-navigate': {
        const listener = (_e: Electron.Event, url: string): void => {
          if (wc.isDestroyed()) return
          ;(handler as EngineViewEventMap['did-navigate'])(url)
        }
        wc.on('did-navigate', listener)
        dispose = () => wc.removeListener('did-navigate', listener)
        break
      }
      case 'did-navigate-in-page': {
        const listener = (_e: Electron.Event, url: string): void => {
          if (wc.isDestroyed()) return
          ;(handler as EngineViewEventMap['did-navigate-in-page'])(url)
        }
        wc.on('did-navigate-in-page', listener)
        dispose = () => wc.removeListener('did-navigate-in-page', listener)
        break
      }
      case 'did-start-loading': {
        const listener = (): void => {
          if (wc.isDestroyed()) return
          ;(handler as EngineViewEventMap['did-start-loading'])()
        }
        wc.on('did-start-loading', listener)
        dispose = () => wc.removeListener('did-start-loading', listener)
        break
      }
      case 'did-stop-loading': {
        const listener = (): void => {
          if (wc.isDestroyed()) return
          ;(handler as EngineViewEventMap['did-stop-loading'])()
        }
        wc.on('did-stop-loading', listener)
        dispose = () => wc.removeListener('did-stop-loading', listener)
        break
      }
      case 'did-fail-load': {
        const listener = (
          _e: Electron.Event,
          errorCode: number,
          errorDescription: string,
          _validatedURL: string,
          isMainFrame: boolean
        ): void => {
          if (wc.isDestroyed()) return
          ;(handler as EngineViewEventMap['did-fail-load'])(errorCode, errorDescription, isMainFrame)
        }
        wc.on('did-fail-load', listener)
        dispose = () => wc.removeListener('did-fail-load', listener)
        break
      }
      case 'page-title-updated': {
        const listener = (_e: Electron.Event, title: string): void => {
          if (wc.isDestroyed()) return
          ;(handler as EngineViewEventMap['page-title-updated'])(title)
        }
        wc.on('page-title-updated', listener)
        dispose = () => wc.removeListener('page-title-updated', listener)
        break
      }
      case 'page-favicon-updated': {
        const listener = (_e: Electron.Event, favicons: string[]): void => {
          if (wc.isDestroyed()) return
          ;(handler as EngineViewEventMap['page-favicon-updated'])(favicons)
        }
        wc.on('page-favicon-updated', listener)
        dispose = () => wc.removeListener('page-favicon-updated', listener)
        break
      }
      case 'focus': {
        const listener = (): void => {
          if (wc.isDestroyed()) return
          ;(handler as EngineViewEventMap['focus'])()
        }
        wc.on('focus', listener)
        dispose = () => wc.removeListener('focus', listener)
        break
      }
      case 'before-input': {
        const listener = (e: Electron.Event, input: Electron.Input): void => {
          if (wc.isDestroyed()) return
          ;(handler as EngineViewEventMap['before-input'])(input, () => e.preventDefault())
        }
        wc.on('before-input-event', listener)
        dispose = () => wc.removeListener('before-input-event', listener)
        break
      }
      default: {
        // Exhaustiveness guard: every EngineViewEventMap key is handled above.
        const _exhaustive: never = event
        void _exhaustive
        dispose = () => {}
      }
    }

    return dispose
  }

  getWebContentsId(): number {
    return this.webContents.id
  }

  destroy(): void {
    if (this.webContents.isDestroyed()) return

    this.disposeConsoleCapture?.()
    this.disposeConsoleCapture = null
    this.disposeNetworkCapture?.()
    this.disposeNetworkCapture = null
    this.runtimeCapturePromise = null
    this.runtimeEvidencePush = null
    this.runtimeNetworkPush = null

    if (this.debuggerAttached && this.webContents.debugger.isAttached()) {
      try {
        this.webContents.debugger.detach()
      } catch {
        // Ignore debugger teardown races during app shutdown.
      }
    }
    this.webContents.close()
  }

  private async waitForPaint(): Promise<void> {
    if (this.webContents.isDestroyed()) return
    await this.webContents.executeJavaScript(
      `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`
    )
  }

  private applyDeviceEmulation(): void {
    if (!this.profile) return
    const logicalSize = this.logicalSize ?? {
      width: this.profile.width,
      height: this.profile.height
    }

    // Native bounds follow the transformed canvas screen rectangle. Electron's
    // built-in device emulation keeps the page's logical viewport stable and
    // scales the emulated view inside the native bounds, so responsive
    // breakpoints do not change while canvas zoom does. This must not be mixed
    // with CDP Emulation.setDeviceMetricsOverride: both write the same Blink
    // emulation params and the last writer wins.
    this.webContents.enableDeviceEmulation({
      screenPosition: this.profile.touch ? 'mobile' : 'desktop',
      screenSize: { width: logicalSize.width, height: logicalSize.height },
      viewPosition: { x: 0, y: 0 },
      deviceScaleFactor: this.profile.deviceScaleFactor,
      viewSize: { width: logicalSize.width, height: logicalSize.height },
      scale: this.zoom
    })
  }

  private async ensureDebugger(): Promise<void> {
    if (this.debuggerAttached) return
    if (!this.webContents.debugger.isAttached()) {
      this.webContents.debugger.attach('1.3')
    }
    this.debuggerAttached = true
  }

  private async applyEmulatedMedia(): Promise<void> {
    try {
      await this.ensureDebugger()
      // One CDP command carries the media type + every overridden feature
      // (prefers-color-scheme comes from themePreference); a second command
      // covers Chrome's automatic dark theme, which has no media-feature form.
      const { media, features } = buildEmulatedMedia(this.themePreference, this.mediaFeatures)
      await this.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        media,
        features
      })
      await this.webContents.debugger.sendCommand('Emulation.setAutoDarkModeOverride', {
        enabled: this.mediaFeatures.autoDarkMode
      })
    } catch (error) {
      console.error(`[pane:${this.paneId}] CDP emulated media override failed:`, error)
    }
  }

  // The element mirror is injected as one self-contained artifact — a single
  // toString() of the factory the preload and unit tests also run — so the
  // in-page copy can never drift from the compiled module (ADR 0005).
  private getElementMirrorBootstrapExpression(): string {
    return `const mirror = (${createElementMirror.toString()})();`
  }

  private getClickResolutionExpression(fingerprint: ElementFingerprint): string {
    return `
      (() => {
        const fingerprint = ${JSON.stringify(fingerprint)};
        ${this.getElementMirrorBootstrapExpression()}

        const elements = Array.from(document.querySelectorAll(mirror.interactiveSelector))
          .filter((element) => element instanceof HTMLElement && !element.disabled);
        const match = mirror.resolveFingerprint(fingerprint, elements);

        if (!match.element) {
          return { matched: false, failureReason: match.failureReason ?? 'not-found' };
        }

        const element = match.element;

        const rectBefore = element.getBoundingClientRect();
        const wasOffscreen =
          rectBefore.bottom < 0 ||
          rectBefore.top > window.innerHeight ||
          rectBefore.right < 0 ||
          rectBefore.left > window.innerWidth;

        // Scroll the element into view before measuring its position.
        window.__suppressScrollReport = true;
        element.scrollIntoView({ block: 'center', inline: 'center' });
        requestAnimationFrame(function () {
          window.__suppressScrollReport = false;
        });

        if (wasOffscreen) {
          element.click();
          return { matched: true, handled: true };
        }

        // Checkboxes and radios are not reliably toggled by native mouse/touch
        // events in device-emulated panes. Applying the browser-equivalent
        // checked state here keeps this on the click-resolution path without
        // emitting a second click event from the target pane preload.
        const isToggle = element instanceof HTMLInputElement &&
          (element.type === 'checkbox' || element.type === 'radio');
        if (isToggle) {
          const wasChecked = element.checked;
          const desiredChecked = typeof fingerprint.checkedState === 'boolean'
            ? fingerprint.checkedState
            : element.type === 'checkbox'
              ? !element.checked
              : true;
          if (element.type === 'checkbox') {
            element.checked = desiredChecked;
          } else if (desiredChecked) {
            element.checked = true;
          }
          if (element.checked !== wasChecked) {
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return { matched: true, handled: true };
        }

        // Navigation links (<a href> pointing to a different page) are synced
        // by programmatic navigation on target panes (not click replay), so
        // activePane tracking stays on the source pane.
        const rawHref = element instanceof HTMLAnchorElement ? element.getAttribute('href') : null;
        const isNavigationLink = rawHref !== null &&
          rawHref !== '' &&
          !rawHref.startsWith('#') &&
          !rawHref.startsWith('javascript:');
        if (isNavigationLink) {
          return { matched: true, skipDispatch: true, navigateTo: element.href };
        }

        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return { matched: false, failureReason: 'not-found' };

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Hit-test: verify the element (or one of its descendants) is the
        // topmost element at the center point. If an overlay covers the element,
        // elementFromPoint returns the overlay instead and we reject the click.
        const hit = document.elementFromPoint(centerX, centerY);
        const isHit = hit === element || element.contains(hit);
        if (!isHit) return { matched: false, failureReason: 'occluded' };

        return {
          matched: true,
          x: centerX,
          y: centerY
        };
      })();
    `
  }

  private getValueApplyExpression(
    fingerprint: ElementFingerprint,
    payload: ValueSyncPayload
  ): string {
    return `
      (() => {
        const fingerprint = ${JSON.stringify(fingerprint)};
        const payload = ${JSON.stringify(payload)};
        ${this.getElementMirrorBootstrapExpression()}

        const elements = Array.from(document.querySelectorAll(mirror.valueSyncSelector))
          .filter(function(el) {
            if (!(el instanceof HTMLInputElement) &&
                !(el instanceof HTMLTextAreaElement) &&
                !(el instanceof HTMLSelectElement)) return false;
            if (el instanceof HTMLInputElement) {
              var t = el.type;
              if (t === 'checkbox' || t === 'radio' || t === 'hidden' || t === 'button' ||
                  t === 'submit' || t === 'reset' || t === 'file') return false;
            }
            return true;
          });
        const match = mirror.resolveFingerprint(fingerprint, elements);
        if (!match.element) {
          return { matched: false, failureReason: match.failureReason ?? 'not-found' };
        }

        const element = match.element;
        if (match.resolved?.layer.type === 'structural-path') {
          const identityLayers = fingerprint.layers.filter(function(layer) {
            return layer.type !== 'structural-path';
          });
          const descriptor = mirror.describeElement(element);
          const matchesIdentityLayer = identityLayers.some(function(layer) {
            return mirror.matchesLayer(layer, descriptor);
          });
          if (identityLayers.length > 0 && !matchesIdentityLayer) {
            return { matched: false, failureReason: 'not-found' };
          }
        }

        const fieldKey = JSON.stringify(fingerprint);
        if (typeof payload.generation === 'number') {
          window.__valueSyncGeneration = window.__valueSyncGeneration || {};
          if ((window.__valueSyncGeneration[fieldKey] ?? 0) >= payload.generation) {
            return { matched: true, skipped: true, reason: 'stale' };
          }
          window.__valueSyncGeneration[fieldKey] = payload.generation;
        }

        // Suppress echo: this apply should not be re-reported
        window.__suppressValueReport = true;

        if (element instanceof HTMLSelectElement) {
          let applied = false;
          for (let index = 0; index < element.options.length; index += 1) {
            if (element.options[index]?.value === payload.value) {
              element.selectedIndex = index;
              applied = true;
              break;
            }
          }

          if (!applied && typeof payload.selectedIndex === 'number') {
            if (payload.selectedIndex >= 0 && payload.selectedIndex < element.options.length) {
              element.selectedIndex = payload.selectedIndex;
              applied = true;
            }
          }

          if (!applied) {
            setTimeout(function() { window.__suppressValueReport = false; }, 150);
            return { matched: false, failureReason: 'not-found' };
          }
        } else {
          // Native value setter trick: bypasses React's synthetic event system
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            element instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype,
            'value'
          )?.set;

          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, payload.value);
          } else {
            element.value = payload.value;
          }
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // Clear suppression after debounced input reporting window (100ms)
        setTimeout(function() { window.__suppressValueReport = false; }, 150);
        return { matched: true };
      })();
    `
  }

  private getSubmitExpression(fingerprint: ElementFingerprint): string {
    return `
      (() => {
        const fingerprint = ${JSON.stringify(fingerprint)};
        ${this.getElementMirrorBootstrapExpression()}

        const forms = Array.from(document.querySelectorAll('form'));
        const match = mirror.resolveFingerprint(fingerprint, forms);
        if (!match.element || !(match.element instanceof HTMLFormElement)) {
          return { matched: false, failureReason: match.failureReason ?? 'not-found' };
        }

        const form = match.element;

        window.__suppressSubmitReport = true;
        window.__suppressClickReport = true;
        form.requestSubmit();
        setTimeout(function() {
          window.__suppressSubmitReport = false;
          window.__suppressClickReport = false;
        }, 100);
        return { matched: true };
      })();
    `
  }
}

export function getPanePreloadPath(): string {
  return join(__dirname, '../preload/pane-preload.js')
}
