import {
  ArrowLeft01Icon,
  LaptopIcon,
  SmartPhone01Icon,
  Tablet01Icon
} from '@hugeicons/core-free-icons'
import { SIDEBAR_WIDTH_PX } from '../../../shared/sidebar'
import { DEVICE_CATALOG } from '../../../shared/device-catalog'
import type { CatalogEntry } from '../../../shared/device-catalog'
import type { PaneId } from '../../../shared/types'
import { useSidebar } from '@renderer/context/sidebar-context'
import { DeviceFrame } from '@renderer/components/device-frame'
import { Carousel, CarouselContent, CarouselItem } from '@renderer/components/ui/carousel'
import { CANVAS_GLASS_SURFACE_CLASS } from '@renderer/lib/glass-surface'
import { cn } from '@renderer/lib/utils'
import { Icon } from '@renderer/components/ui/icon'

interface DevicesViewProps {
  selectedPresets: Partial<Record<PaneId, string>>
  onTogglePreset: (presetId: string) => void
  onClose: () => void
}

const DEVICE_TYPE_ORDER: CatalogEntry['category'][] = ['mobile', 'tablet', 'desktop']

const DEVICE_TYPE_LABELS: Record<CatalogEntry['category'], string> = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Desktop'
}

function CategoryIcon({ category }: { category: CatalogEntry['category'] }): React.JSX.Element {
  const icon =
    category === 'mobile' ? SmartPhone01Icon : category === 'tablet' ? Tablet01Icon : LaptopIcon
  return <Icon icon={icon} size={17} strokeWidth={1.5} className="shrink-0 opacity-70" />
}

function groupByCategory(
  entries: CatalogEntry[]
): Array<{ category: CatalogEntry['category']; entries: CatalogEntry[] }> {
  const map = new Map<CatalogEntry['category'], CatalogEntry[]>()
  for (const entry of entries) {
    const list = map.get(entry.category) ?? []
    list.push(entry)
    map.set(entry.category, list)
  }

  return DEVICE_TYPE_ORDER.map((category) => ({
    category,
    entries: map.get(category) ?? []
  }))
}

const DEVICE_GROUPS = groupByCategory(DEVICE_CATALOG)

function getDeviceDetails(entry: CatalogEntry): string {
  const orientation = entry.width > entry.height ? 'Landscape' : 'Portrait'
  return `${entry.width}×${entry.height} · ${entry.deviceScaleFactor}× · ${entry.touch ? 'Touch' : 'Pointer'} · ${orientation}`
}

interface DevicePresetCardProps {
  entry: CatalogEntry
  selectedPresets: Partial<Record<PaneId, string>>
  visibleCount: number
  onTogglePreset: (presetId: string) => void
}

function DevicePresetCard({
  entry,
  selectedPresets,
  visibleCount,
  onTogglePreset
}: DevicePresetCardProps): React.JSX.Element {
  const paneActive = selectedPresets[entry.paneId] !== undefined
  const thisActive = selectedPresets[entry.paneId] === entry.presetId
  const isLastVisible = thisActive && visibleCount === 1

  return (
    <button
      type="button"
      data-testid={`device-tab-${entry.presetId}`}
      aria-pressed={thisActive}
      aria-label={
        thisActive
          ? `${entry.name}, selected`
          : paneActive
            ? `Switch to ${entry.name}`
            : `Add ${entry.name}`
      }
      title={
        thisActive
          ? isLastVisible
            ? 'Keep at least one device active'
            : `Remove ${entry.name}`
          : paneActive
            ? `Switch to ${entry.name}`
            : `Add ${entry.name}`
      }
      disabled={isLastVisible}
      onClick={() => onTogglePreset(entry.presetId)}
      className={cn(
        'group flex shrink-0 flex-col items-start gap-3 rounded-xl border p-3 text-left transition-[transform,background-color,border-color,box-shadow,opacity] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        thisActive
          ? 'border-white/45 bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
          : paneActive
            ? 'border-white/10 bg-white/[0.03] opacity-65 hover:border-white/20 hover:bg-white/[0.06] hover:opacity-100'
            : 'border-white/10 bg-white/[0.05] hover:border-white/20 hover:bg-white/[0.1]',
        isLastVisible && 'cursor-not-allowed opacity-45'
      )}
    >
      <DeviceFrame
        paneId={entry.paneId}
        profile={entry}
        scale={0.25}
        showDynamicIsland={entry.paneId === 'iphone'}
      >
        <div className="h-full w-full bg-gradient-to-b from-zinc-800/60 via-zinc-950 to-black" />
      </DeviceFrame>

      <div className="flex w-full min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white/90">{entry.name}</p>
          <p className="mt-1 whitespace-nowrap text-[10px] leading-tight text-white/45">
            {getDeviceDetails(entry)}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
            {entry.brand}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none',
            thisActive ? 'bg-white text-black' : 'border border-white/15 text-transparent'
          )}
        >
          ✓
        </span>
      </div>
    </button>
  )
}

