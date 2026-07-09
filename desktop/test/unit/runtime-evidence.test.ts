import { describe, expect, it } from 'vitest'
import {
  clampDiagnosticsDrawerWidth,
  DIAGNOSTICS_DRAWER_MAX_WIDTH_PX,
  DIAGNOSTICS_DRAWER_MIN_WIDTH_PX,
  selectPreferredDiagnosticsTab
} from '../../src/shared/runtime-evidence'

describe('clampDiagnosticsDrawerWidth', () => {
  it('clamps values to the configured range', () => {
    expect(clampDiagnosticsDrawerWidth(100)).toBe(DIAGNOSTICS_DRAWER_MIN_WIDTH_PX)
    expect(clampDiagnosticsDrawerWidth(999)).toBe(DIAGNOSTICS_DRAWER_MAX_WIDTH_PX)
    expect(clampDiagnosticsDrawerWidth(360.4)).toBe(360)
  })
})

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
