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
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Copy01Icon,
  ExternalLinkIcon,
  PauseIcon,
  PlayIcon,
  Search01Icon
} from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { MotionTabs } from '@renderer/components/ui/motion-tabs'
import { RenderingControls } from './rendering-controls'

type DiagnosticsTab = RuntimeEvidenceChannel | 'rendering'
type ConsoleLevelFilter = 'all' | 'errors' | 'warnings' | 'info'
type NetworkOutcomeFilter = 'all' | 'failed' | '4xx' | '5xx'
type NetworkDurationFilter = 'all' | '100' | '500' | '1000' | '3000'
type NetworkSort = 'newest' | 'duration' | 'status'

const SCROLL_TAIL_THRESHOLD_PX = 24

interface GroupedConsoleEntry {
  entry: ConsoleEvidenceEntry
  count: number
}

function groupConsoleEntries(entries: ConsoleEvidenceEntry[]): GroupedConsoleEntry[] {
  const groups = new Map<string, GroupedConsoleEntry>()

  for (const entry of entries) {
    const key = [
      entry.level,
      entry.message,
      entry.sourceUrl ?? '',
      entry.line ?? '',
      entry.column ?? '',
      entry.stack ?? ''
    ].join('\u0000')
    const existing = groups.get(key)

    if (existing) {
      existing.count += 1
    } else {
      groups.set(key, { entry, count: 1 })
    }
  }

  return [...groups.values()]
}

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

function matchesNetworkDuration(
  entry: NetworkEvidenceEntry,
  filter: NetworkDurationFilter
): boolean {
  if (filter === 'all') return true
  return entry.durationMs !== undefined && entry.durationMs >= Number(filter)
}

