import { describe, expect, it } from 'vitest'
import { selectPreferredDiagnosticsTab } from '../../src/shared/runtime-evidence'

describe('selectPreferredDiagnosticsTab', () => {
  it('prefers network when it has more problems', () => {
    expect(
      selectPreferredDiagnosticsTab({
        console: [{ level: 'error' }],
        network: [{ failed: true }, { status: 404 }]
      })
    ).toBe('network')
  })

  it('prefers console on a tie', () => {
    expect(
      selectPreferredDiagnosticsTab({
        console: [{ level: 'warn' }],
        network: [{ status: 404 }]
      })
    ).toBe('console')
  })
})
