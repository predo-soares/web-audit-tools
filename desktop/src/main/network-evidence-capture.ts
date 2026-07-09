import type { WebContents } from 'electron'
import type { NetworkEvidenceEntry } from '../shared/runtime-evidence'
import { isNetworkProblem } from '../shared/runtime-evidence'

type PushNetworkEntry = (
  entry: Omit<NetworkEvidenceEntry, 'id' | 'timestamp' | 'failed'> &
    Partial<Pick<NetworkEvidenceEntry, 'id' | 'timestamp' | 'failed'>>
) => void

interface PendingNetworkRequest {
  startedAtCdp: number
  method: string
  url: string
  path: string
  requestHeaders?: Record<string, string>
  status?: number
  responseHeaders?: Record<string, string>
}

function extractPath(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

function normalizeHeaders(headers: unknown): Record<string, string> | undefined {
  if (!headers || typeof headers !== 'object') return undefined
  if (Array.isArray(headers)) {
    const record: Record<string, string> = {}
    for (const entry of headers) {
      if (!entry || typeof entry !== 'object') continue
      const name = (entry as { name?: string }).name
      const value = (entry as { value?: string }).value
      if (name && value !== undefined) record[name] = value
    }
    return Object.keys(record).length > 0 ? record : undefined
  }
  const record: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof value === 'string') record[key] = value
  }
  return Object.keys(record).length > 0 ? record : undefined
}

function finalizeEntry(
  pending: PendingNetworkRequest,
  durationMs: number | undefined,
  push: PushNetworkEntry,
  overrides?: Partial<Pick<NetworkEvidenceEntry, 'failed' | 'status' | 'timestamp'>>
): void {
  const status = overrides?.status ?? pending.status
  const failed =
    overrides?.failed ??
    isNetworkProblem({ failed: false, status })

  push({
    timestamp: overrides?.timestamp ?? Date.now(),
    method: pending.method,
    url: pending.url,
    path: pending.path,
    status,
    durationMs,
    failed,
    requestHeaders: pending.requestHeaders,
    responseHeaders: pending.responseHeaders
  })
}

export async function enableNetworkEvidenceCapture(
  webContents: WebContents,
  push: PushNetworkEntry
): Promise<() => void> {
  const dbg = webContents.debugger
  if (!dbg.isAttached()) {
    dbg.attach('1.3')
  }

  const pending = new Map<string, PendingNetworkRequest>()

  const onMessage = (_event: unknown, method: string, params: Record<string, unknown>): void => {
    if (method === 'Network.requestWillBeSent') {
      const requestId = String(params.requestId)
      const request = params.request as { url?: string; method?: string; headers?: unknown }
      const url = request.url ?? ''
      const startedAtCdp = typeof params.timestamp === 'number' ? params.timestamp : Date.now() / 1000
      pending.set(requestId, {
        startedAtCdp,
        method: request.method ?? 'GET',
        url,
        path: extractPath(url),
        requestHeaders: normalizeHeaders(request.headers)
      })
      return
    }

    if (method === 'Network.responseReceived') {
      const requestId = String(params.requestId)
      const entry = pending.get(requestId)
      if (!entry) return
      const response = params.response as { status?: number; headers?: unknown }
      entry.status = response.status
      entry.responseHeaders = normalizeHeaders(response.headers)
      return
    }

    if (method === 'Network.loadingFinished') {
      const requestId = String(params.requestId)
      const entry = pending.get(requestId)
      if (!entry) return
      pending.delete(requestId)
      const finishedAtCdp = typeof params.timestamp === 'number' ? params.timestamp : Date.now() / 1000
      const durationMs = Math.max(0, Math.round((finishedAtCdp - entry.startedAtCdp) * 1000))
      finalizeEntry(entry, durationMs, push)
      return
    }

    if (method === 'Network.loadingFailed') {
      const requestId = String(params.requestId)
      const entry = pending.get(requestId)
      if (!entry) return
      pending.delete(requestId)
      finalizeEntry(entry, undefined, push, { failed: true })
    }
  }

  dbg.on('message', onMessage)
  await dbg.sendCommand('Network.enable')

  return () => {
    dbg.off('message', onMessage)
    pending.clear()
  }
}
