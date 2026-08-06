import type {
  LighthouseDesktopDeviceId,
  LighthouseLabSelection,
  LighthouseMobileDeviceId,
  LighthouseNetworkId
} from '../../../../shared/lighthouse'
import {
  LIGHTHOUSE_DESKTOP_DEVICES,
  LIGHTHOUSE_MOBILE_DEVICES,
  LIGHTHOUSE_NETWORK_PRESETS
} from '../../../../shared/lighthouse'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Separator } from '@renderer/components/ui/separator'

function LabSpecSelect({
  label,
  value,
  options,
  disabled,
  onChange
}: {
  label: string
  value: string
  options: Array<{ id: string; label: string }>
  disabled?: boolean
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/35">
        {label}
      </span>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) => {
          if (nextValue !== null) onChange(nextValue)
        }}
      >
        <SelectTrigger size="sm" aria-label={label} className="h-8 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

export function LabSpecsPicker({
  selection,
  disabled,
  onChange
}: {
  selection: LighthouseLabSelection
  disabled?: boolean
  onChange: (next: LighthouseLabSelection) => void
}): React.JSX.Element {
  return (
    <div data-testid="lighthouse-lab-picker" className="grid gap-3 sm:w-[20rem]">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Mobile lab
        </p>
        <div className="flex flex-col gap-2">
          <LabSpecSelect
            label="Device"
            value={selection.mobileDeviceId}
            disabled={disabled}
            options={LIGHTHOUSE_MOBILE_DEVICES.map((device) => ({
              id: device.id,
              label: device.label
            }))}
            onChange={(value) =>
              onChange({
                ...selection,
                mobileDeviceId: value as LighthouseMobileDeviceId
              })
            }
          />
          <LabSpecSelect
            label="Network"
            value={selection.mobileNetworkId}
            disabled={disabled}
            options={LIGHTHOUSE_NETWORK_PRESETS.map((network) => ({
              id: network.id,
              label: network.shortLabel
            }))}
            onChange={(value) =>
              onChange({
                ...selection,
                mobileNetworkId: value as LighthouseNetworkId
              })
            }
          />
        </div>
      </div>
      <Separator />
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Desktop lab
        </p>
        <div className="flex flex-col gap-2">
          <LabSpecSelect
            label="Device"
            value={selection.desktopDeviceId}
            disabled={disabled}
            options={LIGHTHOUSE_DESKTOP_DEVICES.map((device) => ({
              id: device.id,
              label: device.label
            }))}
            onChange={(value) =>
              onChange({
                ...selection,
                desktopDeviceId: value as LighthouseDesktopDeviceId
              })
            }
          />
          <LabSpecSelect
            label="Network"
            value={selection.desktopNetworkId}
            disabled={disabled}
            options={LIGHTHOUSE_NETWORK_PRESETS.map((network) => ({
              id: network.id,
              label: network.shortLabel
            }))}
            onChange={(value) =>
              onChange({
                ...selection,
                desktopNetworkId: value as LighthouseNetworkId
              })
            }
          />
        </div>
      </div>
    </div>
  )
}
