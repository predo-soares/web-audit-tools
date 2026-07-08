import { WebContentsView, type Session, type WebContents } from 'electron'
import { join } from 'path'
import type {
  Bounds,
  DeviceProfile,
  PaneId,
  PaneMount,
  Size,
  ThemePreference
} from '../shared/types'
import {
  classifyMirrorFailure,
  getLayerMatches,
  matchesLayer,
  normalizeVisibleText,
  resolveElementFingerprint,
  type ElementFingerprint,
  type MirrorFailureLog
} from '../shared/element-fingerprint'
import {
  describeElementInPage,
  getDescriptorTestIdInPage,
  getInputGroupMatchIndexInPage,
  getStructuralPathInPage,
  getVisibleTextInPage,
  INTERACTIVE_SELECTOR,
  VALUE_SYNC_SELECTOR
} from '../shared/in-page-element-descriptor'
import { getDescribedElementsInPage, resolveFingerprintInPage } from '../shared/in-page-element-matcher'
import { DEFAULT_ZOOM } from '../shared/mockup-layout'
import { normalizeUrl } from '../shared/url'
import type { EngineView, ValueSyncPayload } from './engine-view'
import { syncTrace } from './sync-trace'

interface RuntimeEvaluateResponse {
  result?: {
    value?: unknown
  }
  exceptionDetails?: unknown
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
  private mirrorFailureLogs: MirrorFailureLog[] = []

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
      console.error(`[pane:${paneId}] debugger detached: ${reason}`)
    })

    this.webContents.setWindowOpenHandler(({ url }) => {
      void this.webContents.loadURL(normalizeUrl(url))
      return { action: 'deny' }
    })
  }

  mount(mount: PaneMount): void {
    const previousBounds = this.screenBounds
    const { screenBounds, logicalSize, cornerRadius, zoom, canvasTop } = mount
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

    // Clip native view to the canvas area so it never overlaps the toolbar.
    // WebContentsViews are OS-level surfaces that paint above the renderer
    // regardless of CSS z-index, so clipping must happen here in native bounds.
    const nativeY = Math.max(Math.round(screenBounds.y), canvasTop)
    const nativeHeight = Math.max(
      0,
      Math.round(screenBounds.height) - (nativeY - Math.round(screenBounds.y))
    )

    this.view.setBounds({
      x: Math.round(screenBounds.x),
      y: nativeY,
      width: Math.round(screenBounds.width),
      height: nativeHeight
    })
    this.view.setBorderRadius(Math.max(0, Math.round(cornerRadius)))
    if (zoom !== this.zoom || sizeChanged || logicalSizeChanged) {
      this.zoom = zoom
      this.webContents.setZoomFactor(1)
      this.applyDeviceEmulation()
    }
  }

  async navigate(url: string): Promise<void> {
    if (this.webContents.isLoading()) {
      this.webContents.stop()
    }
    await this.webContents.loadURL(url)
    await this.applyThemePreference()
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
    await this.applyThemePreference()
  }

  async setThemePreference(preference: ThemePreference): Promise<void> {
    this.themePreference = preference
    await this.applyThemePreference()
  }

  async resolveClickPoint(
    fingerprint: ElementFingerprint
  ): Promise<{ x: number; y: number } | { handled: true } | { skipDispatch: true; navigateTo: string } | null> {
    try {
      await this.ensureDebugger()
      const response = (await this.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: this.getClickResolutionExpression(fingerprint),
        returnByValue: true
      })) as RuntimeEvaluateResponse

      if (response.exceptionDetails) {
        syncTrace('click:evaluate-exception', { paneId: this.paneId, exceptionDetails: response.exceptionDetails })
        console.error(`[pane:${this.paneId}] click resolution evaluate failed:`, response.exceptionDetails)
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
            reason: value.failureReason === 'ambiguous'
              ? 'ambiguous'
              : value.failureReason === 'occluded'
                ? 'occluded'
                : 'not-found'
          })
        }
        return null
      }
      if (value.handled) return { handled: true }
      if (value.skipDispatch && value.navigateTo) return { skipDispatch: true, navigateTo: value.navigateTo }
      if (typeof value.x !== 'number' || typeof value.y !== 'number') return null
      return { x: value.x, y: value.y }
    } catch (error) {
      syncTrace('click:resolution-error', { paneId: this.paneId, error: String(error) })
      console.error(`[pane:${this.paneId}] click resolution failed:`, error)
      return null
    }
  }

  logMirrorFailure(log: MirrorFailureLog): void {
    this.mirrorFailureLogs.push(log)
    // Console only in v1 — no UI surfacing
    console.debug('[mirror-failure]', JSON.stringify(log))
  }

  async applyValue(fingerprint: ElementFingerprint, payload: ValueSyncPayload): Promise<void> {
    try {
      await this.ensureDebugger()
      const response = (await this.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: this.getValueApplyExpression(fingerprint, payload),
        returnByValue: true
      })) as RuntimeEvaluateResponse

      if (response.exceptionDetails) {
        console.error(`[pane:${this.paneId}] value apply evaluate failed:`, response.exceptionDetails)
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

  destroy(): void {
    if (this.webContents.isDestroyed()) return

    if (this.debuggerAttached && this.webContents.debugger.isAttached()) {
      try {
        this.webContents.debugger.detach()
      } catch {
        // Ignore debugger teardown races during app shutdown.
      }
    }
    this.webContents.close()
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

  private async applyThemePreference(): Promise<void> {
    try {
      await this.ensureDebugger()
      await this.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features:
          this.themePreference === 'system'
            ? []
            : [{ name: 'prefers-color-scheme', value: this.themePreference }]
      })
    } catch (error) {
      console.error(`[pane:${this.paneId}] CDP theme preference override failed:`, error)
    }
  }

  private getInPageMatcherBootstrapExpression(): string {
    return `
      const matchesLayer = ${matchesLayer.toString()};
      const getLayerMatches = ${getLayerMatches.toString()};
      const classifyMirrorFailure = ${classifyMirrorFailure.toString()};
      const resolveElementFingerprint = ${resolveElementFingerprint.toString()};
      const getVisibleTextInPage = ${getVisibleTextInPage.toString()};
      const getStructuralPathInPage = ${getStructuralPathInPage.toString()};
      const getInputGroupMatchIndexInPage = ${getInputGroupMatchIndexInPage.toString()};
      const getDescriptorTestIdInPage = ${getDescriptorTestIdInPage.toString()};
      const describeElementInPage = ${describeElementInPage.toString()};
      const getDescribedElementsInPage = ${getDescribedElementsInPage.toString()};
      const resolveFingerprintInPageShared = ${resolveFingerprintInPage.toString()};
    `
  }

  private getClickResolutionExpression(fingerprint: ElementFingerprint): string {
    return `
      (() => {
        const fingerprint = ${JSON.stringify(fingerprint)};
        const normalizeVisibleText = ${normalizeVisibleText.toString()};
        ${this.getInPageMatcherBootstrapExpression()}
        const interactiveSelector = ${JSON.stringify(INTERACTIVE_SELECTOR)};

        const elements = Array.from(document.querySelectorAll(interactiveSelector))
          .filter((element) => element instanceof HTMLElement && !element.disabled);
        const match = resolveFingerprintInPageShared(fingerprint, elements, normalizeVisibleText);

        if (!match.element) {
          return { matched: false, failureReason: match.failureReason ?? 'not-found' };
        }

        const element = match.element;

        // Scroll the element into view before measuring its position.
        window.__suppressScrollReport = true;
        element.scrollIntoView({ block: 'center', behavior: 'instant' });
        requestAnimationFrame(function () {
          window.__suppressScrollReport = false;
        });

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
        // by navigating all panes to the destination URL rather than by
        // replaying the click, so the browser history and activePane tracking
        // stay on the source pane instead of all panes navigating independently.
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
        const normalizeVisibleText = ${normalizeVisibleText.toString()};
        ${this.getInPageMatcherBootstrapExpression()}
        const interactiveSelector = ${JSON.stringify(VALUE_SYNC_SELECTOR)};

        const elements = Array.from(document.querySelectorAll(interactiveSelector))
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
        const match = resolveFingerprintInPageShared(fingerprint, elements, normalizeVisibleText);
        if (!match.element) {
          return { matched: false, failureReason: match.failureReason ?? 'not-found' };
        }

        const element = match.element;

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
            setTimeout(function() { window.__suppressValueReport = false; }, 0);
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

        // Clear suppression after events fire
        setTimeout(function() { window.__suppressValueReport = false; }, 0);
        return { matched: true };
      })();
    `
  }

  private getSubmitExpression(fingerprint: ElementFingerprint): string {
    return `
      (() => {
        const fingerprint = ${JSON.stringify(fingerprint)};
        const normalizeVisibleText = ${normalizeVisibleText.toString()};
        ${this.getInPageMatcherBootstrapExpression()}

        const forms = Array.from(document.querySelectorAll('form'));
        const match = resolveFingerprintInPageShared(fingerprint, forms, normalizeVisibleText);
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
