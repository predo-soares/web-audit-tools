import { spawn, execFileSync, type ChildProcess } from 'child_process'
import { createServer } from 'net'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import electronPath from 'electron'
import { chromium, expect, type Browser, type Page } from '@playwright/test'
import type { MirrorFailureLog } from '../../src/shared/element-mirror'
import type { PaneId } from '../../src/shared/types'

interface LaunchedApp {
  window: Page
  userDataDir: string
  close: (options?: { deleteUserData?: boolean }) => Promise<void>
}

// On macOS, if a previous instance crashed (or was SIGKILLed by a test run),
// AppKit shows a modal "reopen windows?" prompt before the app finishes
// launching — app.whenReady() never resolves and CDP lists zero targets.
// The harness passes -ApplePersistenceIgnoreState YES on the Electron CLI; this
// defaults write is a belt-and-suspenders fallback for the dev binary bundle id.
function suppressMacRestorePrompt(): void {
  if (process.platform !== 'darwin') return
  try {
    execFileSync('defaults', ['write', 'com.github.Electron', 'ApplePersistenceIgnoreState', 'YES'])
  } catch {
    // Best effort — worth a warning but not a test failure.
    console.warn('Could not set ApplePersistenceIgnoreState for com.github.Electron')
  }
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a free debug port')))
        return
      }
      const port = address.port
      server.close((error) => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })
}

