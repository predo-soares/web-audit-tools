import { useEffect, useState } from 'react'
import { ServerStack01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import type { McpServerStatus } from '../../../shared/mcp-status'
import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../shared/sidebar'
import { useSidebar } from '@renderer/context/sidebar-context'
import { CANVAS_GLASS_SURFACE_CLASS } from '@renderer/lib/glass-surface'
import { Icon } from '@renderer/components/ui/icon'
import { CopyButton } from '@renderer/components/seo/copy-button'
import { cn } from '@renderer/lib/utils'

const STATUS_META: Record<McpServerStatus['state'], { label: string; dot: string; text: string }> =
  {
    starting: { label: 'Starting', dot: 'bg-amber-400', text: 'text-amber-300' },
    listening: { label: 'Running', dot: 'bg-emerald-400', text: 'text-emerald-300' },
    error: { label: 'Error', dot: 'bg-destructive', text: 'text-destructive' }
  }

export function SettingsView(): React.JSX.Element {
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const sidebarOffset = sidebarOpen || sidebarTransitioning ? SIDEBAR_WIDTH_PX : 0
  const [status, setStatus] = useState<McpServerStatus>({ state: 'starting' })

  useEffect(() => {
    void window.api.getMcpStatus().then(setStatus)
    const stop = window.api.onMcpStatus(setStatus)
    return stop
  }, [])

  const meta = STATUS_META[status.state]

  return (
    <div
      data-testid="settings-view"
      className={cn(
        'absolute inset-0 z-10 box-border overflow-y-auto text-foreground',
        CANVAS_GLASS_SURFACE_CLASS
      )}
      style={{ paddingTop: TOOLBAR_HEIGHT_PX, paddingLeft: sidebarOffset }}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-8 py-8">
        <header className="space-y-2 px-2">
          <h1 className="text-3xl font-normal tracking-tight text-white">Settings</h1>
          <p className="text-base text-white/45">
            Connection details for the tools that expose these panes to agents.
          </p>
        </header>

        <section className="rounded-xl border border-white/10 bg-black/40 px-5 py-4 backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70">
                <Icon icon={ServerStack01Icon} size={18} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight text-white">MCP Server</h2>
                <p className="mt-0.5 text-xs text-white/45">
                  Loopback-only Model Context Protocol endpoint.
                </p>
              </div>
            </div>
            <div
              data-testid="mcp-status-badge"
              className={cn(
                'flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium',
                meta.text
              )}
            >
              <span className={cn('size-1.5 rounded-full', meta.dot)} />
              {meta.label}
            </div>
          </div>

          {status.state === 'listening' ? (
            <dl className="mt-4 flex flex-col gap-2.5 border-t border-white/10 pt-4">
              <Row label="Endpoint">
                <div className="flex min-w-0 items-center gap-2">
                  <code className="truncate font-mono text-xs text-white/80" title={status.url}>
                    {status.url}
                  </code>
                  <CopyButton
                    label="Copy MCP endpoint URL"
                    testId="mcp-copy-url"
                    onCopy={() => void navigator.clipboard.writeText(status.url)}
                  />
                </div>
              </Row>
              <Row label="Host">
                <span className="font-mono text-xs text-white/80">
                  {status.host}:{status.port}
                </span>
              </Row>
              <Row label="Tools">
                <span className="text-xs text-white/80">{status.tools.length} registered</span>
              </Row>
            </dl>
          ) : status.state === 'error' ? (
            <p role="alert" className="mt-4 border-t border-white/10 pt-4 text-xs text-destructive">
              {status.message}
            </p>
          ) : (
            <p className="mt-4 border-t border-white/10 pt-4 text-xs text-white/40">
              Waiting for the MCP server to bind…
            </p>
          )}
        </section>

        {status.state === 'listening' ? (
          <section className="rounded-xl border border-white/10 bg-black/40 px-5 py-4 backdrop-blur-md">
            <h2 className="text-sm font-semibold tracking-tight text-white">Available tools</h2>
            <ul className="mt-3 flex flex-col divide-y divide-white/5">
              {status.tools.map((tool) => (
                <li key={tool.name} className="flex items-center gap-3 py-2">
                  <Icon
                    icon={Tick02Icon}
                    size={13}
                    className="shrink-0 text-emerald-400/80"
                    strokeWidth={2}
                  />
                  <code className="font-mono text-xs text-white/85">{tool.name}</code>
                  <span className="truncate text-xs text-white/40">{tool.title}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-xs text-white/40">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
