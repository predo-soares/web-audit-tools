import { LaptopIcon, SmartPhone01Icon, Tablet01Icon } from '@hugeicons/core-free-icons'
import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../shared/sidebar'
import { DEVICE_CATALOG } from '../../../shared/device-catalog'
import type { CatalogEntry } from '../../../shared/device-catalog'
import type { PaneId } from '../../../shared/types'
import { useSidebar } from '@renderer/context/sidebar-context'
import { CANVAS_GLASS_SURFACE_CLASS } from '@renderer/lib/glass-surface'
import { cn } from '@renderer/lib/utils'
import { Icon } from '@renderer/components/ui/icon'

interface DevicesViewProps {
  selectedPresets: Partial<Record<PaneId, string>>
  onTogglePreset: (presetId: string) => void
  onClose: () => void
}

function CategoryIcon({ category }: { category: CatalogEntry['category'] }): React.JSX.Element {
  const icon =
    category === 'mobile' ? SmartPhone01Icon : category === 'tablet' ? Tablet01Icon : LaptopIcon
  return <Icon icon={icon} size={15} strokeWidth={1.5} className="shrink-0 opacity-70" />
}

const BRAND_ORDER = ['Apple', 'Samsung', 'Generic']

function groupByBrand(entries: CatalogEntry[]): Array<{ brand: string; entries: CatalogEntry[] }> {
  const map = new Map<string, CatalogEntry[]>()
  for (const entry of entries) {
    const list = map.get(entry.brand) ?? []
    list.push(entry)
    map.set(entry.brand, list)
  }
  return BRAND_ORDER.filter((b) => map.has(b)).map((b) => ({ brand: b, entries: map.get(b)! }))
}

const BRAND_GROUPS = groupByBrand(DEVICE_CATALOG)

export function DevicesView({
  selectedPresets,
  onTogglePreset,
  onClose,
}: DevicesViewProps): React.JSX.Element {
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const sidebarOffset = sidebarOpen || sidebarTransitioning ? SIDEBAR_WIDTH_PX : 0
  const visibleCount = Object.keys(selectedPresets).length

  return (
    <div
      data-testid="devices-view"
      className={cn(
        'absolute inset-0 z-10 box-border flex items-start justify-center overflow-y-auto',
        CANVAS_GLASS_SURFACE_CLASS
      )}
      style={{ paddingTop: TOOLBAR_HEIGHT_PX, paddingLeft: sidebarOffset }}
    >
      <div className="flex flex-col px-8 py-8">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Device presets
            </p>
            <h1 className="text-xl font-medium tracking-tight text-white">Choose devices</h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/50">
              Select the viewports you want to keep visible. Changes apply immediately to the
              preview canvas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Back to preview
          </button>
        </div>

        <div className="flex items-start gap-5">
          {BRAND_GROUPS.map(({ brand, entries }) => (
            <div key={brand} className="flex min-w-[220px] flex-col gap-3">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-white/45">
                {brand}
              </p>
              <div className="flex flex-col gap-2">
                {entries.map((entry) => {
                  const paneActive = selectedPresets[entry.paneId] !== undefined
                  const thisActive = selectedPresets[entry.paneId] === entry.presetId
                  const isLastVisible = thisActive && visibleCount === 1
                  return (
                    <button
                      key={entry.presetId}
                      type="button"
                      data-testid={`device-tab-${entry.presetId}`}
                      aria-pressed={thisActive}
                      disabled={isLastVisible}
                      onClick={() => onTogglePreset(entry.presetId)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                        thisActive
                          ? 'border-white/40 bg-white/15 text-white'
                          : paneActive
                            ? 'border-white/10 bg-transparent text-white/30 hover:bg-white/5 hover:text-white/50'
                            : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70',
                        isLastVisible && 'cursor-not-allowed opacity-40'
                      )}
                    >
                      <CategoryIcon category={entry.category} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-medium leading-tight">{entry.name}</span>
                        <span className="text-[11px] tabular-nums leading-tight text-white/35">
                          {entry.width}×{entry.height}
                        </span>
                      </div>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none',
                          thisActive
                            ? 'bg-white text-black'
                            : 'border border-white/15 text-transparent'
                        )}
                      >
                        ✓
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
