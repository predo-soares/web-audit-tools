import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../shared/sidebar'
import { DEVICE_CATALOG } from '../../../shared/device-catalog'
import type { PaneId } from '../../../shared/types'
import { useSidebar } from '@renderer/context/sidebar-context'
import { cn } from '@renderer/lib/utils'

const MOBILE = DEVICE_CATALOG.filter((e) => e.category === 'mobile')
const TABLET = DEVICE_CATALOG.filter((e) => e.category === 'tablet')
const DESKTOP = DEVICE_CATALOG.filter((e) => e.category === 'desktop')

interface DevicesViewProps {
  selectedPresets: Partial<Record<PaneId, string>>
  onTogglePreset: (presetId: string) => void
  onClose: () => void
}

export function DevicesView({
  selectedPresets,
  onTogglePreset
}: DevicesViewProps): React.JSX.Element {
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const sidebarOffset = sidebarOpen || sidebarTransitioning ? SIDEBAR_WIDTH_PX : 0
  const visibleCount = Object.keys(selectedPresets).length

  return (
    <div
      data-testid="devices-view"
      className="absolute inset-0 z-10 flex items-center justify-center bg-transparent"
      style={{ top: TOOLBAR_HEIGHT_PX, left: sidebarOffset }}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Three category columns */}
        <div className="flex items-start gap-8">
          {[
            { label: 'Mobile', entries: MOBILE },
            { label: 'Tablet', entries: TABLET },
            { label: 'Desktop', entries: DESKTOP },
          ].map(({ label, entries }) => (
            <div key={label} className="flex flex-col gap-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                {label}
              </p>
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
                      'flex items-center justify-between gap-6 rounded-md border px-3 py-2 text-left transition-colors',
                      thisActive
                        ? 'border-white/25 bg-white/15 text-white'
                        : paneActive
                          ? 'border-white/10 bg-transparent text-white/30 hover:bg-white/5 hover:text-white/50'
                          : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70',
                      isLastVisible && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    <span className="text-sm font-medium">{entry.name}</span>
                    <span className="text-[11px] tabular-nums text-white/40">
                      {entry.width}×{entry.height}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
