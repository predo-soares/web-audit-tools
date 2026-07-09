import type { PaneId } from './types'

export const CONSOLE_EVIDENCE_CAP = 300
export const NETWORK_EVIDENCE_CAP = 150
export const DIAGNOSTICS_DRAWER_WIDTH_PX = 320

export type ConsoleEvidenceLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'log'
  | 'debug'
  | 'exception'
  | 'rejection'

export interface ConsoleEvidenceEntry {
  id: string
  timestamp: number
  level: ConsoleEvidenceLevel
  message: string
  sourceUrl?: string
  line?: number
  column?: number
  stack?: string
}

export interface RuntimeEvidenceSnapshot {
  paneId: PaneId
  console: ConsoleEvidenceEntry[]
  problemCount: number
}

export function isConsoleProblem(level: ConsoleEvidenceLevel): boolean {
  return level === 'error' || level === 'warn' || level === 'exception' || level === 'rejection'
}
