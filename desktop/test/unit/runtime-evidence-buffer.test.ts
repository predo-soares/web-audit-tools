import { describe, expect, it } from 'vitest'
import { createRuntimeEvidenceBuffer } from '../../src/main/runtime-evidence-buffer'

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
    buffer.clearConsole()

    expect(buffer.getConsole()).toEqual([])
    expect(buffer.getConsoleProblemCount()).toBe(0)
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
      problemCount: 1
    })

    buffer.pushConsole({ level: 'log', message: 'after' })
    expect(snapshot.console).toHaveLength(1)
    expect(buffer.getConsole()).toHaveLength(2)
  })
})
