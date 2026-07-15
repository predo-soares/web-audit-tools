import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ConsoleEvidenceEntry,
  NetworkEvidenceEntry,
  RuntimeEvidenceChannel,
  RuntimeEvidenceSnapshot
} from '../../../../../shared/runtime-evidence'
import {
  clampDiagnosticsDrawerWidth,
  DIAGNOSTICS_DRAWER_WIDTH_PX,
  selectPreferredDiagnosticsTab
} from '../../../../../shared/runtime-evidence'
import { TOOLBAR_HEIGHT_PX } from '../../../../../shared/sidebar'
import { cn } from '@renderer/lib/utils'
import { ArrowDown01Icon, ArrowRight01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'
import { Input } from '@renderer/components/ui/input'
import { RenderingControls } from './rendering-controls'

type DiagnosticsTab = RuntimeEvidenceChannel | 'rendering'
type ConsoleLevelFilter = 'all' | 'errors' | 'warnings' | 'info'
type NetworkOutcomeFilter = 'all' | 'failed' | '4xx' | '5xx'

const SCROLL_TAIL_THRESHOLD_PX = 24

function formatSource(entry: ConsoleEvidenceEntry): string | null {
  if (!entry.sourceUrl) return null
  const fileName = entry.sourceUrl.split('/').pop() || entry.sourceUrl
  if (entry.line === undefined) return fileName
  return `${fileName}:${entry.line}`
}

function formatClipboardLocation(entry: ConsoleEvidenceEntry): string | null {
  if (!entry.sourceUrl) return null
  const parts: string[] = [entry.sourceUrl]
  if (entry.line !== undefined) parts.push(String(entry.line))
  if (entry.column !== undefined) parts.push(String(entry.column))
  return parts.join(':')
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

function formatHeaders(headers?: Record<string, string>): string {
  if (!headers) return ''
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
}

function isScrolledToBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= SCROLL_TAIL_THRESHOLD_PX
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

function matchesConsoleLevel(entry: ConsoleEvidenceEntry, filter: ConsoleLevelFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'errors') return ['error', 'exception', 'rejection'].includes(entry.level)
  if (filter === 'warnings') return entry.level === 'warn'
  return ['info', 'log', 'debug'].includes(entry.level)
}

function matchesNetworkOutcome(entry: NetworkEvidenceEntry, filter: NetworkOutcomeFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'failed') {
    return entry.failed || (entry.status !== undefined && entry.status >= 400)
  }
  if (filter === '4xx')
    return entry.status !== undefined && entry.status >= 400 && entry.status < 500
  return entry.status !== undefined && entry.status >= 500
}

