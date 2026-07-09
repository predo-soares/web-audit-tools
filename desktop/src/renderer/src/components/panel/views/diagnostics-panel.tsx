import { useEffect, useRef, useState } from 'react'
import type { ConsoleEvidenceEntry, RuntimeEvidenceSnapshot } from '../../../../../shared/runtime-evidence'
import { DIAGNOSTICS_DRAWER_WIDTH_PX } from '../../../../../shared/runtime-evidence'
import { TOOLBAR_HEIGHT_PX } from '../../../../../shared/sidebar'
import { cn } from '@renderer/lib/utils'

function formatSource(entry: ConsoleEvidenceEntry): string | null {
  if (!entry.sourceUrl) return null
  const fileName = entry.sourceUrl.split('/').pop() || entry.sourceUrl
  if (entry.line === undefined) return fileName
  return `${fileName}:${entry.line}`
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
  }, [evidence?.console.length])

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
          className="flex items-center border-b border-white/10 px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground"
          style={{ paddingTop: TOOLBAR_HEIGHT_PX }}
        >
          Console
        </header>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2 font-mono text-xs">
          {!evidence || evidence.console.length === 0 ? (
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
          )}
        </div>
      </div>
    </aside>
  )
}
