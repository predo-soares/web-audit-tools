import { useEffect, useState } from 'react'
import {
  ArrowDown01Icon,
  BrowserIcon,
  Calendar03Icon,
  CpuIcon,
  LaptopIcon,
  SmartPhone01Icon,
  Timer02Icon,
  Wifi01Icon
} from '@hugeicons/core-free-icons'
import type {
  LighthouseAssessmentResult,
  LighthouseAssessmentState,
  LighthouseAuditDetail,
  LighthouseAuditGroupMeta,
  LighthouseCategory,
  LighthouseDesktopDeviceId,
  LighthouseLabSelection,
  LighthouseLabSpecSnapshot,
  LighthouseMobileDeviceId,
  LighthouseNetworkId,
  LighthouseProfile,
  LighthouseProgressPhase
} from '../../../shared/lighthouse'
import {
  DEFAULT_LIGHTHOUSE_LAB_SELECTION,
  EMPTY_LIGHTHOUSE_RESULTS,
  hasAnyLighthouseResult,
  LIGHTHOUSE_CORE_METRIC_IDS,
  LIGHTHOUSE_DESKTOP_DEVICES,
  LIGHTHOUSE_MOBILE_DEVICES,
  LIGHTHOUSE_NETWORK_PRESETS,
  LIGHTHOUSE_PROGRESS_PHASES,
  LIGHTHOUSE_PROGRESS_STEP_LABEL,
  LIGHTHOUSE_PROFILES
} from '../../../shared/lighthouse'
import { isAuditableUrl } from '../../../shared/seo-audit'
import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../shared/sidebar'
import { useSidebar } from '@renderer/context/sidebar-context'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/lib/utils'

type ScoreTone = 'pass' | 'average' | 'fail' | 'none'
type AuditBucket = 'failed' | 'manual' | 'passed' | 'notApplicable'

function scoreTone(score: number | null): ScoreTone {
  if (score == null) return 'none'
  if (score >= 0.9) return 'pass'
  if (score >= 0.5) return 'average'
  return 'fail'
}

const TONE_STROKE: Record<ScoreTone, string> = {
  pass: '#0cce6b',
  average: '#ffa400',
  fail: '#ff4e42',
  none: 'rgba(255,255,255,0.2)'
}

const TONE_TEXT: Record<ScoreTone, string> = {
  pass: 'text-[#0cce6b]',
  average: 'text-[#ffa400]',
  fail: 'text-[#ff4e42]',
  none: 'text-white/40'
}

const TONE_SHAPE: Record<ScoreTone, string> = {
  pass: 'rounded-full',
  average: 'rounded-[2px]',
  fail: 'rounded-none rotate-45',
  none: 'rounded-full'
}

const CATEGORY_BLURB: Record<string, string> = {
  performance:
    'Values are estimated and may vary. The performance score is calculated directly from these metrics.',
  accessibility:
    'These checks highlight opportunities to improve the accessibility of your web app. Automatic detection can only detect a subset of issues and does not guarantee the accessibility of your web app.',
  'best-practices':
    'These checks highlight opportunities to improve best practices around security, standards, and user experience.',
  seo: 'These checks ensure that your page is following basic search engine optimization advice. Many additional factors affect your search ranking, including Google’s assessment of whether your site is trustworthy.'
}

const BUCKET_META: Record<
  AuditBucket,
  { label: string; hint?: string; defaultOpen: boolean }
> = {
  failed: { label: 'To improve', defaultOpen: true },
  manual: {
    label: 'Additional items to manually check',
    hint: 'These items require human review and are not included in the score.',
    defaultOpen: false
  },
  passed: { label: 'Passed audits', defaultOpen: false },
  notApplicable: { label: 'Not applicable', defaultOpen: false }
}

const CORE_METRIC_SET = new Set<string>(LIGHTHOUSE_CORE_METRIC_IDS)

function formatScore(score: number | null): string {
  return score == null ? '—' : String(Math.round(score * 100))
}

function classifyAudit(audit: LighthouseAuditDetail): AuditBucket {
  const mode = audit.scoreDisplayMode
  if (mode === 'notApplicable') return 'notApplicable'
  if (mode === 'manual') return 'manual'
  if (audit.score == null) {
    return mode === 'informative' ? 'passed' : 'manual'
  }
  if (audit.score >= 1) return 'passed'
  return 'failed'
}

