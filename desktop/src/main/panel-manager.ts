import { WebContentsView, type BrowserWindow, type WebContents } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'
import type {
  PanelAction,
  PanelAlign,
  PanelEdge,
  PanelId,
  PanelOpenOptions,
  PanelPlacement,
  PanelShowMessage
} from '../shared/panel-types'
import { PANEL_EXIT_MS } from '../shared/panel-animation'
import {
  ANCHORED_POPOVER_VIEW_OWNER,
  getPanelFixedSize,
  PANEL_MIN_SIZE,
  PANEL_STAGING_SIZE
} from '../shared/panel-types'
import { SIDEBAR_TRANSITION_MS, SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../shared/sidebar'
import { computeFitZoom } from '../shared/mockup-layout'
import type { Bounds, Size } from '../shared/types'
import type { PaneManager } from './pane-manager'
import { computePanelBounds } from './panel-placement'

interface PanelEntry {
  view: WebContentsView
  options: PanelOpenOptions
  size: Size | null
  isClosing: boolean
  isOpen: boolean
  hasShown: boolean
  rendererReady: boolean
  pendingShow: PanelShowMessage | null
  lastShow: PanelShowMessage | null
  dockedWidth: number
  boundsAnimationTimer: ReturnType<typeof setInterval> | null
  closeFallbackTimer: ReturnType<typeof setTimeout> | null
  mounted: boolean
  ready: Promise<void>
}

function getPanelPreloadPath(): string {
  return join(__dirname, '../preload/panel-preload.js')
}

function getOverlayUrl(): string {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/overlay.html`
  }
  return pathToFileURL(join(__dirname, '../renderer/overlay.html')).href
}

function computeDockedBounds(
  edge: PanelEdge,
  width: number,
  windowWidth: number,
  windowHeight: number
): Bounds {
  const roundedWidth = Math.round(width)

  switch (edge) {
    case 'left':
      return { x: 0, y: 0, width: roundedWidth, height: windowHeight }
    case 'right':
      return {
        x: windowWidth - roundedWidth,
        y: 0,
        width: roundedWidth,
        height: windowHeight
      }
    case 'top':
      return { x: 0, y: 0, width: windowWidth, height: roundedWidth }
    case 'bottom':
      return {
        x: 0,
        y: windowHeight - roundedWidth,
        width: windowWidth,
        height: roundedWidth
      }
  }
}

const ALL_PANEL_IDS: PanelId[] = ['sidebar-left', 'sidebar-right', 'toolbar-top', 'zoom']

const PANEL_Z_ORDER: PanelId[] = ALL_PANEL_IDS

export class PanelManager {
  private entries = new Map<PanelId, PanelEntry>()
  private mainWindow: BrowserWindow | null = null

  constructor(private readonly paneManager: PaneManager) {}

  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
    this.paneManager.onChildViewStackChanged(() => {
      this.bringAllToFront()
    })
    mainWindow.on('resize', () => {
      this.applyDockedBoundsForOpenPanels()
    })
    void this.prewarmAllPanels()
  }

  private async prewarmAllPanels(): Promise<void> {
    await Promise.all(ALL_PANEL_IDS.map((panelId) => this.ensureEntry(panelId)))
  }

  private applyDockedBoundsForOpenPanels(): void {
    for (const [panelId, entry] of this.entries) {
      if (entry.isOpen && entry.options.mode === 'docked') {
        this.applyDockedBounds(panelId, entry.dockedWidth)
      }
    }
  }

  isOverlayWebContents(webContents: WebContents): boolean {
    for (const entry of this.entries.values()) {
      if (entry.view.webContents.id === webContents.id) return true
    }
    return false
  }

  getPanelIdForWebContents(webContents: WebContents): PanelId | null {
    for (const [panelId, entry] of this.entries) {
      if (entry.view.webContents.id === webContents.id && (entry.isOpen || entry.isClosing)) {
        return panelId
      }
    }

    for (const [panelId, entry] of this.entries) {
      if (entry.view.webContents.id === webContents.id) return panelId
    }
    return null
  }

  destroy(): void {
    for (const panelId of [...this.entries.keys()]) {
      this.destroyEntry(panelId)
    }
  }

  getOpenPanelIds(): PanelId[] {
    return [...this.entries.entries()]
      .filter(([, entry]) => entry.isOpen)
      .map(([panelId]) => panelId)
  }

  private computeFitZoom(): number {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return 1

    const [windowWidth, windowHeight] = mainWindow.getContentSize()
    const sidebarOpen = this.getOpenPanelIds().includes('sidebar-left')
    const viewportWidth = windowWidth - (sidebarOpen ? SIDEBAR_WIDTH_PX : 0)
    const viewportHeight = windowHeight - TOOLBAR_HEIGHT_PX

    return computeFitZoom(viewportWidth, viewportHeight)
  }

  async open(options: PanelOpenOptions): Promise<void> {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return

    if (options.mode === 'anchored') {
      for (const [panelId, entry] of this.entries) {
        if (panelId !== options.panelId && entry.isOpen && entry.options.mode === 'anchored') {
          this.close(panelId)
        }
      }
    }

    const panelId = options.panelId
    this.cancelClose(panelId)
    this.cancelBoundsAnimation(panelId)

    const entry = await this.ensureEntry(panelId)
    if (!entry) return

    entry.options = {
      ...options,
      placement: options.placement ?? 'bottom',
      align: options.align ?? 'end',
      edge: options.edge ?? 'left',
      width: options.width ?? SIDEBAR_WIDTH_PX
    }
    entry.size = null
    entry.isOpen = true
    entry.isClosing = false
    if (options.mode === 'docked') {
      entry.view.setVisible(true)
    }
    this.bringToFront(panelId)

    if (options.mode === 'docked') {
      const message: PanelShowMessage = {
        panelId,
        mode: 'docked',
        edge: entry.options.edge
      }
      this.deliverShow(panelId, message)

      const targetWidth =
        panelId === 'toolbar-top'
          ? TOOLBAR_HEIGHT_PX
          : (entry.options.width ?? SIDEBAR_WIDTH_PX)

      if (panelId === 'toolbar-top') {
        entry.dockedWidth = targetWidth
        this.applyDockedBounds(panelId, targetWidth)
        this.sendTransition(panelId, false)
        return
      }

      this.sendTransition(panelId, true)
      this.animateDockedWidth(panelId, targetWidth, () => {
        this.sendTransition(panelId, false)
      })
      return
    }

    const fixedSize = getPanelFixedSize(panelId)
    if (fixedSize) {
      entry.size = fixedSize
      this.applyAnchoredBounds(panelId)
    } else {
      this.setStagingBounds(panelId)
    }

    const message: PanelShowMessage = {
      panelId,
      mode: options.mode,
      payload: options.payload,
      placement: entry.options.placement as PanelPlacement,
      align: entry.options.align as PanelAlign
    }
    this.deliverShow(panelId, message)
  }

  close(panelId: PanelId): void {
    const entry = this.entries.get(panelId)
    if (!entry || !entry.isOpen || entry.isClosing) return

    if (entry.options.mode === 'docked') {
      this.cancelBoundsAnimation(panelId)
      entry.isClosing = true
      this.sendTransition(panelId, true)

      if (!entry.view.webContents.isDestroyed()) {
        entry.view.webContents.send('panel:hide')
      }

      this.animateDockedWidth(panelId, 0, () => {
        entry.isClosing = false
        entry.isOpen = false
        entry.view.setVisible(false)
        this.sendTransition(panelId, false)

        const mainWindow = this.mainWindow
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('panel:closed', panelId)
          this.notifyToolbar('panel:closed', panelId)
        }
      })
      return
    }

    entry.isClosing = true
    entry.isOpen = false
    entry.size = null

    if (entry.view.webContents.isDestroyed()) {
      this.finalizeAnchoredClose(panelId)
      return
    }

    entry.view.webContents.send('panel:hide')
    entry.closeFallbackTimer = setTimeout(() => {
      this.finalizeAnchoredClose(panelId)
    }, PANEL_EXIT_MS + 80)
  }

  handleExitComplete(panelId: PanelId): void {
    const entry = this.entries.get(panelId)
    if (!entry?.isClosing || entry.options.mode === 'docked') return
    this.finalizeAnchoredClose(panelId)
  }

  handleSizeReport(panelId: PanelId, size: Size): void {
    const entry = this.entries.get(panelId)
    if (!entry?.isOpen) return

    if (getPanelFixedSize(panelId)) return

    if (entry.options.mode === 'docked') {
      this.applyDockedBounds(panelId, entry.dockedWidth)
      return
    }

    const minSize = PANEL_MIN_SIZE[panelId]
    entry.size = {
      width: Math.max(minSize.width, Math.round(size.width)),
      height: Math.max(minSize.height, Math.round(size.height))
    }
    this.applyAnchoredBounds(panelId)
  }

  async handleAction(panelId: PanelId, action: PanelAction): Promise<void> {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return

    if (action.type === 'set-theme') {
      await this.paneManager.setThemePreference(action.preference)
      if (!mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('panel:theme-changed', action.preference)
        this.notifyToolbar('panel:theme-changed', action.preference)
      }
    } else if (action.type === 'set-zoom' || action.type === 'fit-zoom') {
      const zoomAction =
        action.type === 'fit-zoom'
          ? { type: 'set-zoom' as const, zoom: this.computeFitZoom() }
          : action

      if (!mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('panel:action', zoomAction)
        this.notifyToolbar('panel:action', zoomAction)
      }
    }

    this.close(panelId)
  }

  handleFocusOnClose(panelId: PanelId): void {
    if (panelId !== 'sidebar-left') return
    this.notifyToolbar('panel:focus-sidebar-toggle')
  }

  handleRendererReady(panelId: PanelId): void {
    const entry = this.entries.get(panelId)
    if (!entry) return

    entry.rendererReady = true

    const message = entry.pendingShow ?? (entry.isOpen ? entry.lastShow : null)
    if (!message || entry.view.webContents.isDestroyed()) return

    entry.view.webContents.send('panel:show', message)
    entry.hasShown = true
    entry.pendingShow = null
  }

  private deliverShow(panelId: PanelId, message: PanelShowMessage): void {
    const entry = this.entries.get(panelId)
    if (!entry || entry.view.webContents.isDestroyed()) return

    entry.lastShow = message

    if (!entry.rendererReady) {
      entry.pendingShow = message
      return
    }

    entry.view.webContents.send('panel:show', message)
    entry.hasShown = true
    entry.pendingShow = null
  }

  private sendTransition(panelId: PanelId, transitioning: boolean): void {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
    mainWindow.webContents.send('panel:transition', { panelId, transitioning })
    if (!transitioning) {
      mainWindow.webContents.send('panel:layout-settled', panelId)
      this.notifyToolbar('panel:layout-settled', panelId)
    }
  }

  private cancelClose(panelId: PanelId): void {
    const entry = this.entries.get(panelId)
    if (!entry) return
    this.clearCloseFallback(entry)
    entry.isClosing = false
  }

  private clearCloseFallback(entry: PanelEntry): void {
    if (entry.closeFallbackTimer) {
      clearTimeout(entry.closeFallbackTimer)
      entry.closeFallbackTimer = null
    }
  }

  private cancelBoundsAnimation(panelId: PanelId): void {
    const entry = this.entries.get(panelId)
    if (!entry?.boundsAnimationTimer) return
    clearInterval(entry.boundsAnimationTimer)
    entry.boundsAnimationTimer = null
  }

  private animateDockedWidth(panelId: PanelId, targetWidth: number, onComplete?: () => void): void {
    const entry = this.entries.get(panelId)
    const mainWindow = this.mainWindow
    if (!entry || !mainWindow || mainWindow.isDestroyed()) return

    this.cancelBoundsAnimation(panelId)

    const startWidth = entry.dockedWidth
    const startTime = Date.now()

    entry.boundsAnimationTimer = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(1, elapsed / SIDEBAR_TRANSITION_MS)
      const width = startWidth + (targetWidth - startWidth) * progress
      entry.dockedWidth = width
      this.applyDockedBounds(panelId, width)

      if (progress >= 1) {
        this.cancelBoundsAnimation(panelId)
        entry.dockedWidth = targetWidth
        this.applyDockedBounds(panelId, targetWidth)
        onComplete?.()
      }
    }, 16)
  }

  private applyDockedBounds(panelId: PanelId, width: number): void {
    const mainWindow = this.mainWindow
    const entry = this.entries.get(panelId)
    if (!mainWindow || mainWindow.isDestroyed() || !entry) return

    const { width: windowWidth, height: windowHeight } = mainWindow.getContentBounds()
    const edge = entry.options.edge ?? 'left'
    const bounds = computeDockedBounds(edge, width, windowWidth, windowHeight)
    entry.view.setBounds(bounds)
    this.bringToFront(panelId)
  }

  private finalizeAnchoredClose(panelId: PanelId): void {
    const entry = this.entries.get(panelId)
    if (!entry) return

    this.clearCloseFallback(entry)
    entry.isClosing = false
    entry.view.setBounds({ x: 0, y: 0, width: 0, height: 0 })

    const mainWindow = this.mainWindow
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('panel:closed', panelId)
      this.notifyToolbar('panel:closed', panelId)
    }
  }

  private destroyEntry(panelId: PanelId): void {
    const entry = this.entries.get(panelId)
    if (!entry) return

    this.clearCloseFallback(entry)
    this.cancelBoundsAnimation(panelId)

    const mainWindow = this.mainWindow
    if (mainWindow && !mainWindow.isDestroyed() && entry.mounted) {
      try {
        mainWindow.contentView.removeChildView(entry.view)
      } catch {
        // View may already be removed
      }
    }

    if (!entry.view.webContents.isDestroyed()) {
      entry.view.webContents.close()
    }

    this.entries.delete(panelId)
  }

  private createView(): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        preload: getPanelPreloadPath(),
        sandbox: true,
        contextIsolation: true
      }
    })
    view.setBackgroundColor('#00000000')
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
    view.setVisible(false)
    return view
  }

  private async ensureEntry(panelId: PanelId): Promise<PanelEntry | null> {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return null

    let entry = this.entries.get(panelId)
    if (entry) return entry

    const view = this.createView()
    entry = {
      view,
      options: { panelId, mode: 'anchored' },
      size: null,
      isClosing: false,
      isOpen: false,
      hasShown: false,
      rendererReady: false,
      pendingShow: null,
      lastShow: null,
      dockedWidth: 0,
      boundsAnimationTimer: null,
      closeFallbackTimer: null,
      mounted: false,
      ready: Promise.resolve()
    }
    this.entries.set(panelId, entry)

    entry.ready = new Promise<void>((resolve, reject) => {
      const onReady = (): void => resolve()
      const onFail = (_event: Electron.Event, _code: number, description: string): void => {
        reject(new Error(`Panel overlay failed to load: ${description}`))
      }

      if (!entry!.mounted) {
        mainWindow.contentView.addChildView(view)
        entry!.mounted = true
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

    await entry.ready

    if (panelId === ANCHORED_POPOVER_VIEW_OWNER) {
      view.setVisible(true)
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
    }

    return entry
  }

  private setStagingBounds(panelId: PanelId): void {
    const mainWindow = this.mainWindow
    const entry = this.entries.get(panelId)
    if (!mainWindow || mainWindow.isDestroyed() || !entry?.options.anchor) return

    const { width: windowWidth, height: windowHeight } = mainWindow.getContentBounds()
    const stagingSize = getPanelFixedSize(panelId) ?? PANEL_STAGING_SIZE
    const { bounds } = computePanelBounds(
      entry.options.anchor,
      stagingSize,
      (entry.options.placement ?? 'bottom') as PanelPlacement,
      windowWidth,
      windowHeight,
      (entry.options.align ?? 'end') as PanelAlign
    )
    entry.view.setBounds(bounds)
  }

  private bringToFront(panelId: PanelId): void {
    const mainWindow = this.mainWindow
    const entry = this.entries.get(panelId)
    if (!mainWindow || mainWindow.isDestroyed() || !entry?.mounted) return
    mainWindow.contentView.addChildView(entry.view)
    this.enforcePanelZOrder()
  }

  private enforcePanelZOrder(): void {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return

    for (const panelId of PANEL_Z_ORDER) {
      const entry = this.entries.get(panelId)
      if (entry?.isOpen && entry.mounted) {
        mainWindow.contentView.addChildView(entry.view)
      }
    }
  }

  private bringAllToFront(): void {
    this.enforcePanelZOrder()
  }

  private notifyToolbar(channel: string, ...args: unknown[]): void {
    const entry = this.entries.get('toolbar-top')
    if (!entry || entry.view.webContents.isDestroyed()) return
    entry.view.webContents.send(channel, ...args)
  }

  notifyToolbarPanel(channel: string, ...args: unknown[]): void {
    this.notifyToolbar(channel, ...args)
  }

  private applyAnchoredBounds(panelId: PanelId): void {
    const mainWindow = this.mainWindow
    const entry = this.entries.get(panelId)
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      !entry?.options.anchor ||
      !entry.size
    ) {
      return
    }

    const { width: windowWidth, height: windowHeight } = mainWindow.getContentBounds()
    const { bounds, placement } = computePanelBounds(
      entry.options.anchor,
      entry.size,
      entry.options.placement as PanelPlacement,
      windowWidth,
      windowHeight,
      (entry.options.align ?? 'end') as PanelAlign
    )
    entry.view.setBounds(bounds)

    if (!entry.view.webContents.isDestroyed()) {
      entry.view.webContents.send('panel:placement', placement)
    }

    this.bringToFront(panelId)
  }
}