function sortNetworkEntries(
  entries: NetworkEvidenceEntry[],
  sort: NetworkSort
): NetworkEvidenceEntry[] {
  return [...entries].sort((a, b) => {
    if (sort === 'duration') return (b.durationMs ?? -1) - (a.durationMs ?? -1)
    if (sort === 'status') return (b.status ?? 0) - (a.status ?? 0)
    return b.timestamp - a.timestamp
  })
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
  const [networkDurationFilter, setNetworkDurationFilter] = useState<NetworkDurationFilter>('all')
  const [networkSort, setNetworkSort] = useState<NetworkSort>('newest')
  const [capturePaused, setCapturePaused] = useState(false)
  const [hasPendingEvidence, setHasPendingEvidence] = useState(false)
  const [isAtLatest, setIsAtLatest] = useState(true)
  const capturePausedRef = useRef(false)
  const pendingEvidenceRef = useRef<RuntimeEvidenceSnapshot | null>(null)

  const visibleConsoleEntries = useMemo(() => {
    const entries = evidence?.console ?? []
    const query = consoleFilter.trim().toLocaleLowerCase()
    return groupConsoleEntries(
      entries.filter(
        (entry) =>
          matchesConsoleLevel(entry, consoleLevelFilter) &&
          (!query ||
            [entry.level, entry.message, entry.sourceUrl, entry.line, entry.column, entry.stack]
              .filter((value) => value !== undefined)
              .some((value) => String(value).toLocaleLowerCase().includes(query)))
      )
    )
  }, [consoleFilter, consoleLevelFilter, evidence?.console])

  const visibleNetworkEntries = useMemo(() => {
    const entries = evidence?.network ?? []
    const query = networkFilter.trim().toLocaleLowerCase()
    return sortNetworkEntries(
      entries.filter(
        (entry) =>
          matchesNetworkOutcome(entry, networkOutcomeFilter) &&
          matchesNetworkDuration(entry, networkDurationFilter) &&
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
      ),
      networkSort
    )
  }, [evidence?.network, networkDurationFilter, networkFilter, networkOutcomeFilter, networkSort])

  useEffect(() => {
    void window.panelApi.getDiagnosticsWidth().then((width) => {
      setPanelWidth(width > 0 ? width : DIAGNOSTICS_DRAWER_WIDTH_PX)
    })
  }, [])

  useEffect(() => {
    void window.panelApi.getRuntimeEvidence().then(setEvidence)

    const unsubscribeEvidence = window.panelApi.onRuntimeEvidenceChanged((snapshot) => {
      if (capturePausedRef.current) {
        pendingEvidenceRef.current = snapshot
        setHasPendingEvidence(true)
        return
      }
      setEvidence(snapshot)
    })
    const unsubscribeNavigation = window.panelApi.onPaneNavigation(() => {
      void window.panelApi.getRuntimeEvidence().then((snapshot) => {
        if (capturePausedRef.current) {
          pendingEvidenceRef.current = snapshot
          setHasPendingEvidence(true)
          return
        }
        setEvidence(snapshot)
      })
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
    setIsAtLatest(true)
  }, [activeTab])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (!isScrolledToBottom(list)) return
    list.scrollTop = list.scrollHeight
    stickToBottomRef.current = true
    setIsAtLatest(true)
  }, [evidence?.console.length, evidence?.network.length])

  const handleListScroll = useCallback((): void => {
    const list = listRef.current
    if (!list) return
    const atLatest = isScrolledToBottom(list)
    stickToBottomRef.current = atLatest
    setIsAtLatest(atLatest)
  }, [])

  const toggleCapturePaused = useCallback((): void => {
    const nextPaused = !capturePausedRef.current
    capturePausedRef.current = nextPaused
    setCapturePaused(nextPaused)

    if (!nextPaused) {
      pendingEvidenceRef.current = null
      setHasPendingEvidence(false)
      void window.panelApi.getRuntimeEvidence().then(setEvidence)
    }
  }, [])

  const jumpToLatest = useCallback((): void => {
    const list = listRef.current
    if (!list) return
    list.scrollTop = list.scrollHeight
    stickToBottomRef.current = true
    setIsAtLatest(true)
    setHasPendingEvidence(false)
  }, [])

  const handleClear = useCallback((channel: RuntimeEvidenceChannel): void => {
    void window.panelApi.clearRuntimeEvidence(channel).then(setEvidence)
  }, [])

  const clearActiveFilter = useCallback((): void => {
    if (activeTab === 'console') {
      setConsoleFilter('')
      setConsoleLevelFilter('all')
      return
    }
    setNetworkFilter('')
    setNetworkOutcomeFilter('all')
    setNetworkDurationFilter('all')
    setNetworkSort('newest')
  }, [activeTab])

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

  const copyConsoleMessage = useCallback((entry: ConsoleEvidenceEntry): void => {
    void navigator.clipboard.writeText(entry.message)
  }, [])

  const copyConsoleStack = useCallback((entry: ConsoleEvidenceEntry): void => {
    if (!entry.stack) return
    void navigator.clipboard.writeText(entry.stack)
  }, [])

  const openSourceLocation = useCallback((entry: ConsoleEvidenceEntry): void => {
    if (!entry.sourceUrl) return
    void window.panelApi.openExternalUrl(entry.sourceUrl)
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
      <div
        className="relative z-[1] flex min-h-0 flex-1 flex-col gap-0"
        style={{ width: panelWidth }}
      >
        <header
          className="flex items-center gap-1 border-b border-white/10 px-2 py-2"
          style={{ paddingTop: TOOLBAR_HEIGHT_PX }}
        >
          <MotionTabs<DiagnosticsTab>
            value={activeTab}
            onChange={setActiveTab}
            layoutId="diagnostics-tab-indicator"
            ariaLabel="Diagnostics channels"
            tabClassName="px-2 py-1"
            items={[
              {
                value: 'console',
                label: 'Console',
                testId: 'diagnostics-tab-console',
                trailing: (
                  <Badge
                    data-testid="diagnostics-console-badge"
                    variant="secondary"
                    className="h-auto px-1.5 py-0.5 text-[10px] tabular-nums"
                  >
                    {consoleCount}
                  </Badge>
                )
              },
              {
                value: 'network',
                label: 'Network',
                testId: 'diagnostics-tab-network',
                trailing: (
                  <Badge
                    data-testid="diagnostics-network-badge"
                    variant="secondary"
                    className="h-auto px-1.5 py-0.5 text-[10px] tabular-nums"
                  >
                    {networkCount}
                  </Badge>
                )
              },
              { value: 'rendering', label: 'Rendering', testId: 'diagnostics-tab-rendering' }
            ]}
          />
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
                <Select
                  value={consoleLevelFilter}
                  onValueChange={(v) => setConsoleLevelFilter(v as ConsoleLevelFilter)}
                >
                  <SelectTrigger
                    size="sm"
                    data-testid="diagnostics-console-level-filter"
                    aria-label="Filter console by severity"
                    className="h-7 shrink-0 w-auto font-sans text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="bottom" alignItemWithTrigger={false}>
                    <SelectItem value="all">All levels</SelectItem>
                    <SelectItem value="errors">Errors</SelectItem>
                    <SelectItem value="warnings">Warnings</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Select
                    value={networkOutcomeFilter}
                    onValueChange={(v) => setNetworkOutcomeFilter(v as NetworkOutcomeFilter)}
                  >
                    <SelectTrigger
                      size="sm"
                      data-testid="diagnostics-network-outcome-filter"
                      aria-label="Filter network by outcome"
                      className="h-7 shrink-0 w-auto font-sans text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" alignItemWithTrigger={false}>
                      <SelectItem value="all">All outcomes</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="4xx">4xx</SelectItem>
                      <SelectItem value="5xx">5xx</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={networkDurationFilter}
                    onValueChange={(v) => setNetworkDurationFilter(v as NetworkDurationFilter)}
                  >
                    <SelectTrigger
                      size="sm"
                      data-testid="diagnostics-network-duration-filter"
                      aria-label="Filter network by duration"
                      className="h-7 shrink-0 w-auto font-sans text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" alignItemWithTrigger={false}>
                      <SelectItem value="all">Any duration</SelectItem>
                      <SelectItem value="100">100ms+</SelectItem>
                      <SelectItem value="500">500ms+</SelectItem>
                      <SelectItem value="1000">1s+</SelectItem>
                      <SelectItem value="3000">3s+</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={networkSort}
                    onValueChange={(v) => setNetworkSort(v as NetworkSort)}
                  >
                    <SelectTrigger
                      size="sm"
                      data-testid="diagnostics-network-sort"
                      aria-label="Sort network requests"
                      className="h-7 shrink-0 w-auto font-sans text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" alignItemWithTrigger={false}>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="duration">Slowest</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="tiny"
                data-testid={`diagnostics-clear-${activeTab}`}
                className="h-7 shrink-0 px-2 text-xs font-medium text-muted-foreground"
                onClick={() => handleClear(activeTab)}
              >
                Clear
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="tiny"
                className="h-7 shrink-0 gap-1 px-2 text-xs font-medium text-muted-foreground"
                aria-label={capturePaused ? 'Resume capture' : 'Pause capture'}
                title={capturePaused ? 'Resume capture' : 'Pause capture'}
                onClick={toggleCapturePaused}
              >
                <Icon icon={capturePaused ? PlayIcon : PauseIcon} className="size-3" />
                {capturePaused ? 'Resume' : 'Pause'}
              </Button>
            </div>
            {!isAtLatest || hasPendingEvidence ? (
              <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-muted-foreground">
                <span>
                  {hasPendingEvidence ? 'New entries are waiting' : 'Viewing older entries'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="tiny"
                  className="h-6 shrink-0 px-2 text-[11px] font-medium text-foreground"
                  onClick={jumpToLatest}
                >
                  Jump to latest
                </Button>
              </div>
            ) : null}
            <div
              ref={listRef}
              data-testid="diagnostics-list"
              className="min-h-0 flex-1 overflow-y-auto px-2 py-2 font-mono text-xs"
              onScroll={handleListScroll}
            >
              {activeTab === 'console' ? (
                !evidence || evidence.console.length === 0 ? (
                  <div className="flex flex-col items-start gap-2 px-1 py-3 font-sans">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        No console output for the active pane yet.
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        Capture starts on navigation or reload.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="tiny"
                      className="h-7 px-2 text-xs"
                      onClick={() => void window.panelApi.reload()}
                    >
                      Reload page
                    </Button>
                  </div>
                ) : visibleConsoleEntries.length === 0 ? (
                  <div className="flex flex-col items-start gap-2 px-1 py-3 font-sans">
                    <p className="text-sm text-muted-foreground">
                      No console output matches this filter.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="tiny"
                      className="h-7 px-2 text-xs"
                      onClick={clearActiveFilter}
                    >
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {visibleConsoleEntries.map(({ entry, count }) => {
                      const source = formatSource(entry)
                      const expanded = expandedEntryIds.has(entry.id)
                      const canExpand = Boolean(entry.stack)
                      return (
                        <li
                          key={entry.id}
                          data-testid="diagnostics-console-entry"
                          className="group rounded-md px-2 py-1.5 hover:bg-white/5"
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
                              <p className="flex items-start gap-2 break-words text-foreground">
                                <span className="min-w-0 flex-1">{entry.message}</span>
                                {count > 1 ? (
                                  <Badge
                                    variant="secondary"
                                    className="h-auto shrink-0 px-1.5 py-0 text-[10px] font-medium tabular-nums"
                                    title={`${count} identical messages`}
                                  >
                                    ×{count}
                                  </Badge>
                                ) : null}
                              </p>
                              {source ? (
                                <div className="mt-0.5 flex min-w-0 items-center gap-1">
                                  <button
                                    type="button"
                                    data-testid="diagnostics-console-source-link"
                                    className="block min-w-0 truncate text-left text-[11px] text-sky-400 hover:underline"
                                    title={formatClipboardLocation(entry) ?? source}
                                    onClick={() => openSourceLocation(entry)}
                                  >
                                    {source}
                                  </button>
                                  <button
                                    type="button"
                                    data-testid="diagnostics-console-copy-source"
                                    aria-label="Copy source location"
                                    title="Copy source location"
                                    className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-white/10 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
                                    onClick={() => copySourceLocation(entry)}
                                  >
                                    <Icon icon={Copy01Icon} className="size-3" />
                                  </button>
                                  <button
                                    type="button"
                                    data-testid="diagnostics-console-open-source"
                                    aria-label="Open source location"
                                    title="Open source location"
                                    className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-white/10 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
                                    onClick={() => openSourceLocation(entry)}
                                  >
                                    <Icon icon={ExternalLinkIcon} className="size-3" />
                                  </button>
                                </div>
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
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                              <button
                                type="button"
                                data-testid="diagnostics-console-copy-message"
                                aria-label="Copy console message"
                                title="Copy message"
                                className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                                onClick={() => copyConsoleMessage(entry)}
                              >
                                <Icon icon={Copy01Icon} className="size-3" />
                              </button>
                              {entry.stack ? (
                                <button
                                  type="button"
                                  data-testid="diagnostics-console-copy-stack"
                                  aria-label="Copy stack trace"
                                  title="Copy stack trace"
                                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                                  onClick={() => copyConsoleStack(entry)}
                                >
                                  <Icon icon={Copy01Icon} className="size-3" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )
              ) : !evidence || evidence.network.length === 0 ? (
                <div className="flex flex-col items-start gap-2 px-1 py-3 font-sans">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      No network requests for the active pane yet.
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      Capture starts on navigation or reload.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="tiny"
                    className="h-7 px-2 text-xs"
                    onClick={() => void window.panelApi.reload()}
                  >
                    Reload page
                  </Button>
                </div>
              ) : visibleNetworkEntries.length === 0 ? (
                <div className="flex flex-col items-start gap-2 px-1 py-3 font-sans">
                  <p className="text-sm text-muted-foreground">
                    No network requests match this filter.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="tiny"
                    className="h-7 px-2 text-xs"
                    onClick={clearActiveFilter}
                  >
                    Clear filters
                  </Button>
                </div>
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