function humanizeGroupId(groupId: string): string {
  const parts = groupId.split('-')
  const meaningful = parts.length > 1 ? parts.slice(1) : parts
  return meaningful.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function resolveGroupMeta(
  groupId: string | null,
  auditGroups: Record<string, LighthouseAuditGroupMeta>
): LighthouseAuditGroupMeta {
  if (groupId && auditGroups[groupId]) return auditGroups[groupId]
  if (groupId) return { title: humanizeGroupId(groupId), description: '' }
  return { title: 'Audits', description: '' }
}

function SpecsBar({ spec }: { spec: LighthouseLabSpecSnapshot }): React.JSX.Element {
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
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/35">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white/85 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:opacity-40"
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

function LabSpecsPicker({
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

function ScoreGauge({
  category,
  size = 'md',
  centered = false
}: {
  category: LighthouseCategory
  size?: 'md' | 'lg'
  centered?: boolean
}): React.JSX.Element {
  const tone = scoreTone(category.score)
  const value = category.score == null ? 0 : Math.max(0, Math.min(1, category.score))
  const large = size === 'lg'
  const box = large ? 120 : 88
  const radius = large ? 48 : 36
  const stroke = large ? 8 : 6
  const circumference = 2 * Math.PI * radius
  const dash = circumference * value

  return (
    <article
      data-testid="lighthouse-score"
      className={cn(
        'flex flex-col items-center gap-2',
        !large &&
          !centered &&
          'rounded-xl border border-white/10 bg-black/40 px-4 py-5 backdrop-blur-md'
      )}
    >
      <div className="relative" style={{ width: box, height: box }}>
        <svg viewBox={`0 0 ${box} ${box}`} className="size-full -rotate-90" aria-hidden>
          <circle
            cx={box / 2}
            cy={box / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          <circle
            cx={box / 2}
            cy={box / 2}
            r={radius}
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="transition-[stroke-dasharray] duration-700 ease-out"
          />
        </svg>
        <strong
          className={cn(
            'absolute inset-0 flex items-center justify-center font-semibold tabular-nums',
            large ? 'text-4xl' : 'text-2xl',
            TONE_TEXT[tone]
          )}
        >
          {formatScore(category.score)}
        </strong>
      </div>
      {!centered ? (
        <span className={cn('text-center text-white/55', large ? 'text-sm' : 'text-xs')}>
          {category.title}
        </span>
      ) : null}
    </article>
  )
}

function ScoreLegend(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-white/45">
      {(
        [
          ['fail', '0–49'],
          ['average', '50–89'],
          ['pass', '90–100']
        ] as const
      ).map(([tone, label]) => (
        <span key={tone} className="inline-flex items-center gap-1.5">
          <span
            className={cn('size-2.5', TONE_SHAPE[tone])}
            style={{ backgroundColor: TONE_STROKE[tone] }}
          />
          {label}
        </span>
      ))}
    </div>
  )
}

function ProgressPanel({
  profile,
  phase,
  label
}: {
  profile: LighthouseProfile
  phase: LighthouseProgressPhase
  label: string
}): React.JSX.Element {
  const currentIndex = LIGHTHOUSE_PROGRESS_PHASES.indexOf(phase)
  const profileIndex = LIGHTHOUSE_PROFILES.indexOf(profile)
  const overall =
    ((profileIndex * LIGHTHOUSE_PROGRESS_PHASES.length + currentIndex + 1) /
      (LIGHTHOUSE_PROFILES.length * LIGHTHOUSE_PROGRESS_PHASES.length)) *
    100

  return (
    <section
      role="status"
      data-testid="lighthouse-progress"
      className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white/90">{label}</p>
          <p className="mt-0.5 text-xs text-white/40">
            {profile === 'mobile' ? 'Mobile' : 'Desktop'} · step {currentIndex + 1} of{' '}
            {LIGHTHOUSE_PROGRESS_PHASES.length} · profile {profileIndex + 1} of{' '}
            {LIGHTHOUSE_PROFILES.length}
          </p>
        </div>
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400/60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-sky-400" />
        </span>
      </div>

      <div className="mb-4 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-sky-400/80 transition-[width] duration-500 ease-out"
          style={{ width: `${overall}%` }}
        />
      </div>

      <div className="mb-3 flex gap-2">
        {LIGHTHOUSE_PROFILES.map((item) => {
          const done = LIGHTHOUSE_PROFILES.indexOf(item) < profileIndex
          const active = item === profile
          return (
            <span
              key={item}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11px] font-medium capitalize',
                done && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                active && 'border-sky-400/40 bg-sky-400/10 text-sky-300',
                !done && !active && 'border-white/5 bg-white/[0.03] text-white/30'
              )}
            >
              {item}
            </span>
          )
        })}
      </div>

      <ol className="grid grid-cols-5 gap-2">
        {LIGHTHOUSE_PROGRESS_PHASES.map((step, index) => {
          const done = index < currentIndex
          const active = index === currentIndex
          return (
            <li
              key={step}
              className={cn(
                'rounded-lg border px-2 py-2 text-center transition-colors',
                done && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                active && 'border-sky-400/40 bg-sky-400/10 text-sky-300',
                !done && !active && 'border-white/5 bg-white/[0.03] text-white/30'
              )}
            >
              <span className="block text-[10px] font-medium uppercase tracking-wide">
                {LIGHTHOUSE_PROGRESS_STEP_LABEL[step]}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function AuditRow({ audit }: { audit: LighthouseAuditDetail }): React.JSX.Element {
  const tone = scoreTone(audit.score)
  return (
    <details className="group border-b border-white/5 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            'size-2.5 shrink-0',
            TONE_SHAPE[tone],
            tone === 'pass' && 'bg-[#0cce6b]',
            tone === 'average' && 'bg-[#ffa400]',
            tone === 'fail' && 'bg-[#ff4e42]',
            tone === 'none' && 'bg-white/25'
          )}
        />
        <span className="min-w-0 flex-1 text-white/85">{audit.title}</span>
        {audit.displayValue ? (
          <span className="shrink-0 text-xs tabular-nums text-white/40">{audit.displayValue}</span>
        ) : null}
        <Icon
          icon={ArrowDown01Icon}
          size={14}
          className="shrink-0 text-white/30 transition-transform group-open:rotate-180"
        />
      </summary>
      <p className="pb-3 pl-5 text-xs leading-relaxed text-white/45">
        {audit.description || 'No additional detail.'}
      </p>
    </details>
  )
}

function MetricsGrid({ result }: { result: LighthouseAssessmentResult }): React.JSX.Element {
  const metrics = LIGHTHOUSE_CORE_METRIC_IDS.map((id) => result.audits[id]).filter(
    (audit): audit is LighthouseAuditDetail => Boolean(audit)
  )

  if (metrics.length === 0) return <></>

  return (
    <section className="mt-6 border-t border-white/10 pt-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/45">Metrics</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => {
          const tone = scoreTone(metric.score)
          return (
            <div
              key={metric.id}
              className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-3"
            >
              <span
                className={cn('mt-1 size-2.5 shrink-0', TONE_SHAPE[tone])}
                style={{ backgroundColor: TONE_STROKE[tone] }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/80">{metric.title}</p>
                <p className={cn('mt-0.5 text-lg font-semibold tabular-nums', TONE_TEXT[tone])}>
                  {metric.displayValue ?? formatScore(metric.score)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function groupByAuditGroup(
  audits: LighthouseAuditDetail[],
  auditGroups: Record<string, LighthouseAuditGroupMeta>
): Array<{ id: string; meta: LighthouseAuditGroupMeta; audits: LighthouseAuditDetail[] }> {
  const order: string[] = []
  const map = new Map<string, LighthouseAuditDetail[]>()
  for (const audit of audits) {
    const key = audit.groupId ?? '_ungrouped'
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(audit)
  }
  return order.map((id) => ({
    id,
    meta: resolveGroupMeta(id === '_ungrouped' ? null : id, auditGroups),
    audits: map.get(id)!
  }))
}

function CollapsibleAuditBucket({
  bucket,
  audits,
  auditGroups
}: {
  bucket: AuditBucket
  audits: LighthouseAuditDetail[]
  auditGroups: Record<string, LighthouseAuditGroupMeta>
}): React.JSX.Element | null {
  if (audits.length === 0) return null
  const meta = BUCKET_META[bucket]
  const grouped = groupByAuditGroup(audits, auditGroups)

  if (bucket === 'failed') {
    return (
      <div className="border-t border-white/10">
        {grouped.map((group) => (
          <div key={group.id} className="border-b border-white/10 last:border-b-0">
            <div className="px-1 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">
                {group.meta.title}
              </h3>
              {group.meta.description ? (
                <p className="mt-1 text-xs text-white/35">{group.meta.description}</p>
              ) : null}
            </div>
            <div className="px-1">
              {group.audits.map((audit) => (
                <AuditRow key={audit.id} audit={audit} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <details
      className="group/bucket border-t border-white/10"
      open={meta.defaultOpen || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 py-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/55">
            {meta.label} ({audits.length})
          </p>
          {meta.hint ? <p className="mt-1 text-xs text-white/30">{meta.hint}</p> : null}
        </div>
        <span className="text-xs font-medium text-sky-300 group-open/bucket:hidden">Show</span>
        <span className="hidden text-xs font-medium text-sky-300 group-open/bucket:inline">
          Hide
        </span>
      </summary>
      <div className="pb-2">
        {grouped.map((group) => (
          <div key={group.id} className="mb-2">
            {grouped.length > 1 ? (
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/30">
                {group.meta.title}
              </p>
            ) : null}
            {group.audits.map((audit) => (
              <AuditRow key={audit.id} audit={audit} />
            ))}
          </div>
        ))}
      </div>
    </details>
  )
}

function DimensionSection({
  category,
  result
}: {
  category: LighthouseCategory
  result: LighthouseAssessmentResult
}): React.JSX.Element {
  const audits = category.auditIds
    .map((id) => result.audits[id])
    .filter((audit): audit is LighthouseAuditDetail => {
      if (!audit) return false
      if (category.id === 'performance' && CORE_METRIC_SET.has(audit.id)) return false
      return true
    })

  const buckets: Record<AuditBucket, LighthouseAuditDetail[]> = {
    failed: [],
    manual: [],
    passed: [],
    notApplicable: []
  }
  for (const audit of audits) {
    buckets[classifyAudit(audit)].push(audit)
  }

  const blurb =
    CATEGORY_BLURB[category.id] ??
    `These checks highlight opportunities to improve ${category.title.toLowerCase()}.`

  return (
    <section
      id={`lighthouse-dimension-${category.id}`}
      data-testid={`lighthouse-dimension-${category.id}`}
      className="rounded-xl border border-white/10 bg-black/40 px-5 py-8 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <ScoreGauge category={category} size="lg" centered />
        <h2 className="mt-4 text-xl font-semibold text-white">{category.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/45">{blurb}</p>
        <div className="mt-4">
          <ScoreLegend />
        </div>
      </div>

      {category.id === 'performance' ? <MetricsGrid result={result} /> : null}

      <div className="mt-6">
        <CollapsibleAuditBucket
          bucket="failed"
          audits={buckets.failed}
          auditGroups={result.auditGroups}
        />
        <CollapsibleAuditBucket
          bucket="manual"
          audits={buckets.manual}
          auditGroups={result.auditGroups}
        />
        <CollapsibleAuditBucket
          bucket="passed"
          audits={buckets.passed}
          auditGroups={result.auditGroups}
        />
        <CollapsibleAuditBucket
          bucket="notApplicable"
          audits={buckets.notApplicable}
          auditGroups={result.auditGroups}
        />
      </div>
    </section>
  )
}

function ProfileReport({ result }: { result: LighthouseAssessmentResult }): React.JSX.Element {
  return (
    <div data-testid="lighthouse-result" className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <p className="text-xs text-white/40">Lab data · {result.deviceMode}</p>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            result.stale
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-emerald-500/15 text-emerald-400'
          )}
        >
          {result.stale ? 'Stale' : 'Current'}
        </span>
      </div>

      <SpecsBar spec={result.labSpec} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {result.categories.map((category) => (
          <a
            key={category.id}
            href={`#lighthouse-dimension-${category.id}`}
            className="rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sky-400/50"
          >
            <ScoreGauge category={category} />
          </a>
        ))}
      </section>

      {result.categories.map((category) => (
        <DimensionSection key={category.id} category={category} result={result} />
      ))}

      {result.truncatedAuditCount > 0 ? (
        <p className="text-xs text-amber-400/90">
          {result.truncatedAuditCount} audits omitted to keep the report focused.
        </p>
      ) : null}
    </div>
  )
}

export function LighthouseView(): React.JSX.Element {
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const sidebarOffset = sidebarOpen || sidebarTransitioning ? SIDEBAR_WIDTH_PX : 0
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [viewProfile, setViewProfile] = useState<LighthouseProfile>('mobile')
  const [labSelection, setLabSelection] = useState<LighthouseLabSelection>({
    ...DEFAULT_LIGHTHOUSE_LAB_SELECTION
  })
  const [state, setState] = useState<LighthouseAssessmentState>({
    phase: 'idle',
    results: { ...EMPTY_LIGHTHOUSE_RESULTS },
    error: null,
    progress: null
  })

  useEffect(() => {
    void window.api.getNavigationState().then((navigation) => {
      setUrl(navigation.barUrl)
      setTitle(navigation.pageTitle)
    })
    void window.api.getLighthouseState().then(setState)
    const stopNavigation = window.api.onPaneNavigation((navigation) => {
      setUrl(navigation.barUrl)
      setTitle(navigation.pageTitle)
    })
    const stopState = window.api.onLighthouseState(setState)
    return () => {
      stopNavigation()
      stopState()
    }
  }, [])

  useEffect(() => {
    if (state.phase === 'running') {
      setViewProfile(state.activeProfile)
    }
  }, [state.phase === 'running' ? state.activeProfile : null])

  const running = state.phase === 'running'
  const auditable = isAuditableUrl(url)
  const result = state.results[viewProfile]
  const hasResults = hasAnyLighthouseResult(state.results)

  return (
    <div
      data-testid="lighthouse-view"
      className="absolute inset-0 z-10 overflow-y-auto bg-transparent text-foreground"
      style={{ top: TOOLBAR_HEIGHT_PX, left: sidebarOffset }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-8 py-8">
        <header className="rounded-xl border border-white/10 bg-black/40 px-5 py-4 backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-white">
                Diagnose performance issues
              </h1>
              <p className="mt-1 truncate text-xs text-white/45" title={url}>
                {title ? `${title} — ` : ''}
                {url || 'No page loaded'}
              </p>
            </div>
            {running ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void window.api.cancelLighthouse()}
              >
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                data-testid="lighthouse-run"
                disabled={!auditable}
                onClick={() => void window.api.runLighthouse(labSelection)}
              >
                Analyze page
              </Button>
            )}
          </div>
          <p className="mt-3 text-[11px] text-white/30">
            Runs Lighthouse for both Mobile and Desktop with the lab specs below.
          </p>
          <LabSpecsPicker
            selection={labSelection}
            disabled={running}
            onChange={setLabSelection}
          />
        </header>

        <div
          role="tablist"
          aria-label="Device profile"
          className="flex items-center justify-center gap-1 border-b border-white/10"
        >
          {LIGHTHOUSE_PROFILES.map((profile) => {
            const selected = viewProfile === profile
            const ready = state.results[profile] != null
            return (
              <button
                key={profile}
                type="button"
                role="tab"
                aria-selected={selected}
                data-testid={`lighthouse-tab-${profile}`}
                onClick={() => setViewProfile(profile)}
                className={cn(
                  'relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors',
                  selected ? 'text-sky-300' : 'text-white/45 hover:text-white/70'
                )}
              >
                <Icon
                  icon={profile === 'mobile' ? SmartPhone01Icon : LaptopIcon}
                  size={16}
                  className={selected ? 'text-sky-300' : 'text-white/35'}
                />
                <span className="capitalize">{profile}</span>
                {ready ? (
                  <span className="size-1.5 rounded-full bg-emerald-400/80" aria-hidden />
                ) : null}
                {selected ? (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-sky-400" />
                ) : null}
              </button>
            )
          })}
        </div>

        {running && state.progress ? (
          <ProgressPanel
            profile={state.progress.profile}
            phase={state.progress.phase}
            label={state.progress.label}
          />
        ) : null}

        {state.phase === 'failed' ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive backdrop-blur-md"
          >
            {state.error}
          </p>
        ) : null}

        {state.phase === 'cancelled' ? (
          <p
            role="status"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400 backdrop-blur-md"
          >
            Lighthouse run cancelled.
          </p>
        ) : null}

        {!auditable ? (
          <p className="rounded-xl border border-white/10 bg-black/30 px-6 py-16 text-center text-sm text-white/40 backdrop-blur-md">
            Load an HTTP or HTTPS page to run Lighthouse.
          </p>
        ) : null}

        {result ? <ProfileReport result={result} /> : null}

        {auditable && !result && !running && !hasResults ? (
          <p className="rounded-xl border border-white/10 bg-black/30 px-6 py-16 text-center text-sm text-white/40 backdrop-blur-md">
            Analyze the page to generate Mobile and Desktop Lighthouse reports.
          </p>
        ) : null}

        {auditable && !result && (running || hasResults) ? (
          <p className="rounded-xl border border-white/10 bg-black/30 px-6 py-12 text-center text-sm text-white/40 backdrop-blur-md">
            {running
              ? `Waiting for ${viewProfile} results…`
              : `No ${viewProfile} report yet. Run Analyze page again.`}
          </p>
        ) : null}
      </div>
    </div>
  )
}
