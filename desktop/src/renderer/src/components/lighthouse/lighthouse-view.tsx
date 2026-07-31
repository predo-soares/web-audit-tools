import { useEffect, useState } from 'react'
import type {
  LighthouseAssessmentState,
  LighthouseLabSelection,
  LighthouseProfile
} from '../../../../shared/lighthouse'
import {
  DEFAULT_LIGHTHOUSE_LAB_SELECTION,
  EMPTY_LIGHTHOUSE_RESULTS,
  hasAnyLighthouseResult
} from '../../../../shared/lighthouse'
import { isAuditableUrl } from '../../../../shared/seo-audit'
import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../../shared/sidebar'
import { useSidebar } from '@renderer/context/sidebar-context'
import { CANVAS_GLASS_SURFACE_CLASS } from '@renderer/lib/glass-surface'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { LabSpecsPicker } from './lab-specs-picker'
import { ProfileReport } from './profile-report'
import { ProfileTabs } from './profile-tabs'
import { ProgressPanel } from './progress-panel'

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
      className={cn(
        'absolute inset-0 z-10 box-border overflow-y-auto text-foreground',
        CANVAS_GLASS_SURFACE_CLASS
      )}
      style={{ paddingTop: TOOLBAR_HEIGHT_PX, paddingLeft: sidebarOffset }}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-8 py-8">
        <header>
          <h1 className="text-lg font-semibold tracking-tight text-white">
            Diagnose performance issues
          </h1>
          <p className="mt-1 text-xs text-white/45">
            Runs Lighthouse for both Mobile and Desktop with the lab specs below.
          </p>
        </header>

        <section className="rounded-xl border border-white/10 bg-black/40 px-5 py-4 backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-white">Target page</h2>
              <p className="mt-0.5 truncate text-xs text-white/45" title={url}>
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
                variant="solid"
                color="neutral"
                data-testid="lighthouse-run"
                disabled={!auditable}
                onClick={() => void window.api.runLighthouse(labSelection)}
              >
                Analyze page
              </Button>
            )}
          </div>
          <LabSpecsPicker selection={labSelection} disabled={running} onChange={setLabSelection} />
        </section>

        <ProfileTabs
          viewProfile={viewProfile}
          isProfileReady={(profile) => state.results[profile] != null}
          onSelect={setViewProfile}
        />

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
