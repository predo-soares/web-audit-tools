import { useCallback, useEffect, useState } from 'react'
import type {
  ApplicationBackgroundService,
  ApplicationData,
  ApplicationServiceWorker,
  ApplicationStorageItem
} from '../../../../../shared/application-data'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

function formatValue(value: string, masked: boolean): string {
  if (!masked) return value || ' empty'
  if (!value) return 'empty'
  return `${value.length} characters hidden`
}

function StorageList({
  title,
  items,
  masked = false
}: {
  title: string
  items: ApplicationStorageItem[]
  masked?: boolean
}): React.JSX.Element {
  return (
    <section className="border-b border-white/10 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-foreground">{title}</h2>
        <span className="text-[10px] tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No entries.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <div
              key={`${title}-${item.key}`}
              className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-2 rounded-md bg-white/[0.03] px-2 py-1.5 text-[11px]"
            >
              <code className="truncate text-sky-300" title={item.key}>
                {item.key}
              </code>
              <span
                className={cn('truncate text-right text-muted-foreground', masked && 'italic')}
                title={masked ? undefined : item.value}
              >
                {formatValue(item.value, masked)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function NameList({ title, items }: { title: string; items: string[] }): React.JSX.Element {
  return (
    <section className="border-b border-white/10 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-foreground">{title}</h2>
        <span className="text-[10px] tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No entries.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <code
              key={item}
              className="truncate rounded-md bg-white/[0.03] px-2 py-1.5 text-[11px] text-foreground/80"
              title={item}
            >
              {item}
            </code>
          ))}
        </div>
      )}
    </section>
  )
}

function ServiceWorkerList({
  workers
}: {
  workers: ApplicationServiceWorker[]
}): React.JSX.Element {
  return (
    <section className="border-b border-white/10 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-foreground">Service workers</h2>
        <span className="text-[10px] tabular-nums text-muted-foreground">{workers.length}</span>
      </div>
      {workers.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No registered service workers.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {workers.map((worker) => (
            <div
              key={`${worker.scope}-${worker.scriptUrl}`}
              className="rounded-md bg-white/[0.03] px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-medium text-foreground">{worker.state}</span>
                <span className="truncate text-muted-foreground" title={worker.scope}>
                  {worker.scope}
                </span>
              </div>
              <p
                className="mt-1 truncate font-mono text-[10px] text-muted-foreground"
                title={worker.scriptUrl}
              >
                {worker.scriptUrl || 'Script URL unavailable'}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function BackgroundServiceList({
  services
}: {
  services: ApplicationBackgroundService[]
}): React.JSX.Element {
  return (
    <section className="px-3 py-3">
      <h2 className="mb-2 text-xs font-medium text-foreground">Background services</h2>
      <div className="flex flex-col gap-1">
        {services.map((service) => (
          <div
            key={service.name}
            className="flex items-center justify-between gap-2 rounded-md bg-white/[0.03] px-2 py-1.5 text-[11px]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  service.available ? 'bg-emerald-400' : 'bg-white/25'
                )}
                aria-hidden
              />
              <span className="truncate text-foreground/90">{service.name}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {service.available ? service.detail : 'Unavailable'}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function ApplicationPanel(): React.JSX.Element {
  const [data, setData] = useState<ApplicationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setData(await window.panelApi.getApplicationData())
    } catch {
      setError('Application data is unavailable for this page.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void window.panelApi
      .getApplicationData()
      .then(setData)
      .catch(() => setError('Application data is unavailable for this page.'))
      .finally(() => setLoading(false))
    return window.panelApi.onPaneNavigation(() => void refresh())
  }, [refresh])

  return (
    <div data-testid="diagnostics-application" className="min-h-0 flex-1 overflow-y-auto font-sans">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-background/95 px-3 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-foreground">Application</h2>
            <p className="mt-1 truncate text-[10px] text-muted-foreground" title={data?.origin}>
              {data?.origin || 'Active page storage and background services'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="tiny"
            className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">Reading application data…</p>
      ) : error ? (
        <div className="flex flex-col items-start gap-2 px-3 py-4">
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button type="button" variant="soft" size="tiny" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ) : data ? (
        <>
          <StorageList title="Local storage" items={data.localStorage} />
          <StorageList title="Session storage" items={data.sessionStorage} />
          <StorageList title="Cookies" items={data.cookies} masked />
          <NameList title="IndexedDB" items={data.indexedDb} />
          <NameList title="Cache Storage" items={data.cacheStorage} />
          <ServiceWorkerList workers={data.serviceWorkers} />
          <BackgroundServiceList services={data.backgroundServices} />
        </>
      ) : null}
    </div>
  )
}
