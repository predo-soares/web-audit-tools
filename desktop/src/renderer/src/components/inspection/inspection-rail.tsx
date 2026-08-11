import { AlertCircleIcon, Cancel01Icon } from '@hugeicons/core-free-icons'
import type { InspectionRecord } from '../../../../shared/inspection'
import { formatInspectionStatus, getInspectionDifferences } from '../../../../shared/inspection'
import { InspectionBoxModel } from '@renderer/components/inspection/inspection-box-model'
import { InspectionMarkupTree } from '@renderer/components/inspection/inspection-markup-tree'
import { Icon } from '@renderer/components/ui/icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'

interface InspectionRailProps {
  record: InspectionRecord
  records: InspectionRecord[]
  onClose: () => void
}

function selectedClassName(record: InspectionRecord): string | null {
  const classAttribute = record.snapshot?.markup.attributes?.find(
    (attribute) => attribute.name === 'class'
  )
  return classAttribute?.value.trim() || null
}

function formatClassSelector(value: string | null): string {
  if (!value) return ''
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => `.${name}`)
    .join(' ')
}

function EmptyPaneView({ record }: { record: InspectionRecord }): React.JSX.Element {
  return (
    <div
      className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-white/[0.02] px-6 text-center"
      data-testid={`inspection-empty-${record.paneId}`}
    >
      <Icon icon={AlertCircleIcon} size={18} className="text-zinc-600" />
      <p className="text-xs text-zinc-400">
        {record.status === 'not-found'
          ? 'This element was not found in this pane.'
          : `${formatInspectionStatus(record.status)} in this pane.`}
      </p>
      <p className="text-[10px] text-zinc-600">Try selecting the pane icon above.</p>
    </div>
  )
}

function DifferenceStrip({ records }: { records: InspectionRecord[] }): React.JSX.Element | null {
  const differences = getInspectionDifferences(records)
  if (!differences.length) return null

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3 text-[10px]"
      data-testid="inspection-differences"
    >
      <span className="mr-1 text-zinc-600">Differs</span>
      {differences.map((difference) => (
        <span
          key={`${difference.category}-${difference.key}`}
          data-testid={`inspection-difference-${difference.key}`}
          className="rounded bg-amber-300/[0.08] px-1.5 py-1 text-amber-200/80"
          title={`Source: ${difference.sourceValue}`}
        >
          {difference.label}
        </span>
      ))}
    </div>
  )
}

export function InspectionRail({
  record,
  records,
  onClose
}: InspectionRailProps): React.JSX.Element {
  const activeRecord = record
  const className = selectedClassName(record)
  const classSelector = formatClassSelector(className)

  return (
    <aside
      id="inspection-rail"
      aria-label="Inspection details"
      data-testid="inspection-rail"
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-background text-foreground"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">
            Inspecting
          </p>
          <h2
            className="mt-1 truncate font-mono text-sm text-zinc-100"
            data-testid="inspection-subheader"
            title={className ? `class="${className}"` : undefined}
          >
            <span className="text-sky-300">&lt;{record.target.descriptor.tagName}&gt;</span>
            {classSelector ? <span className="ml-2 text-violet-300">{classSelector}</span> : null}
          </h2>
        </div>
        <Tooltip>
          <TooltipTrigger
            type="button"
            aria-label="Close inspection"
            data-testid="inspection-close"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 outline-none transition-colors hover:bg-white/[0.08] hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-ring"
            onClick={onClose}
          >
            <Icon icon={Cancel01Icon} size={15} />
          </TooltipTrigger>
          <TooltipContent side="top">Exit inspect mode</TooltipContent>
        </Tooltip>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-xs">
        {activeRecord.snapshot ? (
          <div className="space-y-4">
            <section
              aria-labelledby="inspection-markup-heading"
              data-testid={`inspection-markup-${activeRecord.paneId}`}
              className="space-y-2"
            >
              <h3
                id="inspection-markup-heading"
                className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500"
              >
                Markup
              </h3>
              <div className="max-h-[320px] overflow-auto" data-testid="inspection-markup-section">
                <InspectionMarkupTree
                  key={`${activeRecord.paneId}-${activeRecord.snapshot.capturedAt}`}
                  node={activeRecord.snapshot.markup}
                  onLoadChildren={(nodeId) =>
                    window.panelApi.loadInspectionMarkupChildren(activeRecord.paneId, nodeId)
                  }
                />
              </div>
            </section>
            <section
              aria-labelledby="inspection-box-model-heading"
              className="space-y-2 border-t border-white/10 pt-4"
            >
              <h3
                id="inspection-box-model-heading"
                className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500"
              >
                Box model
              </h3>
              <InspectionBoxModel snapshot={activeRecord.snapshot} />
            </section>
            <DifferenceStrip records={records} />
          </div>
        ) : (
          <EmptyPaneView record={activeRecord} />
        )}
      </div>
    </aside>
  )
}
