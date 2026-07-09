import { describe, expect, it, vi } from 'vitest'
import { captureSnapshot } from '../../src/main/snapshot-service'
import type { SnapshotPort, SnapshotDeps } from '../../src/main/snapshot-service'
import type { RuntimeEvidenceSnapshot } from '../../src/shared/runtime-evidence'
import type { PaneId } from '../../src/shared/types'
import type { DevContext } from '../../src/shared/dev-context'

const FIXED_PNG = Buffer.from('fake-png')
const FIXED_DATE = new Date('2026-07-09T04:43:00.000Z')
const FIXED_NAV_TS = new Date('2026-07-09T04:42:00.000Z').getTime()

function makeEvidence(overrides?: Partial<RuntimeEvidenceSnapshot>): RuntimeEvidenceSnapshot {
  return {
    paneId: 'iphone',
    console: [],
    network: [],
    problemCount: 0,
    ...overrides
  }
}

function makePort(overrides?: Partial<SnapshotPort>): SnapshotPort {
  return {
    isAnyPaneLoading: () => false,
    getActivePaneId: (): PaneId => 'iphone',
    getActivePaneUrl: () => 'http://localhost:3000',
    getActivePaneTitle: () => 'My App',
    getLastNavTimestamp: () => FIXED_NAV_TS,
    getRuntimeEvidenceSnapshot: () => makeEvidence(),
    captureActivePaneScreenshot: () => Promise.resolve(FIXED_PNG),
    getDevContext: () => null,
    ...overrides
  }
}

function makeDeps(overrides?: Partial<SnapshotDeps>): SnapshotDeps & {
  writeMdCalls: Array<{ path: string; data: string }>
  writePngCalls: Array<{ path: string; data: Buffer }>
  clipboardTexts: string[]
  mkdirCalls: string[]
} {
  const writeMdCalls: Array<{ path: string; data: string }> = []
  const writePngCalls: Array<{ path: string; data: Buffer }> = []
  const clipboardTexts: string[] = []
  const mkdirCalls: string[] = []

  return {
    writeMdCalls,
    writePngCalls,
    clipboardTexts,
    mkdirCalls,
    nowMs: () => FIXED_DATE.getTime(),
    wait: vi.fn().mockResolvedValue(undefined),
    writeClipboard: (text) => clipboardTexts.push(text),
    mkdirBundle: (path) => { mkdirCalls.push(path); return Promise.resolve() },
    writePng: (path, data) => { writePngCalls.push({ path, data }); return Promise.resolve() },
    writeMd: (path, data) => { writeMdCalls.push({ path, data }); return Promise.resolve() },
    ...overrides
  }
}