export function DiagnosticsPanel(): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const [panelWidth, setPanelWidth] = useState(DIAGNOSTICS_DRAWER_WIDTH_PX)
  const [activeTab, setActiveTab] = useState<DiagnosticsTab>('console')
  const [evidence, setEvidence] = useState<RuntimeEvidenceSnapshot | null>(null)
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(() => new Set())
  const [consoleFilter, setConsoleFilter] = useState('')
  const [networkFilter, setNetworkFilter] = useState('')
  const [consoleLevelFilter, setConsoleLevelFilter] = useState<ConsoleLevelFilter>('all')
  const [networkOutcomeFilter, setNetworkOutcomeFilter] = useState<NetworkOutcomeFilter>('all')

  const visibleConsoleEntries = useMemo(() => {
    const entries = evidence?.console ?? []
    const query = consoleFilter.trim().toLocaleLowerCase()
    return entries.filter(
      (entry) =>
        matchesConsoleLevel(entry, consoleLevelFilter) &&
        (!query ||
          [entry.level, entry.message, entry.sourceUrl, entry.line, entry.column, entry.stack]
            .filter((value) => value !== undefined)
            .some((value) => String(value).toLocaleLowerCase().includes(query)))
    )
  }, [consoleFilter, consoleLevelFilter, evidence?.console])

  const visibleNetworkEntries = useMemo(() => {
    const entries = evidence?.network ?? []
    const query = networkFilter.trim().toLocaleLowerCase()
    return entries.filter(
      (entry) =>
        matchesNetworkOutcome(entry, networkOutcomeFilter) &&
        (!query ||
          [
            entry.status,
            entry.method,
            entry.path,
            entry.durationMs,
            entry.failed ? 'failed' : undefined,
            formatHeaders(entry.requestHeaders),
            formatHeaders(entry.responseHeaders)
          ]
            .filter((value) => value !== undefined)
            .some((value) => String(value).toLocaleLowerCase().includes(query)))
    )
  }, [evidence?.network, networkFilter, networkOutcomeFilter])

  useEffect(() => {
    void window.panelApi.getDiagnosticsWidth().then((width) => {
      setPanelWidth(width > 0 ? width : DIAGNOSTICS_DRAWER_WIDTH_PX)
    })
  }, [])

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
    void window.panelApi.getRuntimeEvidence().then((snapshot) => {
      setActiveTab(selectPreferredDiagnosticsTab(snapshot))
    })
  }, [])

  useEffect(() => {
    const unsubscribeShow = window.panelApi.onShow((message) => {
      if (message.panelId !== 'diagnostics-right' || message.mode !== 'docked') return
      void window.panelApi.getRuntimeEvidence().then((snapshot) => {
        setActiveTab(selectPreferredDiagnosticsTab(snapshot))
      })
    })
    return unsubscribeShow
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollTop = list.scrollHeight
    stickToBottomRef.current = true
  }, [activeTab])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (!isScrolledToBottom(list)) return
    list.scrollTop = list.scrollHeight
    stickToBottomRef.current = true
  }, [evidence?.console.length, evidence?.network.length])

  const handleListScroll = useCallback((): void => {
    const list = listRef.current
    if (!list) return
    stickToBottomRef.current = isScrolledToBottom(list)
  }, [])

  const handleClear = useCallback((channel: RuntimeEvidenceChannel): void => {
    void window.panelApi.clearRuntimeEvidence(channel).then(setEvidence)
  }, [])

  const toggleExpanded = useCallback((entryId: string): void => {
    setExpandedEntryIds((current) => {
      const next = new Set(current)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }, [])

  const copySourceLocation = useCallback((entry: ConsoleEvidenceEntry): void => {
    const location = formatClipboardLocation(entry)
    if (!location) return
    void navigator.clipboard.writeText(location)
  }, [])

  const consoleCount = evidence?.console.length ?? 0
  const networkCount = evidence?.network.length ?? 0

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = panelWidth
      const handle = event.currentTarget

      handle.setPointerCapture(event.pointerId)

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        const nextWidth = clampDiagnosticsDrawerWidth(startWidth + (startX - moveEvent.clientX))
        setPanelWidth(nextWidth)
        window.panelApi.resizeDockedPanel(nextWidth, 'preview')
      }

      const finishResize = (endEvent: PointerEvent): void => {
        handle.releasePointerCapture(endEvent.pointerId)
        const nextWidth = clampDiagnosticsDrawerWidth(startWidth + (startX - endEvent.clientX))
        setPanelWidth(nextWidth)
        window.panelApi.resizeDockedPanel(nextWidth, 'commit')
        handle.removeEventListener('pointermove', handlePointerMove)
        handle.removeEventListener('pointerup', finishResize)
        handle.removeEventListener('pointercancel', finishResize)
      }

      handle.addEventListener('pointermove', handlePointerMove)
      handle.addEventListener('pointerup', finishResize)
      handle.addEventListener('pointercancel', finishResize)
    },
    [panelWidth]
  )

  return (
    <aside
      id="diagnostics-drawer"
      data-testid="diagnostics-drawer"
      data-pane-id={evidence?.paneId ?? ''}
      className="relative box-border flex h-screen min-h-screen shrink-0 flex-col overflow-hidden border-l border-white/10 bg-background text-foreground"
      style={{ width: panelWidth }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize diagnostics panel"
        data-testid="diagnostics-resize-handle"
        className="absolute inset-y-0 left-0 z-20 w-1 -translate-x-1/2 cursor-col-resize touch-none hover:bg-white/10 active:bg-white/15"
        onPointerDown={handleResizePointerDown}
      />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col" style={{ width: panelWidth }}>
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
          <button
            type="button"
            data-testid="diagnostics-tab-rendering"
            aria-selected={activeTab === 'rendering'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              activeTab === 'rendering'
                ? 'bg-white/10 text-foreground'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
            onClick={() => setActiveTab('rendering')}
          >
            Rendering
          </button>
        </header>
        {activeTab === 'rendering' ? (
          <RenderingControls />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-white/10 px-2 py-2">
              <div className="relative min-w-0 flex-1">
                <Icon
                  icon={Search01Icon}
                  className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  data-testid={`diagnostics-${activeTab}-filter`}
                  aria-label={`Filter ${activeTab} output`}
                  placeholder={`Filter ${activeTab}`}
                  value={activeTab === 'console' ? consoleFilter : networkFilter}
                  className="h-7 rounded-md border-0 pl-7 font-sans text-xs"
                  onChange={(event) => {
                    if (activeTab === 'console') {
                      setConsoleFilter(event.target.value)
                    } else {
                      setNetworkFilter(event.target.value)
                    }
                  }}
                />
              </div>
              {activeTab === 'console' ? (
                <select
                  data-testid="diagnostics-console-level-filter"
                  aria-label="Filter console by severity"
                  value={consoleLevelFilter}
                  className="h-7 shrink-0 rounded-md bg-white/5 px-2 font-sans text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onChange={(event) =>
                    setConsoleLevelFilter(event.target.value as ConsoleLevelFilter)
                  }
                >
                  <option value="all">All levels</option>
                  <option value="errors">Errors</option>
                  <option value="warnings">Warnings</option>
                  <option value="info">Info</option>
                </select>
              ) : (
                <select
                  data-testid="diagnostics-network-outcome-filter"
                  aria-label="Filter network by outcome"
                  value={networkOutcomeFilter}
                  className="h-7 shrink-0 rounded-md bg-white/5 px-2 font-sans text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onChange={(event) =>
                    setNetworkOutcomeFilter(event.target.value as NetworkOutcomeFilter)
                  }
                >
                  <option value="all">All outcomes</option>
                  <option value="failed">Failed</option>
                  <option value="4xx">4xx</option>
                  <option value="5xx">5xx</option>
                </select>
              )}
              <button
                type="button"
                data-testid={`diagnostics-clear-${activeTab}`}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                onClick={() => handleClear(activeTab)}
              >
                Clear
              </button>
            </div>
            <div
              ref={listRef}
              data-testid="diagnostics-list"
              className="min-h-0 flex-1 overflow-y-auto px-2 py-2 font-mono text-xs"
              onScroll={handleListScroll}
            >
              {activeTab === 'console' ? (
                !evidence || evidence.console.length === 0 ? (
                  <p className="px-1 py-2 text-sm font-sans text-muted-foreground">
                    No console output for the active pane yet.
                  </p>
                ) : visibleConsoleEntries.length === 0 ? (
                  <p className="px-1 py-2 text-sm font-sans text-muted-foreground">
                    No console output matches this filter.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {visibleConsoleEntries.map((entry) => {
                      const source = formatSource(entry)
                      const expanded = expandedEntryIds.has(entry.id)
                      const canExpand = Boolean(entry.stack)
                      return (
                        <li
                          key={entry.id}
                          data-testid="diagnostics-console-entry"
                          className="rounded-md px-2 py-1.5 hover:bg-white/5"
                        >
                          <div className="flex items-start gap-2">
                            {canExpand ? (
                              <button
                                type="button"
                                data-testid="diagnostics-console-expand"
                                aria-expanded={expanded}
                                aria-label={
                                  expanded ? 'Collapse stack trace' : 'Expand stack trace'
                                }
                                className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() => toggleExpanded(entry.id)}
                              >
                                <Icon
                                  icon={expanded ? ArrowDown01Icon : ArrowRight01Icon}
                                  className="size-3"
                                />
                              </button>
                            ) : (
                              <span className="w-3 shrink-0" />
                            )}
                            <span
                              data-testid="diagnostics-console-level"
                              className={cn('shrink-0 uppercase', LEVEL_CLASS[entry.level])}
                            >
                              {entry.level}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-foreground">{entry.message}</p>
                              {source ? (
                                <button
                                  type="button"
                                  data-testid="diagnostics-console-source-link"
                                  className="mt-0.5 block max-w-full truncate text-left text-[11px] text-sky-400 hover:underline"
                                  title={formatClipboardLocation(entry) ?? source}
                                  onClick={() => copySourceLocation(entry)}
                                >
                                  {source}
                                </button>
                              ) : null}
                              {expanded && entry.stack ? (
                                <pre
                                  data-testid="diagnostics-console-stack"
                                  className="mt-1 whitespace-pre-wrap break-words text-[10px] text-muted-foreground"
                                >
                                  {entry.stack}
                                </pre>
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
              ) : visibleNetworkEntries.length === 0 ? (
                <p className="px-1 py-2 text-sm font-sans text-muted-foreground">
                  No network requests match this filter.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {visibleNetworkEntries.map((entry) => {
                    const expanded = expandedEntryIds.has(entry.id)
                    const requestHeaders = formatHeaders(entry.requestHeaders)
                    const responseHeaders = formatHeaders(entry.responseHeaders)
                    const canExpand = Boolean(requestHeaders || responseHeaders)
                    return (
                      <li
                        key={entry.id}
                        data-testid="diagnostics-network-entry"
                        className={cn(
                          'rounded-md px-2 py-1.5 hover:bg-white/5',
                          entry.failed && 'text-destructive'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {canExpand ? (
                            <button
                              type="button"
                              data-testid="diagnostics-network-expand"
                              aria-expanded={expanded}
                              aria-label={expanded ? 'Collapse headers' : 'Expand headers'}
                              className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={() => toggleExpanded(entry.id)}
                            >
                              <Icon
                                icon={expanded ? ArrowDown01Icon : ArrowRight01Icon}
                                className="size-3"
                              />
                            </button>
                          ) : (
                            <span className="w-3 shrink-0" />
                          )}
                          <span
                            data-testid="diagnostics-network-status"
                            className={cn(
                              'w-10 shrink-0 tabular-nums',
                              entry.failed && 'text-destructive'
                            )}
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
                            {expanded ? (
                              <div
                                data-testid="diagnostics-network-headers"
                                className="mt-1 space-y-1 text-[10px] text-muted-foreground"
                              >
                                {requestHeaders ? (
                                  <div>
                                    <p className="font-sans font-medium text-foreground/80">
                                      Request
                                    </p>
                                    <pre className="whitespace-pre-wrap break-words">
                                      {requestHeaders}
                                    </pre>
                                  </div>
                                ) : null}
                                {responseHeaders ? (
                                  <div>
                                    <p className="font-sans font-medium text-foreground/80">
                                      Response
                                    </p>
                                    <pre className="whitespace-pre-wrap break-words">
                                      {responseHeaders}
                                    </pre>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <span
                            data-testid="diagnostics-network-duration"
                            className="shrink-0 tabular-nums text-muted-foreground"
                          >
                            {formatDuration(entry.durationMs)}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
