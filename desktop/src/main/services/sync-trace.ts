export interface SyncTraceEntry {
  ts: number
  event: string
  data?: Record<string, unknown>
}

const buffer: SyncTraceEntry[] = []
const MAX_ENTRIES = 500

export function isSyncTraceEnabled(): boolean {
  return process.env.E2E_TEST === '1'
}

export function syncTrace(event: string, data?: Record<string, unknown>): void {
  if (!isSyncTraceEnabled()) return

  const entry: SyncTraceEntry = { ts: Date.now(), event, data }
  buffer.push(entry)
  if (buffer.length > MAX_ENTRIES) buffer.shift()

  console.error(`[sync-trace] ${event}`, data ? JSON.stringify(data) : '')
}

export function getSyncTraceLogs(): SyncTraceEntry[] {
  return [...buffer]
}

export function clearSyncTraceLogs(): void {
  buffer.length = 0
}

export function summarizeFingerprint(fingerprint: {
  layers: Array<{ type: string }>
  indexAmongMatches?: number
}): Record<string, unknown> {
  return {
    layers: fingerprint.layers.map((layer) => layer.type),
    indexAmongMatches: fingerprint.indexAmongMatches
  }
}
