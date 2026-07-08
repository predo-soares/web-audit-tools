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
  normalizeVisibleText,
  resolveElementFingerprint,
  type ElementFingerprint
} from '../shared/element-fingerprint'
import { DEFAULT_ZOOM } from '../shared/mockup-layout'
import { normalizeUrl } from '../shared/url'
import type { EngineView } from './engine-view'

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
  ): Promise<{ x: number; y: number } | null> {
    try {
      await this.ensureDebugger()
      const response = (await this.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: this.getClickResolutionExpression(fingerprint),
        returnByValue: true
      })) as RuntimeEvaluateResponse

      if (response.exceptionDetails) return null
      const value = response.result?.value as ResolvedClickPoint | undefined
      if (!value?.matched || typeof value.x !== 'number' || typeof value.y !== 'number') {
        return null
      }

      return { x: value.x, y: value.y }
    } catch {
      return null
    }
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

  private getClickResolutionExpression(fingerprint: ElementFingerprint): string {
    return `
      (() => {
        const fingerprint = ${JSON.stringify(fingerprint)};
        const normalizeVisibleText = ${normalizeVisibleText.toString()};
        const resolveElementFingerprint = ${resolveElementFingerprint.toString()};
        const interactiveSelector = [
          'a[href]',
          'button',
          'input:not([type="hidden"])',
          'select',
          'textarea',
          '[role="button"]',
          '[role="link"]',
          '[role="menuitem"]',
          '[role="tab"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="switch"]',
          '[role="option"]',
          '[tabindex]:not([tabindex="-1"])'
        ].join(',');

        function getVisibleText(element) {
          if (element instanceof HTMLInputElement) {
            if (['button', 'submit', 'reset'].includes(element.type)) {
              return normalizeVisibleText(element.value);
            }
            return '';
          }

          return normalizeVisibleText(element instanceof HTMLElement ? element.innerText : element.textContent);
        }

        function describeElement(element) {
          return {
            tagName: element.tagName.toLowerCase(),
            id: element.id || null,
            visibleText: getVisibleText(element)
          };
        }

        const elements = Array.from(document.querySelectorAll(interactiveSelector))
          .filter((element) => element instanceof HTMLElement && !element.disabled);
        const descriptors = elements.map(describeElement);
        const resolved = resolveElementFingerprint(fingerprint, descriptors);
        if (!resolved) return { matched: false };

        const element = elements[resolved.index];
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return { matched: false };

        return {
          matched: true,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
      })();
    `
  }
}

export function getPanePreloadPath(): string {
  return join(__dirname, '../preload/pane-preload.js')
}
