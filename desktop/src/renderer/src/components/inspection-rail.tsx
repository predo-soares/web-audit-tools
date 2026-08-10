import type { InspectionRecord } from '../../../shared/inspection'
import {
  formatInspectionIdentity,
  formatInspectionStatus,
  getInspectionDifferences
} from '../../../shared/inspection'
import { Button } from '@renderer/components/ui/button'

interface InspectionRailProps {
  record: InspectionRecord
  records: InspectionRecord[]
  onClose: () => void
}

function CopyValue({ value, label }: { value: string; label: string }): React.JSX.Element {
  const copy = (): void => {
    if (!value || value === '—') return
    void navigator.clipboard?.writeText(value)
  }

  return (
    <button
      type="button"
      className="block max-w-[220px] truncate text-right font-mono text-zinc-200 underline decoration-dotted underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      title={`${label}: ${value}`}
      aria-label={`Copy ${label}`}
      onClick={copy}
    >
      {value}
    </button>
  )
}

export function InspectionRail({
  record,
  records,
  onClose
}: InspectionRailProps): React.JSX.Element {
  const descriptor = record.target.descriptor
  const differences = getInspectionDifferences(records)

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
              <CopyValue value={formatInspectionIdentity(record.target)} label="identity" />
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <span className="text-zinc-400">Label</span>
              <CopyValue
                value={descriptor.accessibleName ?? descriptor.visibleText ?? '—'}
                label="readable label"
              />
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
              <CopyValue value={record.device.url || 'Unavailable'} label="source URL" />
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
                  {Math.round(record.snapshot.geometry.height)} at{' '}
                  {Math.round(record.snapshot.geometry.x)}, {Math.round(record.snapshot.geometry.y)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Visibility</span>
                <span>{record.snapshot.visibility.visible ? 'Visible' : 'Not visible'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Selector</span>
                <CopyValue
                  value={record.snapshot.selector ?? record.snapshot.domPath ?? 'Unavailable'}
                  label="selector or DOM path"
                />
              </div>
            </div>
          </section>
        ) : null}

        <section className="space-y-2" aria-labelledby="inspection-evidence-heading">
          <h3
            id="inspection-evidence-heading"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500"
          >
            Evidence
          </h3>
          <div className="space-y-3">
            {records
              .filter((paneRecord) => paneRecord.snapshot)
              .map((paneRecord) => {
                const snapshot = paneRecord.snapshot!
                return (
                  <div
                    key={`${paneRecord.paneId}-evidence`}
                    className="space-y-2 rounded-lg border border-white/10 bg-white/[0.04] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-zinc-200">{paneRecord.device.preset}</span>
                      <span className="max-w-[180px] truncate text-right text-zinc-500">
                        {paneRecord.device.viewport.width} × {paneRecord.device.viewport.height} @{' '}
                        {paneRecord.device.dpr}x · {paneRecord.device.touch ? 'touch' : 'pointer'}
                      </span>
                    </div>
                    <p className="truncate text-[10px] text-zinc-600" title={paneRecord.device.url}>
                      {paneRecord.device.url} · observed{' '}
                      {new Date(paneRecord.device.capturedAt).toISOString()}
                    </p>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                      <span className="text-zinc-500">Visibility</span>
                      <CopyValue
                        value={`${snapshot.visibility.visible ? 'visible' : 'not visible'} / ${snapshot.visibility.clipped ? 'clipped' : 'not clipped'} / ${snapshot.visibility.offscreen ? 'offscreen' : 'onscreen'}`}
                        label={`${paneRecord.paneId} visibility`}
                      />
                      <span className="text-zinc-500">Layout</span>
                      <CopyValue
                        value={`${snapshot.layout.display} / ${snapshot.layout.position} / ${snapshot.layout.width} × ${snapshot.layout.height}`}
                        label={`${paneRecord.paneId} layout`}
                      />
                      <span className="text-zinc-500">Overflow</span>
                      <CopyValue
                        value={snapshot.layout.overflow}
                        label={`${paneRecord.paneId} overflow`}
                      />
                      <span className="text-zinc-500">Spacing</span>
                      <CopyValue
                        value={`margin ${snapshot.styles.margin}; padding ${snapshot.styles.padding}`}
                        label={`${paneRecord.paneId} spacing`}
                      />
                      <span className="text-zinc-500">Typography</span>
                      <CopyValue
                        value={`${snapshot.styles.fontSize} / ${snapshot.styles.lineHeight} / ${snapshot.styles.fontWeight}`}
                        label={`${paneRecord.paneId} typography`}
                      />
                      <span className="text-zinc-500">Color</span>
                      <CopyValue
                        value={`${snapshot.styles.color} on ${snapshot.styles.background}`}
                        label={`${paneRecord.paneId} colors`}
                      />
                      <span className="text-zinc-500">Flex / grid</span>
                      <CopyValue
                        value={`${snapshot.layout.flex ?? 'none'} / ${snapshot.layout.grid ?? 'none'}`}
                        label={`${paneRecord.paneId} flex and grid`}
                      />
                      <span className="text-zinc-500">Z / sizing</span>
                      <CopyValue
                        value={`z ${snapshot.styles.zIndex}; min ${snapshot.styles.minWidth} × ${snapshot.styles.minHeight}; max ${snapshot.styles.maxWidth} × ${snapshot.styles.maxHeight}`}
                        label={`${paneRecord.paneId} z-index and sizing`}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </section>

        {differences.length ? (
          <section className="space-y-2" aria-labelledby="inspection-differences-heading">
            <h3
              id="inspection-differences-heading"
              className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500"
            >
              Differences from source
            </h3>
            <div className="space-y-2">
              {differences.map((difference) => (
                <div
                  key={`${difference.category}-${difference.key}`}
                  className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3"
                  data-testid={`inspection-difference-${difference.key}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="capitalize text-zinc-300">{difference.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-amber-200">
                      {difference.category} differs
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-zinc-400">
                    Source: {difference.sourceValue}
                  </p>
                  {difference.targetValues.map((targetValue) => (
                    <p key={targetValue.paneId} className="font-mono text-[11px] text-zinc-300">
                      {targetValue.paneId}: {targetValue.value}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  )
}