// Waiting on /json/version is not enough: the DevTools HTTP server comes up
// long before the app is ready, and a page target only exists once a window
// has actually been created. Wait for the renderer window's target directly.
async function waitForRendererTarget(
  port: number,
  timeoutMs: number,
  getDiagnostics: () => string
): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      if (response.ok) {
        const targets = (await response.json()) as Array<{ type: string; url: string }>
        if (targets.some((t) => t.type === 'page' && t.url.includes('index.html'))) return
      }
    } catch {
      // Debugger not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(
    `Timed out waiting for renderer target on port ${port}.\n--- electron output ---\n${getDiagnostics()}`
  )
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve(true)
    const timer = setTimeout(() => resolve(false), timeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

export async function getToolbarPage(window: Page): Promise<Page> {
  const context = window.context()
  const started = Date.now()
  while (Date.now() - started < 10_000) {
    for (const page of context.pages()) {
      if (!page.url().includes('overlay.html')) continue
      if ((await page.getByTestId('toolbar').count()) > 0) {
        await page.waitForLoadState('domcontentloaded')
        return page
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(
    `Toolbar overlay page not found. Pages: ${context
      .pages()
      .map((page) => page.url())
      .join(', ')}`
  )
}

export async function getOverlayPage(window: Page): Promise<Page> {
  return getPopoverOverlayPage(window)
}

export async function getPopoverOverlayPage(window: Page): Promise<Page> {
  const context = window.context()
  const started = Date.now()
  while (Date.now() - started < 10_000) {
    for (const page of context.pages()) {
      if (!page.url().includes('overlay.html')) continue
      if ((await page.getByTestId('toolbar-custom-popover').count()) > 0) {
        await page.waitForLoadState('domcontentloaded')
        return page
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(
    `Popover overlay page not found. Pages: ${context
      .pages()
      .map((page) => page.url())
      .join(', ')}`
  )
}

export async function getDiagnosticsDrawerPage(window: Page): Promise<Page> {
  const context = window.context()
  const started = Date.now()
  while (Date.now() - started < 10_000) {
    for (const page of context.pages()) {
      if (!page.url().includes('overlay.html')) continue
      if ((await page.getByTestId('diagnostics-drawer').count()) > 0) {
        await page.waitForLoadState('domcontentloaded')
        return page
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(
    `Diagnostics drawer overlay page not found. Pages: ${context
      .pages()
      .map((page) => page.url())
      .join(', ')}`
  )
}

export async function getSeoPanelPage(window: Page): Promise<Page> {
  const context = window.context()
  const started = Date.now()
  while (Date.now() - started < 10_000) {
    for (const page of context.pages()) {
      if (!page.url().includes('overlay.html')) continue
      if ((await page.getByTestId('seo-panel').count()) > 0) {
        await page.waitForLoadState('domcontentloaded')
        return page
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(
    `SEO panel overlay page not found. Pages: ${context
      .pages()
      .map((page) => page.url())
      .join(', ')}`
  )
}

/**
 * Open the SEO workspace and return the main window page (the SEO view renders
 * in the main window, not an overlay). The sidebar is open by default, so this
 * clicks its "SEO" nav entry, which toggles the workspace to `seo`.
 */
export async function openSeoView(window: Page): Promise<Page> {
  const sidebar = await getSidebarPage(window)
  await sidebar.getByTestId('sidebar-seo-view').click()
  await expect(window.getByTestId('seo-view')).toBeVisible()
  return window
}

/**
 * Toggle the SEO workspace closed then open again (the main-process audit job
 * outlives the view). Returns the main window page.
 */
export async function reopenSeoView(window: Page): Promise<Page> {
  const sidebar = await getSidebarPage(window)
  await sidebar.getByTestId('sidebar-seo-view').click() // back to browser
  await expect(window.getByTestId('seo-view')).toHaveCount(0)
  await sidebar.getByTestId('sidebar-seo-view').click() // re-enter SEO
  await expect(window.getByTestId('seo-view')).toBeVisible()
  return window
}

export async function getSidebarPage(window: Page): Promise<Page> {
  const context = window.context()
  const started = Date.now()
  while (Date.now() - started < 10_000) {
    for (const page of context.pages()) {
      if (!page.url().includes('overlay.html')) continue
      if ((await page.getByTestId('sidebar').count()) > 0) {
        await page.waitForLoadState('domcontentloaded')
        return page
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(
    `Sidebar overlay page not found. Pages: ${context
      .pages()
      .map((page) => page.url())
      .join(', ')}`
  )
}

export async function getShortcutsPage(window: Page): Promise<Page> {
  const context = window.context()
  const started = Date.now()
  while (Date.now() - started < 10_000) {
    for (const page of context.pages()) {
      if (!page.url().includes('overlay.html')) continue
      if ((await page.getByTestId('shortcuts-dialog').count()) > 0) {
        await page.waitForLoadState('domcontentloaded')
        return page
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Keyboard shortcuts modal overlay page not found')
}

export async function launchApp(existingUserDataDir?: string): Promise<LaunchedApp> {
  suppressMacRestorePrompt()

  const port = await getFreePort()
  const cwd = join(__dirname, '../..')
  const ownsUserDataDir = existingUserDataDir === undefined
  const userDataDir = existingUserDataDir ?? mkdtempSync(join(tmpdir(), 'audit-screens-e2e-'))

  const env = {
    ...process.env,
    E2E_TEST: '1',
    NODE_ENV: 'production',
    E2E_USER_DATA_DIR: userDataDir
  }
  delete env.ELECTRON_RUN_AS_NODE

  const electronArgs = ['.', `--remote-debugging-port=${port}`]
  if (process.platform === 'darwin') {
    electronArgs.push('-ApplePersistenceIgnoreState', 'YES')
  }

  const electronProcess: ChildProcess = spawn(electronPath as unknown as string, electronArgs, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  // Keep the pipes drained (an undrained pipe can block the child) and keep
  // the output around so launch failures are diagnosable instead of a generic
  // "renderer window not found".
  let output = ''
  const capture = (chunk: Buffer): void => {
    output += chunk.toString()
    if (output.length > 100_000) output = output.slice(-50_000)
  }
  electronProcess.stdout?.on('data', capture)
  electronProcess.stderr?.on('data', capture)

  const earlyExit = new Promise<never>((_, reject) => {
    electronProcess.once('exit', (code, signal) => {
      reject(
        new Error(
          `Electron exited during startup (code=${code}, signal=${signal}).\n--- electron output ---\n${output}`
        )
      )
    })
  })

  let browser: Browser | null = null

  const close = async (options?: { deleteUserData?: boolean }): Promise<void> => {
    electronProcess.removeAllListeners('exit')
    await browser?.close().catch(() => {})
    browser = null
    // SIGTERM alone is not enough: instances stuck before ready survive it and
    // linger holding the debug port, breaking later runs. Escalate to SIGKILL.
    if (electronProcess.exitCode === null && electronProcess.signalCode === null) {
      electronProcess.kill('SIGTERM')
      if (!(await waitForExit(electronProcess, 5_000))) {
        electronProcess.kill('SIGKILL')
        await waitForExit(electronProcess, 5_000)
      }
    }
    if (ownsUserDataDir && options?.deleteUserData !== false) {
      rmSync(userDataDir, { recursive: true, force: true })
    }
  }

  try {
    await Promise.race([waitForRendererTarget(port, 30_000, () => output), earlyExit])

    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    const context = browser.contexts()[0] ?? (await browser.newContext())
    const window = context.pages().find((page) => page.url().includes('index.html'))
    if (!window) {
      throw new Error(
        `Renderer window not found among CDP pages: ${context
          .pages()
          .map((p) => p.url())
          .join(', ')}`
      )
    }

    await window.waitForLoadState('domcontentloaded')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('url-input').waitFor({ state: 'visible', timeout: 15_000 })

    return { window, userDataDir, close }
  } catch (error) {
    await close()
    throw error
  }
}

export async function navigateTo(window: Page, address: string): Promise<void> {
  const toolbar = await getToolbarPage(window)
  const input = toolbar.getByTestId('url-input')
  await input.fill(address)
  await input.press('Enter')
}

export async function launchAppReady(existingUserDataDir?: string): Promise<LaunchedApp> {
  const launched = await launchApp(existingUserDataDir)
  await waitForAllPanes(launched.window)
  return launched
}

export async function navigateToCommitted(window: Page, address: string): Promise<void> {
  await navigateTo(window, address)
  await waitForAllPanes(window)
  const toolbar = await getToolbarPage(window)
  await expect(toolbar.getByTestId('url-input')).toHaveValue(address, { timeout: 30_000 })
  const sidebar = await getSidebarPage(window)
  await expect(sidebar.getByTestId(historyRowTestId(address))).toBeVisible({ timeout: 30_000 })
}

export async function clearHistoryViaApi(window: Page): Promise<void> {
  await window.evaluate(() => window.api.clearHistory())
}

export async function waitForPaneLoad(window: Page, paneId: PaneId): Promise<void> {
  const loading = window.getByTestId(`pane-loading-${paneId}`)
  if (await loading.count()) {
    await loading.waitFor({ state: 'hidden', timeout: 20_000 })
  }
}

export async function waitForAllPanes(window: Page): Promise<void> {
  await waitForPaneLoad(window, 'iphone')
  await waitForPaneLoad(window, 'ipad')
  await waitForPaneLoad(window, 'desktop')
}

export async function focusPane(window: Page, paneId: PaneId): Promise<void> {
  await window.evaluate(
    async ({ paneId }) => {
      await window.api.focusPane(paneId)
    },
    { paneId }
  )
}

export async function evaluateInPane<T>(
  window: Page,
  paneId: PaneId,
  expression: string
): Promise<T> {
  return window.evaluate(
    async ({ paneId, expression }) => window.api.evaluateInPane(paneId, expression),
    { paneId, expression }
  ) as Promise<T>
}

export async function getMirrorFailureLogs(
  window: Page
): Promise<Record<PaneId, MirrorFailureLog[]>> {
  return window.evaluate(() => window.api.getMirrorFailureLogs()) as Promise<
    Record<PaneId, MirrorFailureLog[]>
  >
}

export async function getSyncTraceLogs(
  window: Page
): Promise<Array<{ ts: number; event: string; data?: Record<string, unknown> }>> {
  return window.evaluate(() => window.api.getSyncTraceLogs()) as Promise<
    Array<{ ts: number; event: string; data?: Record<string, unknown> }>
  >
}

export function formatSyncTraceForDiag(
  logs: Array<{ ts: number; event: string; data?: Record<string, unknown> }>
): string {
  return logs
    .map((entry) => `[${entry.event}] ${entry.data ? JSON.stringify(entry.data) : ''}`)
    .join('\n')
}

export function fixtureUrl(port: number, path: string): string {
  return `http://127.0.0.1:${port}${path}`
}

export function historyRowTestId(url: string): string {
  return `history-row-${encodeURIComponent(url)}`
}

export function sidebarToggleShortcut(): string {
  return process.platform === 'darwin' ? 'Meta+b' : 'Control+b'
}

export function diagnosticsToggleShortcut(): string {
  return process.platform === 'darwin' ? 'Meta+j' : 'Control+j'
}

export async function waitForSidebarSettled(window: Page): Promise<void> {
  await window.waitForFunction(() => {
    const state = document.querySelector('[data-testid="sidebar-state"]')
    return state?.getAttribute('data-sidebar-transitioning') === 'false'
  })
}

export async function expectSidebarOpen(window: Page, open: boolean): Promise<void> {
  await waitForSidebarSettled(window)
  await expect(window.getByTestId('sidebar-state')).toHaveAttribute(
    'data-sidebar-open',
    open ? 'true' : 'false'
  )
}

export async function waitForPaneElement(
  window: Page,
  paneId: PaneId,
  elementId: string,
  timeoutMs = 10_000
): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const found = await evaluateInPane<boolean>(
        window,
        paneId,
        `!!document.getElementById('${elementId}')`
      )
      if (found) return
    } catch {
      // JS context may be transitioning between navigations.
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`#${elementId} not found in pane ${paneId} after ${timeoutMs}ms`)
}

/**
 * Select an option from a base-ui Select (combobox) by test id. Native
 * `selectOption()` does not work — these render as a `role="combobox"` button
 * with a portalled `role="listbox"`. In a WebContentsView the popup closes under
 * Playwright's default actionability wait (and the option can render off-screen),
 * so open the listbox and dispatch the click straight to the option node, which
 * reliably fires base-ui's selection handler.
 */
export async function selectComboboxOption(
  page: Page,
  triggerTestId: string,
  optionName: string
): Promise<void> {
  await page.getByTestId(triggerTestId).click()
  const option = page.getByRole('option', { name: optionName, exact: true })
  // Hover keeps the popup open (it closes under the default actionability wait),
  // then a real pointer press commits the selection. Relies on the Select using
  // alignItemWithTrigger={false} so every option renders below the trigger.
  await option.hover()
  await option.click({ force: true })
}
