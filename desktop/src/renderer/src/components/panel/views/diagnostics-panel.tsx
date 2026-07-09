import { useEffect, useRef, useState } from 'react'
import type {
  ConsoleEvidenceEntry,
  NetworkEvidenceEntry,
  RuntimeEvidenceSnapshot
} from '../../../../../shared/runtime-evidence'
import { DIAGNOSTICS_DRAWER_WIDTH_PX } from '../../../../../shared/runtime-evidence'
import { TOOLBAR_HEIGHT_PX } from '../../../../../shared/sidebar'
import { cn } from '@renderer/lib/utils'

type DiagnosticsTab = 'console' | 'network'

function formatSource(entry: ConsoleEvidenceEntry): string | null {
  if (!entry.sourceUrl) return null
  const fileName = entry.sourceUrl.split('/').pop() || entry.sourceUrl
  if (entry.line === undefined) return fileName
  return `${fileName}:${entry.line}`
}

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) return '—'
  if (durationMs < 1000) return `${durationMs}ms`
  return `${(durationMs / 1000).toFixed(1)}s`
}

function formatStatus(entry: NetworkEvidenceEntry): string {
  if (entry.failed && entry.status === undefined) return 'failed'
  if (entry.status === undefined) return '—'
  return String(entry.status)
}

const LEVEL_CLASS: Record<ConsoleEvidenceEntry['level'], string> = {
  error: 'text-destructive',
  warn: 'text-amber-500',
  info: 'text-sky-500',
  log: 'text-muted-foreground',
  debug: 'text-muted-foreground/70',
  exception: 'text-destructive',
  rejection: 'text-destructive'
}

export function DiagnosticsPanel(): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<DiagnosticsTab>('console')
  const [evidence, setEvidence] = useState<RuntimeEvidenceSnapshot | null>(null)

  useEffect(() => {
    void window.panelApi.getRuntimeEvidence().then(setEvidence)

    const unsubscribeEvidence = window.panelApi.onRuntimeEvidenceChanged(setEvidence)
    const unsubscribeNavigation = window.panelApi.onPaneNavigation(() => {
      void window.panelApi.getRuntimeEvidence().then(setEvidence)
    })

    return () => {
      unsubscribeEvidence()
      unsubscribeNavigation()
    }
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollTop = list.scrollHeight
  }, [activeTab, evidence?.console.length, evidence?.network.length])

  const consoleCount = evidence?.console.length ?? 0
  const networkCount = evidence?.network.length ?? 0

  return (
    <aside
      id="diagnostics-drawer"
      data-testid="diagnostics-drawer"
      className="box-border flex h-screen min-h-screen shrink-0 flex-col overflow-hidden border-l border-white/10 bg-background text-foreground"
      style={{ width: DIAGNOSTICS_DRAWER_WIDTH_PX }}
    >
      <div
        className="relative z-[1] flex min-h-0 flex-1 flex-col"
        style={{ width: DIAGNOSTICS_DRAWER_WIDTH_PX }}
      >
        <header
          className="flex items-center gap-1 border-b border-white/10 px-2 py-2"
          style={{ paddingTop: TOOLBAR_HEIGHT_PX }}
        >
          <button
            type="button"
            data-testid="diagnostics-tab-console"
            aria-selected={activeTab === 'console'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              activeTab === 'console'
                ? 'bg-white/10 text-foreground'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
            onClick={() => setActiveTab('console')}
          >
            Console
            <span
              data-testid="diagnostics-console-badge"
              className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums"
            >
              {consoleCount}
            </span>
          </button>
          <button
            type="button"
            data-testid="diagnostics-tab-network"
            aria-selected={activeTab === 'network'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              activeTab === 'network'
                ? 'bg-white/10 text-foreground'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
            onClick={() => setActiveTab('network')}
          >
            Network
            <span
              data-testid="diagnostics-network-badge"
              className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums"
            >
              {networkCount}
            </span>
          </button>
        </header>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2 font-mono text-xs">
          {activeTab === 'console' ? (
            !evidence || evidence.console.length === 0 ? (
              <p className="px-1 py-2 text-sm font-sans text-muted-foreground">
                No console output for the active pane yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {evidence.console.map((entry) => {
                  const source = formatSource(entry)
                  return (
                    <li
                      key={entry.id}
                      data-testid="diagnostics-console-entry"
                      className="rounded-md px-2 py-1.5 hover:bg-white/5"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          data-testid="diagnostics-console-level"
                          className={cn('shrink-0 uppercase', LEVEL_CLASS[entry.level])}
                        >
                          {entry.level}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-foreground">{entry.message}</p>
                          {source ? (
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{source}</p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )
          ) : !evidence || evidence.network.length === 0 ? (
            <p className="px-1 py-2 text-sm font-sans text-muted-foreground">
              No network requests for the active pane yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {evidence.network.map((entry) => (
                <li
                  key={entry.id}
                  data-testid="diagnostics-network-entry"
                  className={cn(
                    'rounded-md px-2 py-1.5 hover:bg-white/5',
                    entry.failed && 'text-destructive'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      data-testid="diagnostics-network-status"
                      className={cn('w-10 shrink-0 tabular-nums', entry.failed && 'text-destructive')}
                    >
                      {formatStatus(entry)}
                    </span>
                    <span
                      data-testid="diagnostics-network-method"
                      className="w-12 shrink-0 uppercase text-muted-foreground"
                    >
                      {entry.method}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        data-testid="diagnostics-network-path"
                        className="truncate text-foreground"
                        title={entry.path}
                      >
                        {entry.path}
                      </p>
                    </div>
                    <span
                      data-testid="diagnostics-network-duration"
                      className="shrink-0 tabular-nums text-muted-foreground"
                    >
                      {formatDuration(entry.durationMs)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  )
}
