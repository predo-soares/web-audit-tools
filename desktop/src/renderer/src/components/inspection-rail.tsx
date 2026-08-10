import type { InspectionRecord } from '../../../shared/inspection'
import { formatInspectionIdentity, formatInspectionStatus } from '../../../shared/inspection'
import { Button } from '@renderer/components/ui/button'

interface InspectionRailProps {
  record: InspectionRecord
  records: InspectionRecord[]
  onClose: () => void
}

export function InspectionRail({
  record,
  records,
  onClose
}: InspectionRailProps): React.JSX.Element {
  const descriptor = record.target.descriptor

  return (
    <aside
      id="inspection-rail"
      aria-label="Inspection rail"
      data-testid="inspection-rail"
      className="flex h-full min-h-0 w-[360px] shrink-0 flex-col border-l border-white/10 bg-zinc-950/90 text-zinc-100 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            Inspection
          </p>
          <h2 className="mt-1 truncate font-mono text-sm text-zinc-100">
            &lt;{descriptor.tagName}&gt;
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="tiny"
          aria-label="Close inspection rail"
          data-testid="inspection-close"
          onClick={onClose}
        >
          Close
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-xs">
        <section className="space-y-2" aria-labelledby="inspection-overview-heading">
          <h3
            id="inspection-overview-heading"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500"
          >
            Overview
          </h3>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">Status</span>
              <span data-testid="inspection-status" className="font-medium text-amber-300">
                {formatInspectionStatus(record.status)}
              </span>
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <span className="text-zinc-400">Identity</span>
              <span
                className="max-w-[220px] truncate text-right font-mono text-zinc-200"
                title={formatInspectionIdentity(record.target)}
              >
                {formatInspectionIdentity(record.target)}
              </span>
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <span className="text-zinc-400">Label</span>
              <span className="max-w-[220px] truncate text-right text-zinc-200">
                {descriptor.accessibleName ?? descriptor.visibleText ?? '—'}
              </span>
            </div>
          </div>
        </section>

        <section className="space-y-2" aria-labelledby="inspection-source-heading">
          <h3
            id="inspection-source-heading"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500"
          >
            Source pane
          </h3>
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-zinc-300">
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Device</span>
              <span>{record.device.preset}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Viewport</span>
              <span>
                {record.device.viewport.width} × {record.device.viewport.height} @{' '}
                {record.device.dpr}x
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Touch</span>
              <span>{record.device.touch ? 'Supported' : 'Not supported'}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-zinc-500">URL</span>
              <span
                className="max-w-[220px] truncate text-right font-mono"
                title={record.device.url}
              >
                {record.device.url || 'Unavailable'}
              </span>
            </div>
          </div>
        </section>

        <section className="space-y-2" aria-labelledby="inspection-comparison-heading">
          <h3
            id="inspection-comparison-heading"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500"
          >
            Visible panes
          </h3>
          <div className="space-y-2">
            {records.map((paneRecord) => (
              <div
                key={paneRecord.paneId}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
                data-testid={`inspection-result-${paneRecord.paneId}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-zinc-200">{paneRecord.device.preset}</p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {paneRecord.source
                      ? 'Source pane'
                      : (paneRecord.provenance ?? 'Independent comparison')}
                  </p>
                </div>
                <span className="shrink-0 font-medium text-zinc-300">
                  {formatInspectionStatus(paneRecord.status)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {record.snapshot ? (
          <section className="space-y-2" aria-labelledby="inspection-geometry-heading">
            <h3
              id="inspection-geometry-heading"
              className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500"
            >
              Selection
            </h3>
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-zinc-300">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Geometry</span>
                <span className="font-mono">
                  {Math.round(record.snapshot.geometry.width)} ×{' '}
                  {Math.round(record.snapshot.geometry.height)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Visibility</span>
                <span>{record.snapshot.visibility.visible ? 'Visible' : 'Not visible'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Selector</span>
                <span
                  className="max-w-[220px] truncate text-right font-mono"
                  title={record.snapshot.selector ?? record.snapshot.domPath ?? 'Unavailable'}
                >
                  {record.snapshot.selector ?? record.snapshot.domPath ?? 'Unavailable'}
                </span>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  )
}
