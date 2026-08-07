import type { LighthouseLabSpecSnapshot } from '../../../../shared/lighthouse'
import { TOOLBAR_HEIGHT_PX } from '../../../../shared/sidebar'

export function SpecsBar({ spec }: { spec: LighthouseLabSpecSnapshot }): React.JSX.Element {
  const items = [
    {
      label: 'Profile',
      value: spec.formFactor
    },
    {
      label: 'Device',
      value: spec.deviceLabel
    },
    {
      label: 'Network',
      value: spec.networkLabel
    },
    {
      label: 'CPU',
      value: spec.cpuLabel
    },
    {
      label: 'Browser',
      value: `${spec.browserLabel} · Lighthouse ${spec.lighthouseVersion}`
    },
    {
      label: 'Completed',
      value: new Date(spec.completedAt).toLocaleString()
    }
  ]

  return (
    <aside
      data-testid="lighthouse-specs"
      aria-label="Lighthouse lab specs"
      className="min-w-0 text-white/65 lg:sticky"
      style={{ top: TOOLBAR_HEIGHT_PX + 16 }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        Lab specs
      </p>
      <dl className="mt-3 space-y-2.5">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-white/30">
              {item.label}
            </dt>
            <dd className="mt-0.5 break-words text-xs leading-snug text-white/65">{item.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
