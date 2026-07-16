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
import { cn } from '@renderer/lib/utils'

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
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-8 rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white/85 outline-none',
          'transition-[border-color,box-shadow] duration-150',
          'focus-visible:ring-2 focus-visible:ring-sky-400/40',
          'disabled:opacity-40'
        )}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
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
    <div
      data-testid="lighthouse-lab-picker"
      className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2"
    >
      <div className="rounded-lg border border-white/10 bg-black/25 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Mobile lab
        </p>
        <div className="flex flex-wrap gap-2">
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
      <div className="rounded-lg border border-white/10 bg-black/25 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Desktop lab
        </p>
        <div className="flex flex-wrap gap-2">
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
