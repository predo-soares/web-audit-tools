import {
  CONSOLE_EVIDENCE_CAP,
  NETWORK_EVIDENCE_CAP,
  isConsoleProblem,
  isNetworkProblem,
  type ConsoleEvidenceEntry,
  type ConsoleEvidenceLevel,
  type NetworkEvidenceEntry,
  type RuntimeEvidenceSnapshot
} from '../../shared/runtime-evidence'
import type { PaneId } from '../../shared/types'

export interface RuntimeEvidenceBuffer {
  pushConsole(
    entry: Omit<ConsoleEvidenceEntry, 'id' | 'timestamp'> &
      Partial<Pick<ConsoleEvidenceEntry, 'id' | 'timestamp'>>
  ): ConsoleEvidenceEntry
  getConsole(): readonly ConsoleEvidenceEntry[]
  clearConsole(): void
  getConsoleProblemCount(): number
  pushNetwork(
    entry: Omit<NetworkEvidenceEntry, 'id' | 'timestamp' | 'failed'> &
      Partial<Pick<NetworkEvidenceEntry, 'id' | 'timestamp' | 'failed'>>
  ): NetworkEvidenceEntry
  getNetwork(): readonly NetworkEvidenceEntry[]
  clearNetwork(): void
  getNetworkProblemCount(): number
  snapshot(paneId: PaneId): RuntimeEvidenceSnapshot
}

export function createRuntimeEvidenceBuffer(options?: {
  consoleCap?: number
  networkCap?: number
  now?: () => number
  createId?: () => string
}): RuntimeEvidenceBuffer {
  const consoleCap = options?.consoleCap ?? CONSOLE_EVIDENCE_CAP
  const networkCap = options?.networkCap ?? NETWORK_EVIDENCE_CAP
  const now = options?.now ?? (() => Date.now())
  const createId = options?.createId
  let consoleSequence = 0
  let networkSequence = 0

  const consoleEntries: ConsoleEvidenceEntry[] = []
  const networkEntries: NetworkEvidenceEntry[] = []
  // Maintained on push/eviction/clear so problem counts stay O(1) per event.
  // Safe because entries are immutable once pushed (network entries are
  // finalized before push, never mutated after).
  let consoleProblemCount = 0
  let networkProblemCount = 0

  const nextConsoleId = (): string => {
    if (createId) return createId()
    consoleSequence += 1
    return `console-${consoleSequence}`
  }

  const nextNetworkId = (): string => {
    if (createId) return createId()
    networkSequence += 1
    return `network-${networkSequence}`
  }

  const pushBoundedConsole = (entry: ConsoleEvidenceEntry): void => {
    consoleEntries.push(entry)
    if (isConsoleProblem(entry.level)) consoleProblemCount += 1
    if (consoleEntries.length > consoleCap) {
      const evicted = consoleEntries.splice(0, consoleEntries.length - consoleCap)
      for (const evictedEntry of evicted) {
        if (isConsoleProblem(evictedEntry.level)) consoleProblemCount -= 1
      }
    }
  }

  const pushBoundedNetwork = (entry: NetworkEvidenceEntry): void => {
    networkEntries.push(entry)
    if (isNetworkProblem(entry)) networkProblemCount += 1
    if (networkEntries.length > networkCap) {
      const evicted = networkEntries.splice(0, networkEntries.length - networkCap)
      for (const evictedEntry of evicted) {
        if (isNetworkProblem(evictedEntry)) networkProblemCount -= 1
      }
    }
  }

  return {
    pushConsole(entry) {
      const stored: ConsoleEvidenceEntry = {
        id: entry.id ?? nextConsoleId(),
        timestamp: entry.timestamp ?? now(),
        level: entry.level,
        message: entry.message,
        sourceUrl: entry.sourceUrl,
        line: entry.line,
        column: entry.column,
        stack: entry.stack
      }
      pushBoundedConsole(stored)
      return stored
    },

    getConsole() {
      return consoleEntries
    },

    clearConsole() {
      consoleEntries.length = 0
      consoleProblemCount = 0
    },

    getConsoleProblemCount() {
      return consoleProblemCount
    },

    pushNetwork(entry) {
      const stored: NetworkEvidenceEntry = {
        id: entry.id ?? nextNetworkId(),
        timestamp: entry.timestamp ?? now(),
        method: entry.method,
        url: entry.url,
        path: entry.path,
        status: entry.status,
        durationMs: entry.durationMs,
        failed: entry.failed ?? isNetworkProblem({ failed: false, status: entry.status }),
        requestHeaders: entry.requestHeaders,
        responseHeaders: entry.responseHeaders
      }
      pushBoundedNetwork(stored)
      return stored
    },

    getNetwork() {
      return networkEntries
    },

    clearNetwork() {
      networkEntries.length = 0
      networkProblemCount = 0
    },

    getNetworkProblemCount() {
      return networkProblemCount
    },

    snapshot(paneId) {
      const consoleProblemCount = this.getConsoleProblemCount()
      const networkProblemCount = this.getNetworkProblemCount()
      return {
        paneId,
        console: [...consoleEntries],
        network: [...networkEntries],
        problemCount: consoleProblemCount + networkProblemCount
      }
    }
  }
}

export function countConsoleProblems(entries: readonly { level: ConsoleEvidenceLevel }[]): number {
  return entries.filter((entry) => isConsoleProblem(entry.level)).length
}

export function countNetworkProblems(
  entries: readonly Pick<NetworkEvidenceEntry, 'failed' | 'status'>[]
): number {
  return entries.filter((entry) => isNetworkProblem(entry)).length
}
