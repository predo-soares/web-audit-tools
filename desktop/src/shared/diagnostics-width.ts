import {
  clampDiagnosticsDrawerWidth,
  DIAGNOSTICS_DRAWER_WIDTH_PX
} from './runtime-evidence'

export const DIAGNOSTICS_WIDTH_STORAGE_KEY = 'audit-screens-diagnostics-width'

export function readStoredDiagnosticsWidth(): number {
  const stored = window.localStorage.getItem(DIAGNOSTICS_WIDTH_STORAGE_KEY)
  if (!stored) return DIAGNOSTICS_DRAWER_WIDTH_PX

  const parsed = Number(stored)
  if (!Number.isFinite(parsed)) return DIAGNOSTICS_DRAWER_WIDTH_PX

  return clampDiagnosticsDrawerWidth(parsed)
}

export function writeStoredDiagnosticsWidth(width: number): void {
  window.localStorage.setItem(
    DIAGNOSTICS_WIDTH_STORAGE_KEY,
    String(clampDiagnosticsDrawerWidth(width))
  )
}
