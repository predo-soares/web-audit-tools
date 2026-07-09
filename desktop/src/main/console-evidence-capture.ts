import type { WebContents } from 'electron'
import type { ConsoleEvidenceLevel } from '../shared/runtime-evidence'
import type { ConsoleEvidenceEntry } from '../shared/runtime-evidence'

type PushConsoleEntry = (
  entry: Omit<ConsoleEvidenceEntry, 'id' | 'timestamp'>
) => void

interface RemoteObject {
  type?: string
  value?: unknown
  description?: string
  preview?: { description?: string }
}

interface StackFrame {
  url: string
  lineNumber: number
  columnNumber: number
  functionName?: string
}

interface StackTrace {
  callFrames: StackFrame[]
}

function formatRemoteObject(obj: RemoteObject): string {
  if (obj.value !== undefined) {
    if (typeof obj.value === 'string') return obj.value
    try {
      return JSON.stringify(obj.value)
    } catch {
      return String(obj.value)
    }
  }
  if (obj.description) return obj.description
  if (obj.preview?.description) return obj.preview.description
  return `[${obj.type ?? 'object'}]`
}

function mapConsoleType(type: string): ConsoleEvidenceLevel {
  switch (type) {
    case 'error':
      return 'error'
    case 'warning':
      return 'warn'
    case 'info':
      return 'info'
    case 'debug':
      return 'debug'
    default:
      return 'log'
  }
}

function formatStackTrace(stackTrace?: StackTrace): string | undefined {
  if (!stackTrace?.callFrames?.length) return undefined
  return stackTrace.callFrames
    .map(
      (frame) =>
        `    at ${frame.functionName || '<anonymous>'} (${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1})`
    )
    .join('\n')
}

function sourceFromStackTrace(stackTrace?: StackTrace): {
  sourceUrl?: string
  line?: number
  column?: number
} {
  const frame = stackTrace?.callFrames?.[0]
  if (!frame) return {}
  return {
    sourceUrl: frame.url,
    line: frame.lineNumber + 1,
    column: frame.columnNumber + 1
  }
}

export async function enableConsoleEvidenceCapture(
  webContents: WebContents,
  push: PushConsoleEntry
): Promise<() => void> {
  const dbg = webContents.debugger
  if (!dbg.isAttached()) {
    dbg.attach('1.3')
  }

  const onMessage = (_event: unknown, method: string, params: Record<string, unknown>): void => {
    if (method === 'Runtime.consoleAPICalled') {
      const args = (params.args as RemoteObject[] | undefined) ?? []
      const stackTrace = params.stackTrace as StackTrace | undefined
      const source = sourceFromStackTrace(stackTrace)
      push({
        level: mapConsoleType(String(params.type)),
        message: args.map(formatRemoteObject).join(' '),
        sourceUrl: source.sourceUrl,
        line: source.line,
        column: source.column,
        stack: formatStackTrace(stackTrace)
      })
      return
    }

    if (method === 'Runtime.exceptionThrown') {
      const details = params.exceptionDetails as {
        text?: string
        url?: string
        lineNumber?: number
        columnNumber?: number
        stackTrace?: StackTrace
        exception?: { description?: string }
      }
      push({
        level: 'exception',
        message: details.exception?.description ?? details.text ?? 'Uncaught exception',
        sourceUrl: details.url,
        line: details.lineNumber !== undefined ? details.lineNumber + 1 : undefined,
        column: details.columnNumber !== undefined ? details.columnNumber + 1 : undefined,
        stack: formatStackTrace(details.stackTrace)
      })
    }
  }

  dbg.on('message', onMessage)
  await dbg.sendCommand('Runtime.enable')
  await dbg.sendCommand('Log.enable')

  return () => {
    dbg.off('message', onMessage)
  }
}
