// One-off debug harness: launches the built app, loads a page, and dumps
// pane metrics + screenshots so we can see what the emulation scale does.
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const { _electron } = await import('playwright')

const userDataDir = mkdtempSync(join(tmpdir(), 'audit-screens-debug-'))
const env = {
  ...process.env,
  E2E_TEST: '1',
  NODE_ENV: 'production',
  E2E_USER_DATA_DIR: userDataDir
}
delete env.ELECTRON_RUN_AS_NODE

const app = await _electron.launch({
  args: ['.', '-ApplePersistenceIgnoreState', 'YES'],
  cwd: process.cwd(),
  env
})

try {
  let window = null
  for (let i = 0; i < 50 && !window; i++) {
    window = app.windows().find((w) => w.url().includes('index.html')) ?? null
    if (!window) await new Promise((r) => setTimeout(r, 300))
  }
  if (!window) throw new Error(`renderer not found: ${app.windows().map((w) => w.url())}`)
  await window.getByTestId('url-input').waitFor({ state: 'visible', timeout: 15000 })

  await window.evaluate(() => window.api.navigate('https://example.com'))
  await new Promise((r) => setTimeout(r, 6000))

  const paneMetrics = await window.evaluate(() =>
    window.api.evaluateInPane(
      'iphone',
      `JSON.stringify({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        dpr: window.devicePixelRatio,
        vvScale: window.visualViewport ? window.visualViewport.scale : null,
        vvWidth: window.visualViewport ? window.visualViewport.width : null,
        bodyText: document.body ? document.body.innerText.slice(0, 60) : null,
        url: location.href
      })`
    )
  )

  const rendererRect = await window.evaluate(() => {
    const el = document.querySelector('[data-testid="pane-surface-iphone"]')
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, width: r.width, height: r.height }
  })

  const mainInfo = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const views = win.contentView.children.map((v) => v.getBounds())
    const winImage = await win.capturePage()
    return {
      winBounds: win.getBounds(),
      views,
      winPng: winImage.toPNG().toString('base64')
    }
  })

  const paneShot = await app.evaluate(async () => {
    const pm = globalThis.__paneManager
    const img = await pm.getEngineView('iphone').webContents.capturePage()
    return img.toPNG().toString('base64')
  })

  writeFileSync('/tmp/audit-window.png', Buffer.from(mainInfo.winPng, 'base64'))
  writeFileSync('/tmp/audit-iphone-pane.png', Buffer.from(paneShot, 'base64'))

  // OS-level screenshot: the only capture that includes composited child views.
  const native = await app.evaluate(
    async ({ BrowserWindow, desktopCapturer, systemPreferences }) => {
      const status = systemPreferences.getMediaAccessStatus('screen')
      if (status !== 'granted') return { status }

      const win = BrowserWindow.getAllWindows()[0]
      win.show()
      await new Promise((r) => setTimeout(r, 800))
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 1440, height: 900 }
      })
      const source = sources.find((s) => s.id === win.getMediaSourceId())
      if (!source) return { status, found: false, ids: sources.map((s) => s.name) }
      return { status, found: true, png: source.thumbnail.toPNG().toString('base64') }
    }
  )

  if (native.png) {
    writeFileSync('/tmp/audit-native.png', Buffer.from(native.png, 'base64'))
    console.log('NATIVE SHOT: /tmp/audit-native.png')
  } else {
    console.log('NATIVE SHOT FAILED:', JSON.stringify({ ...native, png: undefined }))
  }

  console.log('PANE METRICS:', paneMetrics)
  console.log('RENDERER RECT (iphone surface):', JSON.stringify(rendererRect))
  console.log('WINDOW BOUNDS:', JSON.stringify(mainInfo.winBounds))
  console.log('CHILD VIEW BOUNDS:', JSON.stringify(mainInfo.views))
} finally {
  await app.close().catch(() => {})
  rmSync(userDataDir, { recursive: true, force: true })
}
