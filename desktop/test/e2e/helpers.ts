import { spawn, execFileSync, type ChildProcess } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import electronPath from 'electron'
import { chromium, type Browser, type Page } from '@playwright/test'
import type { PaneId } from '../../src/shared/types'

interface LaunchedApp {
  window: Page
  userDataDir: string
  close: () => Promise<void>
}

// On macOS, if a previous instance crashed (or was SIGKILLed by a test run),
// AppKit shows a modal "reopen windows?" prompt before the app finishes
// launching — app.whenReady() never resolves and CDP lists zero targets.
// The harness passes -ApplePersistenceIgnoreState YES on the Electron CLI; this
// defaults write is a belt-and-suspenders fallback for the dev binary bundle id.
function suppressMacRestorePrompt(): void {
  if (process.platform !== 'darwin') return
  try {
    execFileSync('defaults', [
      'write',
      'com.github.Electron',
      'ApplePersistenceIgnoreState',
      'YES'
    ])
  } catch {
    // Best effort — worth a warning but not a test failure.
    console.warn('Could not set ApplePersistenceIgnoreState for com.github.Electron')
  }
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

export async function getOverlayPage(window: Page): Promise<Page> {
  const context = window.context()
  const started = Date.now()
  while (Date.now() - started < 10_000) {
    const overlay = context.pages().find((page) => page.url().includes('overlay.html'))
    if (overlay) {
      await overlay.waitForLoadState('domcontentloaded')
      return overlay
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(
    `Overlay page not found. Pages: ${context.pages().map((page) => page.url()).join(', ')}`
  )
}

export async function launchApp(existingUserDataDir?: string): Promise<LaunchedApp> {
  suppressMacRestorePrompt()

  const port = 9400 + Math.floor(Math.random() * 200)
  const cwd = join(__dirname, '../..')
  const ownsUserDataDir = existingUserDataDir === undefined
  const userDataDir =
    existingUserDataDir ?? mkdtempSync(join(tmpdir(), 'audit-screens-e2e-'))

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

  const electronProcess: ChildProcess = spawn(
    electronPath as unknown as string,
    electronArgs,
    { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] }
  )

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

  const close = async (): Promise<void> => {
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
    if (ownsUserDataDir) {
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
    await window.getByTestId('url-input').waitFor({ state: 'visible', timeout: 15_000 })

    return { window, userDataDir, close }
  } catch (error) {
    await close()
    throw error
  }
}

export async function navigateTo(window: Page, address: string): Promise<void> {
  await window.getByTestId('url-input').fill(address)
  await window.getByTestId('url-submit').click()
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

export function fixtureUrl(port: number, path: string): string {
  return `http://127.0.0.1:${port}${path}`
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
      const found = await evaluateInPane<boolean>(window, paneId, `!!document.getElementById('${elementId}')`)
      if (found) return
    } catch {
      // JS context may be transitioning between navigations.
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`#${elementId} not found in pane ${paneId} after ${timeoutMs}ms`)
}
