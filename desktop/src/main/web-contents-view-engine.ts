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
  isMachineGeneratedId,
  resolveElementFingerprint,
  type ElementFingerprint,
  type MirrorFailureLog
} from '../shared/element-fingerprint'
import { DEFAULT_ZOOM } from '../shared/mockup-layout'
import { normalizeUrl } from '../shared/url'
import type { EngineView, ValueSyncPayload } from './engine-view'

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
        if (value && !value.matched) {
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

      return { x: value.x, y: value.y }
    } catch {
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

      if (response.exceptionDetails) return
      const result = response.result?.value as ResolvedMirrorAction | undefined
      if (result && !result.matched) {
        this.logMirrorFailure({
          fingerprint,
          paneId: this.paneId,
          reason: result.failureReason === 'ambiguous' ? 'ambiguous' : 'not-found'
        })
      }
    } catch {
      // Ignore if page not ready
    }
  }

  async submitForm(fingerprint: ElementFingerprint): Promise<void> {
    try {
      await this.ensureDebugger()
      const response = (await this.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: this.getSubmitExpression(fingerprint),
        returnByValue: true
      })) as RuntimeEvaluateResponse

      if (response.exceptionDetails) return
      const result = response.result?.value as ResolvedMirrorAction | undefined
      if (result && !result.matched) {
        this.logMirrorFailure({
          fingerprint,
          paneId: this.paneId,
          reason: result.failureReason === 'ambiguous' ? 'ambiguous' : 'not-found'
        })
      }
    } catch {
      // Ignore if page not ready
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

  private getClickResolutionExpression(fingerprint: ElementFingerprint): string {
    return `
      (() => {
        const fingerprint = ${JSON.stringify(fingerprint)};
        const normalizeVisibleText = ${normalizeVisibleText.toString()};
        const isMachineGeneratedId = ${isMachineGeneratedId.toString()};
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

        function getStructuralPath(el) {
          const parts = [];
          let current = el;
          while (current && current !== document.body) {
            const parent = current.parentElement;
            if (parent) {
              const index = Array.from(parent.children).indexOf(current) + 1;
              parts.unshift(current.tagName.toLowerCase() + ':nth-child(' + index + ')');
            } else {
              parts.unshift(current.tagName.toLowerCase());
            }
            current = parent;
          }
          return parts.join(' > ');
        }

        function describeElement(element) {
          const tagName = element.tagName.toLowerCase();
          const isFormField = element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement;
          let testId = element.getAttribute('data-testid') || null;
          if (!testId && isFormField) {
            if ((element instanceof HTMLInputElement) &&
                (element.type === 'checkbox' || element.type === 'radio') &&
                element.name) {
              const groupMatches = Array.from(document.querySelectorAll('input'))
                .filter((candidate) =>
                  candidate instanceof HTMLInputElement &&
                  !candidate.disabled &&
                  candidate.type === element.type &&
                  candidate.name === element.name
                );
              const groupIndex = groupMatches.indexOf(element);
              testId = groupMatches.length > 1 && groupIndex !== -1
                ? element.type + ':' + element.name + ':' + groupIndex
                : element.name || null;
            } else {
              testId = element.name || null;
            }
          }
          return {
            tagName,
            id: element.id || null,
            visibleText: getVisibleText(element),
            testId,
            ariaLabel: element.getAttribute('aria-label') || null,
            role: element.getAttribute('role') || null,
            structuralPath: getStructuralPath(element)
          };
        }

        const elements = Array.from(document.querySelectorAll(interactiveSelector))
          .filter((element) => element instanceof HTMLElement && !element.disabled);
        const descriptors = elements.map(describeElement);
        const resolved = resolveElementFingerprint(fingerprint, descriptors);

        if (!resolved) {
          // Determine failure reason: check if any layer had multiple matches
          let failureReason = 'not-found';
          for (const layer of fingerprint.layers) {
            let matchCount = 0;
            for (const candidate of descriptors) {
              let matched = false;
              if (layer.type === 'id') {
                matched = candidate.id === layer.id;
              } else if (layer.type === 'testid') {
                matched = candidate.testId === layer.testId;
              } else if (layer.type === 'accessible-name') {
                matched = candidate.tagName.toLowerCase() === layer.tagName &&
                  (candidate.role || candidate.tagName.toLowerCase()) === layer.role &&
                  normalizeVisibleText(candidate.ariaLabel) === layer.name;
              } else if (layer.type === 'structural-path') {
                matched = candidate.structuralPath === layer.path;
              } else {
                matched = candidate.tagName.toLowerCase() === layer.tagName &&
                  normalizeVisibleText(candidate.visibleText) === layer.text;
              }
              if (matched) matchCount++;
            }
            if (matchCount > 1 && fingerprint.indexAmongMatches === undefined) {
              failureReason = 'ambiguous';
              break;
            }
          }
          return { matched: false, failureReason };
        }

        const element = elements[resolved.index];

        // Scroll the element into view before measuring its position.
        // Set the scroll-suppression flag so that the scroll events fired by
        // scrollIntoView are not echoed to other panes via pane:scroll IPC.
        // The flag is cleared asynchronously after this expression returns
        // (scroll events from scrollIntoView fire asynchronously), so we use
        // setTimeout(0) to queue the cleanup after the current microtask.
        window.__suppressScrollReport = true;
        element.scrollIntoView({ block: 'center', behavior: 'instant' });
        requestAnimationFrame(function () {
          window.__suppressScrollReport = false;
        });

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
        const resolveElementFingerprint = ${resolveElementFingerprint.toString()};
        const interactiveSelector = 'input:not([type="hidden"]),textarea,select';

        function getVisibleText(element) {
          if (element instanceof HTMLInputElement) {
            if (['button', 'submit', 'reset'].includes(element.type)) {
              return normalizeVisibleText(element.value);
            }
            return '';
          }
          return normalizeVisibleText(element instanceof HTMLElement ? element.innerText : element.textContent);
        }

        function getStructuralPath(el) {
          const parts = [];
          let current = el;
          while (current && current !== document.body) {
            const parent = current.parentElement;
            if (parent) {
              const index = Array.from(parent.children).indexOf(current) + 1;
              parts.unshift(current.tagName.toLowerCase() + ':nth-child(' + index + ')');
            } else {
              parts.unshift(current.tagName.toLowerCase());
            }
            current = parent;
          }
          return parts.join(' > ');
        }

        function describeElement(element) {
          const isFormField = element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement;
          return {
            tagName: element.tagName.toLowerCase(),
            id: element.id || null,
            visibleText: getVisibleText(element),
            testId: element.getAttribute('data-testid') || (isFormField ? element.name || null : null),
            ariaLabel: element.getAttribute('aria-label') || null,
            role: element.getAttribute('role') || null,
            structuralPath: getStructuralPath(element)
          };
        }

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
        function getFailureReason(descriptors) {
          for (const layer of fingerprint.layers) {
            let matchCount = 0;
            for (const candidate of descriptors) {
              let matched = false;
              if (layer.type === 'id') {
                matched = candidate.id === layer.id;
              } else if (layer.type === 'testid') {
                matched = candidate.testId === layer.testId;
              } else if (layer.type === 'accessible-name') {
                matched = candidate.tagName.toLowerCase() === layer.tagName &&
                  (candidate.role || candidate.tagName.toLowerCase()) === layer.role &&
                  normalizeVisibleText(candidate.ariaLabel) === layer.name;
              } else if (layer.type === 'structural-path') {
                matched = candidate.structuralPath === layer.path;
              } else {
                matched = candidate.tagName.toLowerCase() === layer.tagName &&
                  normalizeVisibleText(candidate.visibleText) === layer.text;
              }
              if (matched) matchCount++;
            }
            if (matchCount > 1 && fingerprint.indexAmongMatches === undefined) {
              return 'ambiguous';
            }
          }
          return 'not-found';
        }

        const descriptors = elements.map(describeElement);
        const resolved = resolveElementFingerprint(fingerprint, descriptors);
        if (!resolved) return { matched: false, failureReason: getFailureReason(descriptors) };

        const element = elements[resolved.index];
        if (!element) return { matched: false, failureReason: 'not-found' };

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
        const resolveElementFingerprint = ${resolveElementFingerprint.toString()};

        function getStructuralPath(el) {
          const parts = [];
          let current = el;
          while (current && current !== document.body) {
            const parent = current.parentElement;
            if (parent) {
              const index = Array.from(parent.children).indexOf(current) + 1;
              parts.unshift(current.tagName.toLowerCase() + ':nth-child(' + index + ')');
            } else {
              parts.unshift(current.tagName.toLowerCase());
            }
            current = parent;
          }
          return parts.join(' > ');
        }

        function getVisibleText(element) {
          return normalizeVisibleText(element instanceof HTMLElement ? element.innerText : element.textContent);
        }

        function describeElement(element) {
          return {
            tagName: element.tagName.toLowerCase(),
            id: element.id || null,
            visibleText: getVisibleText(element),
            testId: element.getAttribute('data-testid') || null,
            ariaLabel: element.getAttribute('aria-label') || null,
            role: element.getAttribute('role') || null,
            structuralPath: getStructuralPath(element)
          };
        }

        const forms = Array.from(document.querySelectorAll('form'));
        function getFailureReason(descriptors) {
          for (const layer of fingerprint.layers) {
            let matchCount = 0;
            for (const candidate of descriptors) {
              let matched = false;
              if (layer.type === 'id') {
                matched = candidate.id === layer.id;
              } else if (layer.type === 'testid') {
                matched = candidate.testId === layer.testId;
              } else if (layer.type === 'accessible-name') {
                matched = candidate.tagName.toLowerCase() === layer.tagName &&
                  (candidate.role || candidate.tagName.toLowerCase()) === layer.role &&
                  normalizeVisibleText(candidate.ariaLabel) === layer.name;
              } else if (layer.type === 'structural-path') {
                matched = candidate.structuralPath === layer.path;
              } else {
                matched = candidate.tagName.toLowerCase() === layer.tagName &&
                  normalizeVisibleText(candidate.visibleText) === layer.text;
              }
              if (matched) matchCount++;
            }
            if (matchCount > 1 && fingerprint.indexAmongMatches === undefined) {
              return 'ambiguous';
            }
          }
          return 'not-found';
        }

        const descriptors = forms.map(describeElement);
        const resolved = resolveElementFingerprint(fingerprint, descriptors);
        if (!resolved) return { matched: false, failureReason: getFailureReason(descriptors) };

        const form = forms[resolved.index];
        if (!(form instanceof HTMLFormElement)) return { matched: false, failureReason: 'not-found' };

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
