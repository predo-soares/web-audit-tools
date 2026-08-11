import { WebContentsView, type BrowserWindow, type WebContents } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'
import type {
  PanelAction,
  PanelAlign,
  PanelCloseOptions,
  PanelEdge,
  PanelId,
  PanelOpenOptions,
  PanelPlacement,
  PanelShowMessage
} from '../../shared/panel-types'
import { PANEL_EXIT_MS } from '../../shared/panel-animation'
import {
  ANCHORED_POPOVER_VIEW_OWNER,
  getPanelFixedSize,
  PANEL_MIN_SIZE,
  PANEL_STAGING_SIZE
} from '../../shared/panel-types'
import { SIDEBAR_TRANSITION_MS, SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../shared/sidebar'
import {
  DIAGNOSTICS_DRAWER_WIDTH_PX,
  clampDiagnosticsDrawerWidth
} from '../../shared/runtime-evidence'
import { computeFitZoom } from '../../shared/mockup-layout'
import { matchesAppShortcut } from '../../shared/shortcuts'
import type { Bounds, Size } from '../../shared/pane-types'
import type { PaneManager } from '../panes/pane-manager'
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
  transitioning: boolean
  immediateNextOpen: boolean
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

const ALL_PANEL_IDS: PanelId[] = [
  'sidebar-left',
  'diagnostics-right',
  'toolbar-top',
  'zoom',
  'url-history',
  'shortcuts',
  'dev-context'
]

const PANEL_Z_ORDER: PanelId[] = ALL_PANEL_IDS

function isDiagnosticsToggleInput(input: Electron.Input): boolean {
  return (
    input.type === 'keyDown' &&
    matchesAppShortcut('diagnostics', {
      key: input.key,
      mod: input.meta || input.control,
      shift: input.shift,
      alt: input.alt
    })
  )
}

function isChromeToggleInput(input: Electron.Input): boolean {
  return (
    input.type === 'keyDown' &&
    matchesAppShortcut('immersive', {
      key: input.key,
      mod: input.meta || input.control,
      shift: input.shift,
      alt: input.alt
    })
  )
}

// Panels that make up the app chrome and are soft-hidden by the immersive mode.
const CHROME_PANEL_IDS: PanelId[] = ['toolbar-top', 'sidebar-left', 'diagnostics-right']

function isSlidingDockedPanel(panelId: PanelId): boolean {
  return panelId === 'sidebar-left' || panelId === 'diagnostics-right'
}

export class PanelManager {
  private entries = new Map<PanelId, PanelEntry>()
  private mainWindow: BrowserWindow | null = null
  private chromeZOrderHook: (() => void) | null = null
  private chromeHidden = false
  // Chrome panels that were visible when immersive mode was entered, so exiting
  // restores exactly what was on screen before.
  private chromeRestorePanels: PanelId[] = []

  constructor(private readonly paneManager: PaneManager) {}

  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
    this.registerDiagnosticsToggleShortcut(mainWindow.webContents)
    this.registerChromeShortcut(mainWindow.webContents)
    this.registerEscapeDismiss(mainWindow.webContents)
    this.paneManager.onChildViewStackChanged(() => {
      this.chromeZOrderHook?.()
      this.bringAllToFront()
    })
    mainWindow.on('resize', () => {
      this.applyDockedBoundsForOpenPanels()
      this.applyModalBoundsForOpenPanels()
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

  private applyModalBoundsForOpenPanels(): void {
    for (const [panelId, entry] of this.entries) {
      if (entry.isOpen && entry.options.mode === 'modal') {
        this.applyModalBounds(panelId)
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

  isPanelOpen(panelId: PanelId): boolean {
    return this.entries.get(panelId)?.isOpen === true
  }

  notifyPanel(panelId: PanelId, channel: string, ...args: unknown[]): void {
    const entry = this.entries.get(panelId)
    if (!entry?.isOpen || entry.view.webContents.isDestroyed()) return
    entry.view.webContents.send(channel, ...args)
  }

  private computeFitZoom(): number {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return 1

    const [windowWidth, windowHeight] = mainWindow.getContentSize()
    const openPanelIds = this.getOpenPanelIds()
    const sidebarOpen = openPanelIds.includes('sidebar-left')
    const diagnosticsOpen = openPanelIds.includes('diagnostics-right')
    const viewportWidth =
      windowWidth -
      (sidebarOpen ? SIDEBAR_WIDTH_PX : 0) -
      (diagnosticsOpen ? this.getDiagnosticsWidth() : 0)
    const viewportHeight = windowHeight - TOOLBAR_HEIGHT_PX

    return computeFitZoom(viewportWidth, viewportHeight)
  }

  getDiagnosticsWidth(): number {
    const entry = this.entries.get('diagnostics-right')
    if (!entry) return DIAGNOSTICS_DRAWER_WIDTH_PX

    const width = entry.options.width || entry.dockedWidth
    return width > 0 ? clampDiagnosticsDrawerWidth(width) : DIAGNOSTICS_DRAWER_WIDTH_PX
  }

  handleDockedResize(panelId: PanelId, width: number, phase: 'preview' | 'commit'): void {
    const entry = this.entries.get(panelId)
    if (!entry?.isOpen || entry.options.mode !== 'docked') return

    const clampedWidth =
      panelId === 'diagnostics-right'
        ? clampDiagnosticsDrawerWidth(width)
        : Math.max(PANEL_MIN_SIZE[panelId].width, Math.round(width))

    this.cancelBoundsAnimation(panelId)
    entry.dockedWidth = clampedWidth
    this.applyDockedBounds(panelId, clampedWidth)

    if (phase !== 'commit') return

    entry.options.width = clampedWidth
    if (panelId !== 'diagnostics-right') return

    this.broadcastDiagnosticsWidth(clampedWidth)
    this.syncDiagnosticsLayout()
  }

  private broadcastDiagnosticsWidth(width: number): void {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return

    mainWindow.webContents.send('panel:diagnostics-width', width)
    this.notifyToolbar('panel:diagnostics-width', width)
  }

  private syncDiagnosticsLayout(): void {
    const panelId = 'diagnostics-right'
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return

    mainWindow.webContents.send('panel:layout-settled', panelId)
    this.notifyToolbar('panel:layout-settled', panelId)
  }

  async open(options: PanelOpenOptions): Promise<void> {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return

    if (options.mode === 'anchored' || options.mode === 'modal') {
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
      width:
        panelId === 'diagnostics-right'
          ? options.width && options.width > 0
            ? clampDiagnosticsDrawerWidth(options.width)
            : this.getDiagnosticsWidth()
          : (options.width ?? SIDEBAR_WIDTH_PX)
    }
    entry.size = null
    entry.isOpen = true
    entry.isClosing = false
    const immediate = entry.immediateNextOpen
    entry.immediateNextOpen = false
    entry.view.setVisible(true)
    this.bringToFront(panelId)

    if (options.mode === 'modal') {
      this.applyModalBounds(panelId)
      this.deliverShow(panelId, {
        panelId,
        mode: 'modal'
      })
      return
    }

    if (options.mode === 'docked') {
      const message: PanelShowMessage = {
        panelId,
        mode: 'docked',
        edge: entry.options.edge,
        payload: options.payload,
        immediate
      }
      this.deliverShow(panelId, message)

      const targetWidth =
        panelId === 'toolbar-top'
          ? TOOLBAR_HEIGHT_PX
          : panelId === 'diagnostics-right'
            ? this.getDiagnosticsWidth()
            : (entry.options.width ?? SIDEBAR_WIDTH_PX)

      if (isSlidingDockedPanel(panelId)) {
        // Keep the native view at its real width while the renderer slides its
        // contents in. Animating the WebContentsView width makes the sidebar
        // reflow and briefly exposes a scrollbar during the transition.
        entry.dockedWidth = panelId === 'sidebar-left' ? SIDEBAR_WIDTH_PX : targetWidth
        this.applyDockedBounds(panelId, entry.dockedWidth)
        if (immediate) {
          this.sendTransition(panelId, false)
          return
        }
        this.sendTransition(panelId, true)
        this.animateDockedTransition(panelId, () => {
          this.sendTransition(panelId, false)
        })
        return
      }

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

  close(panelId: PanelId, options: PanelCloseOptions = {}): void {
    const entry = this.entries.get(panelId)
    if (!entry || !entry.isOpen) return
    if (entry.isClosing) {
      if (!options.immediate) return
      this.cancelBoundsAnimation(panelId)
      entry.isClosing = false
    }

    if (entry.options.mode === 'docked') {
      const immediate = options.immediate === true
      this.cancelBoundsAnimation(panelId)
      entry.isClosing = true
      if (immediate) entry.immediateNextOpen = true
      if (!immediate) this.sendTransition(panelId, true)

      if (!entry.view.webContents.isDestroyed()) {
        entry.view.webContents.send('panel:hide')
      }

      const finishClose = (): void => {
        entry.isClosing = false
        entry.isOpen = false
        entry.dockedWidth = 0
        entry.view.setVisible(false)
        if (isSlidingDockedPanel(panelId)) {
          entry.view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
        }
        this.sendTransition(panelId, false)

        const mainWindow = this.mainWindow
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('panel:closed', panelId)
          this.notifyToolbar('panel:closed', panelId)
        }
      }

      if (immediate) {
        finishClose()
      } else if (isSlidingDockedPanel(panelId)) {
        // The renderer owns the slide-out. Keep the native view fixed until
        // the content has finished leaving the viewport.
        this.animateDockedTransition(panelId, finishClose)
      } else {
        this.animateDockedWidth(panelId, 0, finishClose)
      }
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

    if (getPanelFixedSize(panelId) || entry.options.mode === 'modal') return

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
    if (entry.options.mode === 'docked') {
      entry.view.webContents.send('panel:transition', {
        panelId,
        transitioning: entry.transitioning
      })
    }
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
    const entry = this.entries.get(panelId)
    if (entry) {
      entry.transitioning = transitioning
      if (!entry.view.webContents.isDestroyed()) {
        entry.view.webContents.send('panel:transition', { panelId, transitioning })
      }
    }

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

  private animateDockedTransition(panelId: PanelId, onComplete?: () => void): void {
    const entry = this.entries.get(panelId)
    if (!entry) return

    this.cancelBoundsAnimation(panelId)
    const startTime = Date.now()
    entry.boundsAnimationTimer = setInterval(() => {
      if (Date.now() - startTime < SIDEBAR_TRANSITION_MS) return
      this.cancelBoundsAnimation(panelId)
      onComplete?.()
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

  private applyModalBounds(panelId: PanelId): void {
    const mainWindow = this.mainWindow
    const entry = this.entries.get(panelId)
    if (!mainWindow || mainWindow.isDestroyed() || !entry) return

    const { width, height } = mainWindow.getContentBounds()
    entry.view.setBounds({ x: 0, y: 0, width, height })
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
      this.notifyPanel('sidebar-left', 'panel:closed', panelId)
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
    this.registerDiagnosticsToggleShortcut(view.webContents)
    this.registerChromeShortcut(view.webContents)
    this.registerEscapeDismiss(view.webContents)
    return view
  }

  private registerEscapeDismiss(webContents: WebContents): void {
    webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.key !== 'Escape') return
      for (const panelId of [...PANEL_Z_ORDER].reverse()) {
        const entry = this.entries.get(panelId)
        if (!entry?.isOpen || entry.options.mode === 'docked') continue
        event.preventDefault()
        this.close(panelId)
        return
      }
    })
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
      transitioning: false,
      immediateNextOpen: false,
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

  reassertZOrder(): void {
    this.bringAllToFront()
  }

  setChromeZOrderHook(hook: (() => void) | null): void {
    this.chromeZOrderHook = hook
  }

  private notifyToolbar(channel: string, ...args: unknown[]): void {
    const entry = this.entries.get('toolbar-top')
    if (!entry || entry.view.webContents.isDestroyed()) return
    entry.view.webContents.send(channel, ...args)
  }

  notifyToolbarPanel(channel: string, ...args: unknown[]): void {
    this.notifyToolbar(channel, ...args)
  }

  registerDiagnosticsToggleShortcut(webContents: WebContents): void {
    webContents.on('before-input-event', (event, input) => {
      if (!isDiagnosticsToggleInput(input)) return
      event.preventDefault()
      this.notifyToolbarPanel('panel:toggle-diagnostics')
    })
  }

  private registerChromeShortcut(webContents: WebContents): void {
    webContents.on('before-input-event', (event, input) => {
      if (this.handleChromeInput(input, () => event.preventDefault())) return
    })
  }

  // Shared by the window, panel views, and pane views: Cmd/Ctrl+Shift+H toggles
  // immersive mode, and Escape leaves it while it is active. The main window owns
  // the decision (workspace gating), so we only forward the intent.
  private handleChromeInput(input: Electron.Input, preventDefault: () => void): boolean {
    if (isChromeToggleInput(input)) {
      preventDefault()
      this.notifyMainWindow('app:toggle-chrome')
      return true
    }
    if (this.chromeHidden && input.type === 'keyDown' && input.key === 'Escape') {
      preventDefault()
      this.notifyMainWindow('app:exit-chrome')
      return true
    }
    return false
  }

  private notifyMainWindow(channel: string, ...args: unknown[]): void {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
    mainWindow.webContents.send(channel, ...args)
  }

  isChromeHidden(): boolean {
    return this.chromeHidden
  }

  // Soft-hides the chrome overlays (toolbar, sidebar, diagnostics) without
  // touching their open state, so exiting restores the previous layout exactly.
  // The main window handles the canvas offsets separately.
  setChromeHidden(hidden: boolean): void {
    if (this.chromeHidden === hidden) return
    this.chromeHidden = hidden

    if (hidden) {
      this.chromeRestorePanels = CHROME_PANEL_IDS.filter((panelId) => this.isPanelOpen(panelId))
      for (const panelId of this.chromeRestorePanels) {
        this.entries.get(panelId)?.view.setVisible(false)
      }
      return
    }

    for (const panelId of this.chromeRestorePanels) {
      const entry = this.entries.get(panelId)
      if (!entry?.isOpen) continue
      entry.view.setVisible(true)
      if (entry.options.mode === 'docked') {
        this.applyDockedBounds(panelId, entry.dockedWidth)
      }
    }
    this.chromeRestorePanels = []
  }

  /** Handle a pane before-input event through the EngineView seam. */
  handlePaneBeforeInput(input: Electron.Input, preventDefault: () => void): void {
    if (this.handleChromeInput(input, preventDefault)) return
    if (!isDiagnosticsToggleInput(input)) return
    preventDefault()
    this.notifyToolbarPanel('panel:toggle-diagnostics')
  }

  notifyOverlayPanels(channel: string, ...args: unknown[]): void {
    for (const entry of this.entries.values()) {
      if (entry.view.webContents.isDestroyed()) continue
      entry.view.webContents.send(channel, ...args)
    }
  }

  private applyAnchoredBounds(panelId: PanelId): void {
    const mainWindow = this.mainWindow
    const entry = this.entries.get(panelId)
    if (!mainWindow || mainWindow.isDestroyed() || !entry?.options.anchor || !entry.size) {
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
