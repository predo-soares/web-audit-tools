import { startTransition, useEffect, useState } from 'react'
import type {
  LighthouseAssessmentState,
  LighthouseLabSelection,
  LighthouseProfile
} from '../../../../shared/lighthouse'
import {
  DEFAULT_LIGHTHOUSE_LAB_SELECTION,
  EMPTY_LIGHTHOUSE_RESULTS,
  hasAnyLighthouseResult,
  LIGHTHOUSE_PROFILES
} from '../../../../shared/lighthouse'
import type { HistoryEntry } from '../../../../shared/history'
import { isAuditableUrl } from '../../../../shared/seo-audit'
import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../../shared/sidebar'
import { LaptopIcon, SmartPhone01Icon } from '@hugeicons/core-free-icons'
import { useSidebar } from '@renderer/context/sidebar-context'
import { CANVAS_GLASS_SURFACE_CLASS } from '@renderer/lib/glass-surface'
import { cn } from '@renderer/lib/utils'
import { Icon } from '@renderer/components/ui/icon'
import { MotionTabs, type MotionTabItem } from '@renderer/components/ui/motion-tabs'
import { TargetUrlBar } from '@renderer/components/target-url-bar'
import { CARD } from '@renderer/components/seo/lib/styles'
import { LabSpecsPopover } from './lab-specs-popover'
import { ProfileReport } from './profile-report'
import { ProgressBar } from './progress-bar'
import { SpecsBar } from './specs-bar'

const LIGHTHOUSE_URL_BAR_TEST_IDS = {
  input: 'lighthouse-target-url',
  run: 'lighthouse-run',
  cancel: 'lighthouse-cancel',
  error: 'lighthouse-url-error',
  history: 'lighthouse-url-history',
  historyItem: 'lighthouse-url-history-item'
}

export function LighthouseView({
  onTargetNavigate
}: {
  // Keeps the user in Lighthouse when they navigate from its own target bar,
  // rather than bouncing to the device canvas.
  onTargetNavigate: () => void
}): React.JSX.Element {
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const sidebarOffset = sidebarOpen || sidebarTransitioning ? SIDEBAR_WIDTH_PX : 0
  const [url, setUrl] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
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
    })
    void window.api.getLighthouseState().then(setState)
    void window.api.listHistory().then(setHistory)
    const stopNavigation = window.api.onPaneNavigation((navigation) => {
      setUrl(navigation.barUrl)
    })
    const stopState = window.api.onLighthouseState(setState)
    const stopHistory = window.api.onHistoryUpdated(setHistory)
    return () => {
      stopNavigation()
      stopState()
      stopHistory()
    }
  }, [])

  const running = state.phase === 'running'
  const runningProfile = state.phase === 'running' ? state.activeProfile : null

  useEffect(() => {
    if (runningProfile) {
      startTransition(() => setViewProfile(runningProfile))
    }
  }, [runningProfile])

  const auditable = isAuditableUrl(url)
  const result = state.results[viewProfile]
  const analysisOutdated = LIGHTHOUSE_PROFILES.some((profile) => state.results[profile]?.stale)
  const hasResults = hasAnyLighthouseResult(state.results)
  const isEmptyState = !running && !hasResults

  const profileTabs: Array<MotionTabItem<LighthouseProfile>> = LIGHTHOUSE_PROFILES.map(
    (profile) => ({
      value: profile,
      label: (
        <span className="flex items-center gap-1.5">
          <Icon icon={profile === 'mobile' ? SmartPhone01Icon : LaptopIcon} size={14} />
          <span className="capitalize">{profile}</span>
        </span>
      ),
      trailing:
        state.results[profile] != null ? (
          <span className="size-1.5 rounded-full bg-emerald-400/80" aria-hidden />
        ) : undefined,
      testId: `lighthouse-tab-${profile}`
    })
  )

  return (
    <>
      <div
        data-testid="lighthouse-view"
        className={cn(
          'relative z-10 box-border h-screen overflow-y-auto text-foreground',
          CANVAS_GLASS_SURFACE_CLASS
        )}
        style={{ paddingTop: TOOLBAR_HEIGHT_PX, paddingLeft: sidebarOffset }}
      >
        <div
          className={cn(
            'w-full px-8 pb-32',
            isEmptyState && 'flex min-h-full flex-col justify-center'
          )}
        >
          <div className="grid w-full  grid-cols-1 gap-8 xl:grid-cols-[1fr_13rem] ">
            <div className="mx-auto flex  min-w-3xl w-full max-w-4xl justify-self-center flex-col gap-5">
              <header >
                <h1 className="text-lg font-semibold tracking-tight text-white">
                  Diagnose performance issues
                </h1>
                <p className="mt-1 text-xs text-white/45">
                  Runs Lighthouse for both Mobile and Desktop with configurable lab specs.
                </p>
              </header>

              <section className={cn(CARD, 'relative  z-20 px-3 py-3')}>
                <TargetUrlBar
                  url={url}
                  history={history}
                  running={running}
                  runLabel={analysisOutdated ? 'Analyze page · outdated' : 'Analyze page'}
                  runDisabled={!auditable}
                  onNavigate={(target) => {
                    onTargetNavigate()
                    void window.api.navigate(target)
                  }}
                  onRun={() => void window.api.runLighthouse(labSelection)}
                  onCancel={() => void window.api.cancelLighthouse()}
                  testIds={LIGHTHOUSE_URL_BAR_TEST_IDS}
                  middleSlot={
                    <LabSpecsPopover
                      selection={labSelection}
                      disabled={running}
                      onChange={setLabSelection}
                    />
                  }
                />
              </section>

              {hasResults ? (
                <MotionTabs
                  items={profileTabs}
                  value={viewProfile}
                  onChange={setViewProfile}
                  layoutId="lighthouse-profile-indicator"
                  ariaLabel="Device profile"
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

              {result ? (
                <main className="min-w-0 w-full">
                  <ProfileReport result={result} />
                </main>
              ) : running || hasResults ? (
                <div className="w-full">
                  <p className="rounded-xl border border-white/10 bg-black/30 px-6 py-12 text-center text-sm text-white/40 backdrop-blur-md">
                    {running
                      ? `Waiting for ${viewProfile} results…`
                      : `No ${viewProfile} report yet. Run Analyze page again.`}
                  </p>
                </div>
              ) : null}
            </div>

            {result ? (
              <div className="hidden xl:block">
                <SpecsBar spec={result.labSpec} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {running && state.progress ? (
        <ProgressBar
          profile={state.progress.profile}
          phase={state.progress.phase}
          label={state.progress.label}
        />
      ) : null}
    </>
  )
}
