import { WebContentsView, type BrowserWindow, type WebContents } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'
import type {
  PopoverAction,
  PopoverAlign,
  PopoverOpenOptions,
  PopoverPlacement,
  PopoverShowMessage
} from '../shared/popover-types'
import { POPOVER_PANEL_MIN_SIZE, POPOVER_STAGING_SIZE } from '../shared/popover-types'
import type { Size } from '../shared/types'
import type { PaneManager } from './pane-manager'
import { computePopoverBounds } from './popover-placement'

function getPopoverPreloadPath(): string {
  return join(__dirname, '../preload/popover-preload.js')
}

function getOverlayUrl(): string {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/overlay.html`
  }
  return pathToFileURL(join(__dirname, '../renderer/overlay.html')).href
}

export class PopoverManager {
  private view: WebContentsView | null = null
  private mainWindow: BrowserWindow | null = null
  private openOptions: PopoverOpenOptions | null = null
  private popoverSize: Size | null = null
  private isOpen = false
  private mounted = false
  private ready: Promise<void> | null = null

  constructor(private readonly paneManager: PaneManager) {}

  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
    this.paneManager.onChildViewStackChanged(() => {
      this.bringToFrontIfOpen()
    })
  }

  isOverlayWebContents(webContents: WebContents): boolean {
    return this.view !== null && webContents.id === this.view.webContents.id
  }

  destroy(): void {
    if (!this.view || this.view.webContents.isDestroyed()) return
    this.view.webContents.close()
    this.view = null
    this.ready = null
    this.mounted = false
  }

  getOpenPanelId(): PopoverOpenOptions['panelId'] | null {
    return this.isOpen ? (this.openOptions?.panelId ?? null) : null
  }

  async open(options: PopoverOpenOptions): Promise<void> {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return

    await this.ensureReady()
    const view = this.view
    if (!view) return

    this.openOptions = {
      ...options,
      placement: options.placement ?? 'bottom',
      align: options.align ?? 'end'
    }
    this.popoverSize = null
    this.isOpen = true
    view.setVisible(true)
    this.bringToFront()
    this.setStagingBounds(this.openOptions)

    const message: PopoverShowMessage = {
      panelId: options.panelId,
      payload: options.payload
    }
    view.webContents.send('popover:show', message)
  }

  close(): void {
    if (!this.isOpen) return

    this.isOpen = false
    this.openOptions = null
    this.popoverSize = null

    const view = this.view
    if (view) {
      view.setVisible(false)
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
      if (!view.webContents.isDestroyed()) {
        view.webContents.send('popover:hide')
      }
    }

    const mainWindow = this.mainWindow
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('popover:closed')
    }
  }

  handleSizeReport(size: Size): void {
    if (!this.isOpen || !this.openOptions) return

    const minSize = POPOVER_PANEL_MIN_SIZE[this.openOptions.panelId]
    this.popoverSize = {
      width: Math.max(minSize.width, Math.round(size.width)),
      height: Math.max(minSize.height, Math.round(size.height))
    }
    this.applyBounds()
  }

  async handleAction(action: PopoverAction): Promise<void> {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return

    if (action.type === 'set-theme') {
      await this.paneManager.setThemePreference(action.preference)
      if (!mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('popover:theme-changed', action.preference)
      }
    } else if (action.type === 'set-zoom') {
      if (!mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('popover:action', action)
      }
    }

    this.close()
  }

  bringToFrontIfOpen(): void {
    if (this.isOpen) {
      this.bringToFront()
    }
  }

  private createView(): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        preload: getPopoverPreloadPath(),
        sandbox: true,
        contextIsolation: true
      }
    })
    view.setBackgroundColor('#00000000')
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
    view.setVisible(false)
    return view
  }

  private async ensureReady(): Promise<void> {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (this.ready) return this.ready

    this.ready = new Promise<void>((resolve, reject) => {
      if (!this.view) {
        this.view = this.createView()
      }

      const view = this.view

      if (!this.mounted) {
        mainWindow.contentView.addChildView(view)
        this.mounted = true
        this.bringToFront()
      }

      const onReady = (): void => resolve()
      const onFail = (_event: Electron.Event, _code: number, description: string): void => {
        reject(new Error(`Popover overlay failed to load: ${description}`))
      }

      if (view.webContents.isLoading()) {
        view.webContents.once('did-finish-load', onReady)
        view.webContents.once('did-fail-load', onFail)
        return
      }

      if (view.webContents.getURL() === '') {
        view.webContents.once('did-finish-load', onReady)
        view.webContents.once('did-fail-load', onFail)
        void view.webContents.loadURL(getOverlayUrl())
        return
      }

      resolve()
    })

    return this.ready
  }

  private setStagingBounds(options: PopoverOpenOptions): void {
    const mainWindow = this.mainWindow
    const view = this.view
    if (!mainWindow || mainWindow.isDestroyed() || !view) return

    const { width: windowWidth, height: windowHeight } = mainWindow.getContentBounds()
    const bounds = computePopoverBounds(
      options.anchor,
      POPOVER_STAGING_SIZE,
      (options.placement ?? 'bottom') as PopoverPlacement,
      windowWidth,
      windowHeight,
      (options.align ?? 'end') as PopoverAlign
    )
    view.setBounds(bounds)
  }

  private bringToFront(): void {
    const mainWindow = this.mainWindow
    const view = this.view
    if (!mainWindow || mainWindow.isDestroyed() || !view || !this.mounted) return
    mainWindow.contentView.addChildView(view)
  }

  private applyBounds(): void {
    const mainWindow = this.mainWindow
    const view = this.view
    if (!mainWindow || mainWindow.isDestroyed() || !view || !this.openOptions || !this.popoverSize) return

    const { width: windowWidth, height: windowHeight } = mainWindow.getContentBounds()
    const bounds = computePopoverBounds(
      this.openOptions.anchor,
      this.popoverSize,
      this.openOptions.placement as PopoverPlacement,
      windowWidth,
      windowHeight,
      (this.openOptions.align ?? 'end') as PopoverAlign
    )
    view.setBounds(bounds)
    this.bringToFront()
  }
}
