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
      void this.applyDeviceEmulation()
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
    await this.ensureDebugger()

    await this.webContents.debugger.sendCommand('Emulation.setUserAgentOverride', {
      userAgent: profile.userAgent
    })

    await this.webContents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {
      enabled: profile.touch
    })

    this.webContents.setZoomFactor(1)
    await this.applyDeviceEmulation()
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

  private async applyDeviceEmulation(): Promise<void> {
    if (!this.profile) return
    await this.ensureDebugger()
    const logicalSize = this.logicalSize ?? {
      width: this.profile.width,
      height: this.profile.height
    }

    // Native bounds follow the transformed canvas screen rectangle. CDP keeps
    // the page's logical device viewport stable and scales the resulting image
    // so responsive breakpoints do not change while canvas zoom does.
    await this.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
      width: logicalSize.width,
      height: logicalSize.height,
      deviceScaleFactor: this.profile.deviceScaleFactor,
      mobile: this.profile.touch,
      screenWidth: logicalSize.width,
      screenHeight: logicalSize.height,
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
