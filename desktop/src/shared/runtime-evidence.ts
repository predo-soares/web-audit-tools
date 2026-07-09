import type { PaneId } from './types'

export const CONSOLE_EVIDENCE_CAP = 300
export const NETWORK_EVIDENCE_CAP = 150
export const DIAGNOSTICS_DRAWER_WIDTH_PX = 320
export const DIAGNOSTICS_DRAWER_MIN_WIDTH_PX = 240
export const DIAGNOSTICS_DRAWER_MAX_WIDTH_PX = 600

export function clampDiagnosticsDrawerWidth(width: number): number {
  return Math.round(
    Math.min(
      DIAGNOSTICS_DRAWER_MAX_WIDTH_PX,
      Math.max(DIAGNOSTICS_DRAWER_MIN_WIDTH_PX, width)
    )
  )
}

export type RuntimeEvidenceChannel = 'console' | 'network'

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

export interface NetworkEvidenceEntry {
  id: string
  timestamp: number
  method: string
  url: string
  path: string
  status?: number
  durationMs?: number
  failed: boolean
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
}

export interface RuntimeEvidenceSnapshot {
  paneId: PaneId
  console: ConsoleEvidenceEntry[]
  network: NetworkEvidenceEntry[]
  problemCount: number
}

export function isConsoleProblem(level: ConsoleEvidenceLevel): boolean {
  return level === 'error' || level === 'warn' || level === 'exception' || level === 'rejection'
}

export function isNetworkProblem(entry: Pick<NetworkEvidenceEntry, 'failed' | 'status'>): boolean {
  return entry.failed || (entry.status !== undefined && entry.status >= 400)
}

export function countConsoleProblems(entries: readonly { level: ConsoleEvidenceLevel }[]): number {
  return entries.filter((entry) => isConsoleProblem(entry.level)).length
}

export function countNetworkProblems(
  entries: readonly Pick<NetworkEvidenceEntry, 'failed' | 'status'>[]
): number {
  return entries.filter((entry) => isNetworkProblem(entry)).length
}

export function selectPreferredDiagnosticsTab(
  snapshot: Pick<RuntimeEvidenceSnapshot, 'console' | 'network'>
): RuntimeEvidenceChannel {
  const consoleProblems = countConsoleProblems(snapshot.console)
  const networkProblems = countNetworkProblems(snapshot.network)
  return networkProblems > consoleProblems ? 'network' : 'console'
}
