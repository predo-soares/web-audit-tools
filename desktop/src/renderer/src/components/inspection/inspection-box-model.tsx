import { useMemo, useState } from 'react'
import type { InspectionBoxModel, InspectionPageSnapshot } from '../../../../shared/inspection'
import { cn } from '@renderer/lib/utils'

type BoxSideValues = InspectionBoxModel['margin']

interface BoxLayerProps {
  label: string
  values: BoxSideValues
  className: string
  children: React.ReactNode
}

function formatBoxValue(value: string): string {
  const numeric = Number.parseFloat(value)
  if (!Number.isNaN(numeric)) return String(Math.round(numeric))
  return value || '—'
}

function BoxLayer({ label, values, className, children }: BoxLayerProps): React.JSX.Element {
  return (
    <div className={cn('relative border', className)}>
      <span className="absolute left-2 top-1 text-[9px] font-medium tracking-wide text-white/55">
        {label}
      </span>
      <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[9px] text-white/55">
        {formatBoxValue(values.top)}
      </span>
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-white/55">
        {formatBoxValue(values.bottom)}
      </span>
      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-white/55">
        {formatBoxValue(values.left)}
      </span>
      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-white/55">
        {formatBoxValue(values.right)}
      </span>
      {children}
    </div>
  )
}

function BoxLegend(): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 bg-amber-300/45" aria-hidden="true" />
        margin
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 bg-orange-300/55" aria-hidden="true" />
        border
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 bg-emerald-300/45" aria-hidden="true" />
        padding
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 bg-sky-300/60" aria-hidden="true" />
        content
      </span>
    </div>
  )
}

export function InspectionBoxModel({
  snapshot
}: {
  snapshot: InspectionPageSnapshot
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const model = snapshot.boxModel
  const contentWidth =
    model.content.width === 'auto'
      ? `${Math.round(snapshot.geometry.width)}px`
      : model.content.width
  const contentHeight =
    model.content.height === 'auto'
      ? `${Math.round(snapshot.geometry.height)}px`
      : model.content.height
  const properties = useMemo(() => {
    const fallbackProperties = [
      { name: 'display', value: snapshot.layout.display },
      { name: 'position', value: snapshot.layout.position },
      { name: 'width', value: snapshot.layout.width },
      { name: 'height', value: snapshot.layout.height },
      { name: 'overflow', value: snapshot.layout.overflow },
      { name: 'flex', value: snapshot.layout.flex ?? 'none' },
      { name: 'grid', value: snapshot.layout.grid ?? 'none' },
      { name: 'margin', value: snapshot.styles.margin },
      { name: 'padding', value: snapshot.styles.padding },
      { name: 'color', value: snapshot.styles.color },
      { name: 'background-color', value: snapshot.styles.background },
      { name: 'font', value: snapshot.styles.font },
      { name: 'font-size', value: snapshot.styles.fontSize },
      { name: 'line-height', value: snapshot.styles.lineHeight },
      { name: 'font-weight', value: snapshot.styles.fontWeight },
      { name: 'z-index', value: snapshot.styles.zIndex },
      { name: 'min-width', value: snapshot.styles.minWidth },
      { name: 'max-width', value: snapshot.styles.maxWidth },
      { name: 'min-height', value: snapshot.styles.minHeight },
      { name: 'max-height', value: snapshot.styles.maxHeight },
      { name: 'box-sizing', value: snapshot.boxModel.boxSizing }
    ].map((property) => ({ ...property, isAuthored: true }))
    const sourceProperties = snapshot.styles.computedProperties ?? fallbackProperties

    return [...sourceProperties].sort(
      (first, second) => Number(second.isAuthored !== false) - Number(first.isAuthored !== false)
    )
  }, [snapshot])
  const visibleProperties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return properties
    return properties.filter(({ name, value }) =>
      `${name} ${value}`.toLowerCase().includes(normalizedQuery)
    )
  }, [properties, query])

  return (
    <div className="space-y-3" data-testid="inspection-box-model">
      <BoxLegend />
      <div className="py-3">
        <div className="mx-auto flex min-h-[190px] max-w-[280px] items-center justify-center">
          <BoxLayer
            label="margin"
            values={model.margin}
            className="w-full bg-amber-300/[0.18] px-8 py-8 text-center"
          >
            <BoxLayer
              label="border"
              values={model.border}
              className="bg-orange-200/[0.18] px-6 py-6"
            >
              <BoxLayer
                label="padding"
                values={model.padding}
                className="bg-emerald-300/[0.18] px-5 py-5"
              >
                <div className="flex min-h-10 items-center justify-center border border-sky-200/70 bg-sky-300/[0.55] px-2 py-2 font-mono text-[10px] text-sky-50 shadow-[0_0_16px_rgba(125,211,252,0.08)]">
                  {formatBoxValue(contentWidth)} × {formatBoxValue(contentHeight)}
                </div>
              </BoxLayer>
            </BoxLayer>
          </BoxLayer>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-[10px] text-zinc-600">
        <span>box-sizing: {model.boxSizing}</span>
        <span>
          {Math.round(snapshot.geometry.width)} × {Math.round(snapshot.geometry.height)} rendered
        </span>
      </div>
      <section className="space-y-2" data-testid="inspection-computed-properties">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            Computed properties
          </h3>
          <span className="font-mono text-[10px] text-zinc-600">{visibleProperties.length}</span>
        </div>
        <input
          type="search"
          value={query}
          aria-label="Filter computed properties"
          data-testid="inspection-computed-filter"
          placeholder="Filter properties"
          className="h-7 w-full border border-white/10 bg-black/20 px-2 font-mono text-[11px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-sky-300/50 focus:ring-1 focus:ring-sky-300/20"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div
          className="max-h-[320px] overflow-y-auto"
          data-testid="inspection-computed-properties-list"
        >
          {visibleProperties.length ? (
            visibleProperties.map(({ name, value, isAuthored }) => {
              const authored = isAuthored !== false
              return (
                <div
                  key={name}
                  data-authored={authored}
                  data-testid={`inspection-computed-property-${name}`}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)] gap-3 px-2 py-1.5 font-mono text-[11px] leading-snug"
                >
                  <span
                    className={cn('truncate', authored ? 'text-sky-300/80' : 'text-zinc-600')}
                    title={name}
                  >
                    {name}
                  </span>
                  <span className={cn('break-words', authored ? 'text-zinc-300' : 'text-zinc-600')}>
                    {value || '—'}
                  </span>
                </div>
              )
            })
          ) : (
            <p className="px-2 py-3 text-[11px] text-zinc-600">No matching properties</p>
          )}
        </div>
      </section>
    </div>
  )
}