describe('captureSnapshot', () => {
  it('returns ok: false, reason: no-url when active pane has no committed URL', async () => {
    const port = makePort({ getActivePaneUrl: () => null })
    const deps = makeDeps()
    const result = await captureSnapshot(port, deps)
    expect(result).toEqual({ ok: false, reason: 'no-url' })
    expect(deps.writeMdCalls).toHaveLength(0)
  })

  it('returns ok: false, reason: no-url for about:blank URL', async () => {
    const port = makePort({ getActivePaneUrl: () => 'about:blank' })
    const result = await captureSnapshot(port, makeDeps())
    expect(result).toEqual({ ok: false, reason: 'no-url' })
  })

  it('returns ok: true, warningCount: 0 on a clean capture', async () => {
    const result = await captureSnapshot(makePort(), makeDeps())
    expect(result).toEqual({ ok: true, warningCount: 0 })
  })

  it('returns ok: true, warningCount: 1 when pane is still loading at timeout', async () => {
    const port = makePort({ isAnyPaneLoading: () => true })
    // Advance the clock past the 2s ceiling on the first wait so the loop exits immediately
    let tick = FIXED_DATE.getTime()
    const deps = makeDeps({
      nowMs: () => { const t = tick; tick += 2001; return t },
    })
    const result = await captureSnapshot(port, deps)
    expect(result).toEqual({ ok: true, warningCount: 1 })
  })

  it('does not call wait when panes are already settled', async () => {
    const deps = makeDeps()
    await captureSnapshot(makePort(), deps)
    expect(deps.wait).not.toHaveBeenCalled()
  })

  it('polls wait until panes settle before the ceiling', async () => {
    let callCount = 0
    const port = makePort({
      isAnyPaneLoading: () => { callCount++; return callCount < 3 }
    })
    const deps = makeDeps()
    const result = await captureSnapshot(port, deps)
    expect(result).toEqual({ ok: true, warningCount: 0 })
    expect(deps.wait).toHaveBeenCalledTimes(2)
  })

  it('writes context.md with correct structure', async () => {
    const deps = makeDeps()
    await captureSnapshot(makePort(), deps)

    const { data } = deps.writeMdCalls[0]
    expect(data).toContain('# Audit Screens Capture')
    expect(data).toContain('Captured: 2026-07-09T04:43:00.000Z')
    expect(data).toContain('## Project Context')
    expect(data).toContain('## Active Pane: iPhone 16 Pro (393x852 @3x, touch)')
    expect(data).toContain('URL: http://localhost:3000')
    expect(data).toContain('Title: My App')
    expect(data).toContain('Last navigation: 2026-07-09T04:42:00.000Z')
    expect(data).toContain('Screenshot: ./iphone-16-pro.png')
    expect(data).toContain('### Console problems (0)')
    expect(data).toContain('### Network failures (0)')
  })

  it('writes Local project: not detected when URL is not localhost', async () => {
    const port = makePort({
      getActivePaneUrl: () => 'https://example.com',
      getDevContext: () => ({ repoPath: '/home/user/project', branch: 'main', commit: 'abc1234', dirty: false })
    })
    const deps = makeDeps()
    await captureSnapshot(port, deps)

    const { data } = deps.writeMdCalls[0]
    expect(data).toContain('Local project: not detected')
    expect(data).not.toContain('Branch:')
  })

  it('writes Local project: not detected when dev context is null even on localhost', async () => {
    const port = makePort({ getDevContext: () => null })
    const deps = makeDeps()
    await captureSnapshot(port, deps)

    const { data } = deps.writeMdCalls[0]
    expect(data).toContain('Local project: not detected')
  })

  it('writes project context when URL is localhost and dev context is available', async () => {
    const devCtx: DevContext = {
      repoPath: '/Users/user/my-project',
      branch: 'feature/thing',
      commit: 'deadbeef1234',
      dirty: true
    }
    const port = makePort({ getDevContext: () => devCtx })
    const deps = makeDeps()
    await captureSnapshot(port, deps)

    const { data } = deps.writeMdCalls[0]
    expect(data).toContain('Local project: my-project (/Users/user/my-project)')
    expect(data).toContain('Branch: feature/thing | Commit: deadbee | Dirty: yes')
  })

  it('shows dirty: no when working tree is clean', async () => {
    const devCtx: DevContext = {
      repoPath: '/Users/user/project',
      branch: 'main',
      commit: 'abc1234',
      dirty: false
    }
    const port = makePort({ getDevContext: () => devCtx })
    const deps = makeDeps()
    await captureSnapshot(port, deps)

    expect(deps.writeMdCalls[0].data).toContain('Dirty: no')
  })

  it('shows (detached) for branch when in detached HEAD state', async () => {
    const devCtx: DevContext = {
      repoPath: '/Users/user/project',
      branch: null,
      commit: 'cafebabe',
      dirty: false
    }
    const port = makePort({ getDevContext: () => devCtx })
    const deps = makeDeps()
    await captureSnapshot(port, deps)

    expect(deps.writeMdCalls[0].data).toContain('Branch: (detached)')
  })

  it('filters console output to problem-level entries only', async () => {
    const evidence = makeEvidence({
      console: [
        { id: '1', timestamp: 1, level: 'log', message: 'noise' },
        { id: '2', timestamp: 2, level: 'info', message: 'info' },
        { id: '3', timestamp: 3, level: 'warn', message: 'a warning' },
        { id: '4', timestamp: 4, level: 'error', message: 'an error' },
        { id: '5', timestamp: 5, level: 'exception', message: 'an exception' },
        { id: '6', timestamp: 6, level: 'rejection', message: 'a rejection' }
      ],
      network: [],
      problemCount: 4
    })
    const port = makePort({ getRuntimeEvidenceSnapshot: () => evidence })
    const deps = makeDeps()
    await captureSnapshot(port, deps)

    const { data } = deps.writeMdCalls[0]
    expect(data).toContain('### Console problems (4)')
    expect(data).toContain('[WARN] a warning')
    expect(data).toContain('[ERROR] an error')
    expect(data).toContain('[EXCEPTION] an exception')
    expect(data).toContain('[REJECTION] a rejection')
    expect(data).not.toContain('noise')
    expect(data).not.toContain('[INFO]')
    expect(data).not.toContain('[LOG]')
  })

  it('includes source location for console entries with sourceUrl and line', async () => {
    const evidence = makeEvidence({
      console: [
        {
          id: '1',
          timestamp: 1,
          level: 'error',
          message: 'oops',
          sourceUrl: 'http://localhost:3000/app.js',
          line: 42
        }
      ],
      network: [],
      problemCount: 1
    })
    const port = makePort({ getRuntimeEvidenceSnapshot: () => evidence })
    const deps = makeDeps()
    await captureSnapshot(port, deps)

    expect(deps.writeMdCalls[0].data).toContain('    at http://localhost:3000/app.js:42')
  })

  it('caps console problems at 100 latest entries', async () => {
    const entries = Array.from({ length: 120 }, (_, i) => ({
      id: `e-${i}`,
      timestamp: i,
      level: 'error' as const,
      message: `error-${i}`
    }))
    const evidence = makeEvidence({ console: entries, network: [], problemCount: 120 })
    const port = makePort({ getRuntimeEvidenceSnapshot: () => evidence })
    const deps = makeDeps()
    await captureSnapshot(port, deps)

    const { data } = deps.writeMdCalls[0]
    expect(data).toContain('### Console problems (100)')
    expect(data).not.toContain('error-0')
    expect(data).toContain('error-20')
    expect(data).toContain('error-119')
  })

  it('filters network output to failed requests only', async () => {
    const evidence = makeEvidence({
      console: [],
      network: [
        { id: '1', timestamp: 1, method: 'GET', url: 'http://localhost/ok', path: '/ok', status: 200, failed: false },
        { id: '2', timestamp: 2, method: 'GET', url: 'http://localhost/missing', path: '/missing', status: 404, failed: true },
        { id: '3', timestamp: 3, method: 'POST', url: 'http://localhost/fail', path: '/fail', failed: true }
      ],
      problemCount: 2
    })
    const port = makePort({ getRuntimeEvidenceSnapshot: () => evidence })
    const deps = makeDeps()
    await captureSnapshot(port, deps)

    const { data } = deps.writeMdCalls[0]
    expect(data).toContain('### Network failures (2)')
    expect(data).toContain('GET /missing → 404 Not Found')
    expect(data).toContain('POST /fail')
    expect(data).not.toContain('/ok')
  })

  it('writes screenshot PNG with device slug filename', async () => {
    const deps = makeDeps()
    await captureSnapshot(makePort(), deps)

    const { path, data } = deps.writePngCalls[0]
    expect(path).toMatch(/iphone-16-pro\.png$/)
    expect(data).toEqual(FIXED_PNG)
  })

  it('writes context.md at the correct bundle path with timestamp', async () => {
    const deps = makeDeps()
    await captureSnapshot(makePort(), deps)

    const { path } = deps.writeMdCalls[0]
    expect(path).toMatch(/\.audit-screens[/\\]captures[/\\]2026-07-09T04-43-00-000Z[/\\]context\.md$/)
  })

  it('creates the bundle directory with correct timestamp format', async () => {
    const deps = makeDeps()
    await captureSnapshot(makePort(), deps)

    expect(deps.mkdirCalls[0]).toMatch(/2026-07-09T04-43-00-000Z$/)
  })

  it('writes the agent handoff prompt to the clipboard', async () => {
    const deps = makeDeps()
    await captureSnapshot(makePort(), deps)

    expect(deps.clipboardTexts[0]).toBe(
      'Read this audit-screens capture and use it to diagnose the issue I am seeing:\n~/.audit-screens/captures/2026-07-09T04-43-00-000Z/context.md'
    )
  })

  it('returns ok: false when screenshot capture throws', async () => {
    const port = makePort({
      captureActivePaneScreenshot: () => Promise.reject(new Error('capture error'))
    })
    const result = await captureSnapshot(port, makeDeps())
    expect(result).toEqual({ ok: false, reason: 'screenshot-failed: Error: capture error' })
  })

  it('returns ok: false when bundle write fails', async () => {
    const deps = makeDeps({
      mkdirBundle: () => Promise.reject(new Error('disk full'))
    })
    const result = await captureSnapshot(makePort(), deps)
    expect(result).toEqual({ ok: false, reason: 'write-failed: Error: disk full' })
  })

  it('uses desktop device preset when active pane ID is null', async () => {
    const port = makePort({
      getActivePaneId: () => null,
      getActivePaneUrl: () => 'http://localhost:3000'
    })
    const deps = makeDeps()
    await captureSnapshot(port, deps)

    const { data } = deps.writeMdCalls[0]
    expect(data).toContain('## Active Pane: Desktop')
    expect(deps.writePngCalls[0].path).toMatch(/desktop\.png$/)
  })
})