export function DevicesView({
  selectedPresets,
  onTogglePreset,
  onClose
}: DevicesViewProps): React.JSX.Element {
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const sidebarOffset = sidebarOpen || sidebarTransitioning ? SIDEBAR_WIDTH_PX : 0
  const visibleCount = Object.keys(selectedPresets).length

  return (
    <div
      data-testid="devices-view"
      className={cn(
        'absolute inset-0 z-10 box-border overflow-y-auto text-foreground',
        CANVAS_GLASS_SURFACE_CLASS
      )}
      style={{ paddingTop: TOOLBAR_HEIGHT_PX, paddingLeft: sidebarOffset }}
    >
      <nav
        aria-label="Breadcrumb"
        className="absolute z-20"
        style={{ top: TOOLBAR_HEIGHT_PX + 24, left: sidebarOffset + 24 }}
      >
        <button
          type="button"
          onClick={onClose}
          className="group inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm text-white/55 transition-[color,background-color] duration-150 ease-out hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
        >
          <Icon
            icon={ArrowLeft01Icon}
            size={16}
            className="transition-transform duration-150 ease-out group-hover:-translate-x-0.5"
          />
          <span>Preview</span>
          <span className="text-white/20">/</span>
          <span className="text-white/90">Devices</span>
        </button>
      </nav>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-8 pb-8 pt-24">
        {DEVICE_GROUPS.map(({ category, entries }) => {
          const activeEntry = entries.find(
            (entry) => selectedPresets[entry.paneId] === entry.presetId
          )

          return (
            <section key={category} aria-labelledby={`device-type-${category}`}>
              <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <CategoryIcon category={category} />
                  <h2
                    id={`device-type-${category}`}
                    className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75"
                  >
                    {DEVICE_TYPE_LABELS[category]}
                  </h2>
                </div>
                {activeEntry ? (
                  <span className="inline-flex max-w-[50%] items-center gap-2 truncate rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs text-white/70">
                    <span className="size-1.5 shrink-0 rounded-full bg-white" />
                    <span className="truncate">{activeEntry.name}</span>
                  </span>
                ) : (
                  <span className="text-xs text-white/30">Not active</span>
                )}
              </div>

              <Carousel
                aria-label={`${DEVICE_TYPE_LABELS[category]} device presets`}
                opts={{ align: 'start', dragFree: true }}
                className="-mx-8 px-8"
              >
                <CarouselContent className="-ml-5">
                  {entries.map((entry) => (
                    <CarouselItem key={entry.presetId} className="basis-auto pl-5">
                      <DevicePresetCard
                        entry={entry}
                        selectedPresets={selectedPresets}
                        visibleCount={visibleCount}
                        onTogglePreset={onTogglePreset}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            </section>
          )
        })}
      </div>
    </div>
  )
}
