import { useCallback, useEffect, useRef, useState } from 'react'
import type { DevContext } from '../../../../../shared/dev-context'
import type { PanelAction } from '../../../../../shared/panel-types'
import { Button } from '@renderer/components/ui/button'

function projectName(repoPath: string): string {
  const normalized = repoPath.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || repoPath
}

function MetadataRow({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 rounded-lg bg-white/[0.035] px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-xs text-foreground">{children}</dd>
    </div>
  )
}

export function DevContextPanel({
  onAction
}: {
  onAction: (action: PanelAction) => void
}): React.JSX.Element {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [context, setContext] = useState<DevContext | null>(null)
  const [loading, setLoading] = useState(true)

  const loadContext = useCallback((showLoading = false): void => {
    if (showLoading) setLoading(true)
    void window.panelApi
      .getDevContext()
      .then(setContext)
      .catch(() => setContext(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const focusClose = (): void => {
      window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    }

    focusClose()
    void window.panelApi
      .getDevContext()
      .then(setContext)
      .catch(() => setContext(null))
      .finally(() => setLoading(false))
    const unsubscribeShow = window.panelApi.onShow((message) => {
      if (message.panelId !== 'dev-context') return
      focusClose()
      loadContext(true)
    })

    return unsubscribeShow
  }, [loadContext])

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-context-title"
      data-testid="dev-context-dialog"
      className="flex max-h-[min(640px,calc(100vh-96px))] w-[min(520px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/4 bg-background text-popover-foreground shadow-2xl ring-1 ring-black/40 duration-150 animate-in fade-in-0 zoom-in-95"
    >
      <header className="flex items-start justify-between gap-4 border-b border-white/4 bg-background px-4 py-4">
        <div className="min-w-0">
          <h1 id="dev-context-title" className="text-base font-semibold tracking-tight">
            Local project metadata
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Git context detected for the project serving this page.
          </p>
        </div>
        <Button
          ref={closeButtonRef}
          type="button"
          variant="ghost"
          size="icon-sm"
          className="-mr-1.5 -mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Close local project metadata"
          data-testid="dev-context-close"
          onClick={() => onAction({ type: 'close-panel' })}
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </Button>
      </header>

      {loading ? (
        <p className="px-4 py-6 text-xs text-muted-foreground" aria-live="polite">
          Reading workspace metadata…
        </p>
      ) : context ? (
        <dl className="space-y-2 px-4 py-5">
          <MetadataRow label="Project">
            <span className="font-medium">{projectName(context.repoPath)}</span>
          </MetadataRow>
          <MetadataRow label="Repository">
            <code className="block break-all text-[11px] text-muted-foreground">
              {context.repoPath}
            </code>
          </MetadataRow>
          <MetadataRow label="Branch">
            <code className="text-[11px]">{context.branch ?? 'Detached HEAD'}</code>
          </MetadataRow>
          <MetadataRow label="Commit">
            <code className="break-all text-[11px]">{context.commit ?? 'Unknown'}</code>
          </MetadataRow>
          <MetadataRow label="Working tree">
            <span className={context.dirty ? 'text-amber-300' : 'text-emerald-300'}>
              {context.dirty ? 'Uncommitted changes' : 'Clean'}
            </span>
          </MetadataRow>
        </dl>
      ) : (
        <div className="px-4 py-6">
          <p className="text-sm font-medium">No Git project detected</p>
          <p className="mt-1 max-w-[38ch] text-xs leading-5 text-muted-foreground">
            This page is running locally, but no repository was found from Audit Web Tools’ launch
            directory.
          </p>
        </div>
      )}
    </section>
  )
}
