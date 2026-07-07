import { WebContentsView, type Session, type WebContents } from 'electron'
import { join } from 'path'
import type { Bounds, DeviceProfile, PaneId, PaneMount, Size } from '../shared/types'
import type { EngineView } from './engine-view'

export class WebContentsViewEngine implements EngineView {
  readonly view: WebContentsView
  readonly webContents: WebContents
  private profile: DeviceProfile | null = null
  private debuggerAttached = false
  private zoom = 1
  private webviewScale = 1
  private screenBounds: Bounds | null = null
  private logicalSize: Size | null = null

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
  }

  mount(mount: PaneMount): void {
    const previousBounds = this.screenBounds
    const { screenBounds, logicalSize, cornerRadius, zoom, webviewScale } = mount
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
    if (
      zoom !== this.zoom ||
      webviewScale !== this.webviewScale ||
      sizeChanged ||
      logicalSizeChanged
    ) {
      this.zoom = zoom
      this.webviewScale = webviewScale
      this.webContents.setZoomFactor(1)
      this.applyDeviceEmulation()
    }
  }

  async navigate(url: string): Promise<void> {
    if (this.webContents.isLoading()) {
      this.webContents.stop()
    }
    await this.webContents.loadURL(url)
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
    } catch (error) {
      console.error(`[pane:${this.paneId}] CDP UA/touch override failed:`, error)
    }

    this.webContents.setZoomFactor(1)
    this.applyDeviceEmulation()
  }

  async syncScroll(ratio: number): Promise<void> {
    const clamped = Math.min(1, Math.max(0, ratio))
    await this.webContents.executeJavaScript(`
      (function () {
        window.__suppressScrollReport = true;
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        window.scrollTo(0, max > 0 ? max * ${clamped} : 0);
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
      scale: this.zoom * this.webviewScale
    })
  }

  private async ensureDebugger(): Promise<void> {
    if (this.debuggerAttached) return
    if (!this.webContents.debugger.isAttached()) {
      this.webContents.debugger.attach('1.3')
    }
    this.debuggerAttached = true
  }
}

export function getPanePreloadPath(): string {
  return join(__dirname, '../preload/pane-preload.js')
}
