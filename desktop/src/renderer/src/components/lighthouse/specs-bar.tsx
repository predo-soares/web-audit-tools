import {
  BrowserIcon,
  Calendar03Icon,
  CpuIcon,
  SmartPhone01Icon,
  Timer02Icon,
  Wifi01Icon
} from '@hugeicons/core-free-icons'
import type { LighthouseLabSpecSnapshot } from '../../../../shared/lighthouse'
import { Icon } from '@renderer/components/ui/icon'

export function SpecsBar({ spec }: { spec: LighthouseLabSpecSnapshot }): React.JSX.Element {
  const items = [
    {
      icon: Calendar03Icon,
      label: new Date(spec.completedAt).toLocaleString()
    },
    {
      icon: SmartPhone01Icon,
      label: `Emulated ${spec.deviceLabel}`
    },
    {
      icon: Wifi01Icon,
      label: spec.networkLabel
    },
    {
      icon: Timer02Icon,
      label: 'Single page load'
    },
    {
      icon: CpuIcon,
      label: spec.cpuLabel
    },
    {
      icon: BrowserIcon,
      label: `${spec.browserLabel} · Lighthouse ${spec.lighthouseVersion}`
    }
  ]

  return (
    <div
      data-testid="lighthouse-specs"
      className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 sm:grid-cols-3"
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs text-white/55">
          <Icon icon={item.icon} size={14} className="shrink-0 text-white/35" />
          <span className="min-w-0 leading-snug">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
