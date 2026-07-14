import { describe, expect, it } from 'vitest'
import { createRuntimeEvidenceBuffer } from '../../src/main/evidence/runtime-evidence-buffer'

describe('runtime evidence buffer', () => {
  it('evicts the oldest console entry when the cap is exceeded', () => {
    const buffer = createRuntimeEvidenceBuffer({
      consoleCap: 3,
      now: () => 1000,
      createId: (() => {
        let n = 0
        return () => `id-${++n}`
      })()
    })

    buffer.pushConsole({ level: 'log', message: 'one' })
    buffer.pushConsole({ level: 'log', message: 'two' })
    buffer.pushConsole({ level: 'log', message: 'three' })
    buffer.pushConsole({ level: 'log', message: 'four' })

    expect(buffer.getConsole().map((entry) => entry.message)).toEqual(['two', 'three', 'four'])
  })

  it('counts console problems for error, warn, exception, and rejection', () => {
    const buffer = createRuntimeEvidenceBuffer()

    buffer.pushConsole({ level: 'log', message: 'noise' })
    buffer.pushConsole({ level: 'info', message: 'info' })
    buffer.pushConsole({ level: 'warn', message: 'warn' })
    buffer.pushConsole({ level: 'error', message: 'error' })
    buffer.pushConsole({ level: 'exception', message: 'exception' })
    buffer.pushConsole({ level: 'rejection', message: 'rejection' })

    expect(buffer.getConsoleProblemCount()).toBe(4)
  })

  it('clears only the console channel', () => {
    const buffer = createRuntimeEvidenceBuffer()

    buffer.pushConsole({ level: 'error', message: 'before' })
    buffer.pushNetwork({
      method: 'GET',
      url: 'http://localhost/ok',
      path: '/ok',
      status: 200,
      failed: false
    })
    buffer.clearConsole()

    expect(buffer.getConsole()).toEqual([])
    expect(buffer.getConsoleProblemCount()).toBe(0)
    expect(buffer.getNetwork()).toHaveLength(1)
  })

  it('evicts the oldest network entry when the cap is exceeded', () => {
    const buffer = createRuntimeEvidenceBuffer({
      networkCap: 2,
      now: () => 1000
    })

    buffer.pushNetwork({ method: 'GET', url: 'http://localhost/one', path: '/one', failed: false })
    buffer.pushNetwork({ method: 'GET', url: 'http://localhost/two', path: '/two', failed: false })
    buffer.pushNetwork({
      method: 'GET',
      url: 'http://localhost/three',
      path: '/three',
      failed: false
    })

    expect(buffer.getNetwork().map((entry) => entry.path)).toEqual(['/two', '/three'])
  })

  it('counts network problems for failures and HTTP status >= 400', () => {
    const buffer = createRuntimeEvidenceBuffer()

    buffer.pushNetwork({
      method: 'GET',
      url: 'http://localhost/ok',
      path: '/ok',
      status: 200,
      failed: false
    })
    buffer.pushNetwork({
      method: 'GET',
      url: 'http://localhost/missing',
      path: '/missing',
      status: 404,
      failed: true
    })
    buffer.pushNetwork({ method: 'GET', url: 'http://localhost/fail', path: '/fail', failed: true })

    expect(buffer.getNetworkProblemCount()).toBe(2)
  })

  it('aggregates console and network problems in snapshot problemCount', () => {
    const buffer = createRuntimeEvidenceBuffer()

    buffer.pushConsole({ level: 'warn', message: 'warn' })
    buffer.pushNetwork({
      method: 'GET',
      url: 'http://localhost/missing',
      path: '/missing',
      status: 404,
      failed: true
    })

    expect(buffer.snapshot('desktop').problemCount).toBe(2)
  })

  it('keeps the console problem count correct when a problem entry is evicted at the cap', () => {
    const buffer = createRuntimeEvidenceBuffer({ consoleCap: 2 })

    buffer.pushConsole({ level: 'error', message: 'oldest problem' })
    buffer.pushConsole({ level: 'log', message: 'noise' })
    expect(buffer.getConsoleProblemCount()).toBe(1)

    buffer.pushConsole({ level: 'log', message: 'evicts the error' })
    expect(buffer.getConsoleProblemCount()).toBe(0)

    buffer.pushConsole({ level: 'warn', message: 'new problem evicting noise' })
    expect(buffer.getConsoleProblemCount()).toBe(1)
  })

  it('keeps the network problem count correct when a problem entry is evicted at the cap', () => {
    const buffer = createRuntimeEvidenceBuffer({ networkCap: 2 })

    buffer.pushNetwork({
      method: 'GET',
      url: 'http://localhost/missing',
      path: '/missing',
      status: 404,
      failed: true
    })
    buffer.pushNetwork({
      method: 'GET',
      url: 'http://localhost/ok',
      path: '/ok',
      status: 200,
      failed: false
    })
    expect(buffer.getNetworkProblemCount()).toBe(1)

    buffer.pushNetwork({
      method: 'GET',
      url: 'http://localhost/ok2',
      path: '/ok2',
      status: 200,
      failed: false
    })
    expect(buffer.getNetworkProblemCount()).toBe(0)

    buffer.pushNetwork({ method: 'GET', url: 'http://localhost/fail', path: '/fail', failed: true })
    expect(buffer.getNetworkProblemCount()).toBe(1)
  })

  it('returns an immutable snapshot for a pane', () => {
    const buffer = createRuntimeEvidenceBuffer({ now: () => 42 })

    buffer.pushConsole({ level: 'error', message: 'snap' })
    const snapshot = buffer.snapshot('iphone')

    expect(snapshot).toEqual({
      paneId: 'iphone',
      console: [
        expect.objectContaining({
          level: 'error',
          message: 'snap',
          timestamp: 42
        })
      ],
      network: [],
      problemCount: 1
    })

    buffer.pushConsole({ level: 'log', message: 'after' })
    expect(snapshot.console).toHaveLength(1)
    expect(buffer.getConsole()).toHaveLength(2)
  })
})
