import {
  CONSOLE_EVIDENCE_CAP,
  isConsoleProblem,
  type ConsoleEvidenceEntry,
  type ConsoleEvidenceLevel,
  type RuntimeEvidenceSnapshot
} from '../shared/runtime-evidence'
import type { PaneId } from '../shared/types'

export interface RuntimeEvidenceBuffer {
  pushConsole(
    entry: Omit<ConsoleEvidenceEntry, 'id' | 'timestamp'> &
      Partial<Pick<ConsoleEvidenceEntry, 'id' | 'timestamp'>>
  ): ConsoleEvidenceEntry
  getConsole(): readonly ConsoleEvidenceEntry[]
  clearConsole(): void
  getConsoleProblemCount(): number
  snapshot(paneId: PaneId): RuntimeEvidenceSnapshot
}

export function createRuntimeEvidenceBuffer(options?: {
  consoleCap?: number
  now?: () => number
  createId?: () => string
}): RuntimeEvidenceBuffer {
  const consoleCap = options?.consoleCap ?? CONSOLE_EVIDENCE_CAP
  const now = options?.now ?? (() => Date.now())
  let createId = options?.createId
  let sequence = 0

  const consoleEntries: ConsoleEvidenceEntry[] = []

  const nextId = (): string => {
    if (createId) return createId()
    sequence += 1
    return `console-${sequence}`
  }

  const pushBounded = (entry: ConsoleEvidenceEntry): void => {
    consoleEntries.push(entry)
    if (consoleEntries.length > consoleCap) {
      consoleEntries.splice(0, consoleEntries.length - consoleCap)
    }
  }

  return {
    pushConsole(entry) {
      const stored: ConsoleEvidenceEntry = {
        id: entry.id ?? nextId(),
        timestamp: entry.timestamp ?? now(),
        level: entry.level,
        message: entry.message,
        sourceUrl: entry.sourceUrl,
        line: entry.line,
        column: entry.column,
        stack: entry.stack
      }
      pushBounded(stored)
      return stored
    },

    getConsole() {
      return consoleEntries
    },

    clearConsole() {
      consoleEntries.length = 0
    },

    getConsoleProblemCount() {
      return consoleEntries.filter((entry) => isConsoleProblem(entry.level)).length
    },

    snapshot(paneId) {
      return {
        paneId,
        console: [...consoleEntries],
        problemCount: this.getConsoleProblemCount()
      }
    }
  }
}

export function countConsoleProblems(entries: readonly { level: ConsoleEvidenceLevel }[]): number {
  return entries.filter((entry) => isConsoleProblem(entry.level)).length
}
