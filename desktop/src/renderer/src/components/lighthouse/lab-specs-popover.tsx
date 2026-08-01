import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { UnfoldMoreIcon } from '@hugeicons/core-free-icons'
import type { LighthouseLabSelection } from '../../../../shared/lighthouse'
import { Icon } from '@renderer/components/ui/icon'
import { LabSpecsPicker } from './lab-specs-picker'

// The lab-specs equivalent of the SEO intent select: a group-fitting trigger in
// the target bar that opens the mobile/desktop device + network pickers.
export function LabSpecsPopover({
  selection,
  disabled,
  onChange
}: {
  selection: LighthouseLabSelection
  disabled?: boolean
  onChange: (next: LighthouseLabSelection) => void
}): React.JSX.Element {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        data-testid="lighthouse-lab-specs"
        aria-label="Lab specs"
        disabled={disabled}
        className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-none border-y-0 border-r-0 border-l border-l-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 data-[popup-open]:bg-white/5"
      >
        Lab specs
        <Icon aria-hidden icon={UnfoldMoreIcon} className="size-4 text-muted-foreground" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup className="origin-(--transform-origin) rounded-lg border border-white/10 bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <LabSpecsPicker selection={selection} disabled={disabled} onChange={onChange} />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
