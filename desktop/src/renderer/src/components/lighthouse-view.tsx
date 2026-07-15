import { useEffect, useState } from 'react'
import type {
  LighthouseAssessmentState,
  LighthouseProfile
} from '../../../shared/lighthouse'
import { isAuditableUrl } from '../../../shared/seo-audit'
import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../shared/sidebar'
import { useSidebar } from '@renderer/context/sidebar-context'

export function LighthouseView({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const sidebarOffset = sidebarOpen || sidebarTransitioning ? SIDEBAR_WIDTH_PX : 0
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [profile, setProfile] = useState<LighthouseProfile>('mobile')
  const [state, setState] = useState<LighthouseAssessmentState>({
    phase: 'idle', result: null, error: null, progress: null
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
    return () => { stopNavigation(); stopState() }
  }, [])

  const result = state.result
  const auditRows = (ids: string[]) => ids.map((id) => result?.audits[id]).filter(Boolean)

  return (
    <main data-testid="lighthouse-view" className="h-screen overflow-y-auto bg-background pr-8 pb-10 text-foreground" style={{ paddingTop: TOOLBAR_HEIGHT_PX + 20, paddingLeft: sidebarOffset + 32 }}>
      <header className="flex items-start justify-between border-b border-white/10 pb-5">
        <div>
          <button type="button" onClick={onClose} className="mb-3 text-xs text-muted-foreground">← Browser</button>
          <h1 className="text-2xl font-semibold">Lighthouse</h1>
          <p className="mt-1 text-xs text-muted-foreground">{title ? `${title} — ` : ''}{url || 'No page loaded'}</p>
        </div>
        {result ? <span className="text-xs text-muted-foreground">{result.stale ? 'STALE RESULT' : 'CURRENT RESULT'}</span> : null}
      </header>

      <section className="grid grid-cols-[1fr_1fr_auto] items-end gap-5 border-b border-white/10 py-5">
        <div><p className="mb-2 text-xs uppercase text-muted-foreground">Profile</p><div className="flex gap-2">{(['mobile','desktop'] as LighthouseProfile[]).map((item) => <button key={item} type="button" aria-pressed={profile === item} onClick={() => setProfile(item)} className="rounded border border-white/10 px-4 py-2 text-sm capitalize aria-pressed:bg-white/10">{item}</button>)}</div></div>
        <label className="text-sm text-muted-foreground"><input type="checkbox" disabled className="mr-2" />Share active pane session <span className="block text-[10px]">Unavailable until safe isolated transfer is supported</span></label>
        {state.phase === 'running' ? <button type="button" onClick={() => void window.api.cancelLighthouse()} className="rounded border border-white/20 px-5 py-2">Cancel</button> : <button type="button" data-testid="lighthouse-run" disabled={!isAuditableUrl(url)} onClick={() => void window.api.runLighthouse(profile, false)} className="rounded bg-white px-5 py-2 text-black disabled:opacity-40">Run Lighthouse</button>}
      </section>

      {state.phase === 'running' ? <p role="status" className="my-5 rounded border border-white/10 p-4">{state.progress.label}</p> : null}
      {state.phase === 'failed' ? <p role="alert" className="my-5 rounded border border-destructive/40 p-4 text-destructive">{state.error}</p> : null}
      {state.phase === 'cancelled' ? <p role="status" className="my-5 text-amber-500">Lighthouse run cancelled.</p> : null}
      {!isAuditableUrl(url) ? <p className="py-16 text-center text-muted-foreground">Load an HTTP or HTTPS page to run Lighthouse.</p> : null}

      {result ? <>
        <section className="grid grid-cols-4 gap-3 py-6">{result.categories.map((category) => <article key={category.id} className="rounded border border-white/10 p-5 text-center"><strong className="block text-3xl">{category.score == null ? '—' : Math.round(category.score * 100)}</strong><span className="text-xs text-muted-foreground">{category.title}</span></article>)}</section>
        {([['Opportunities', result.opportunityIds], ['Diagnostics', result.diagnosticIds]] as const).map(([heading, ids]) => <section key={heading} className="border-t border-white/10 py-5"><h2 className="mb-3 text-sm font-semibold">{heading}</h2><div className="space-y-2">{auditRows(ids).map((audit) => <details key={audit!.id} className="rounded border border-white/10 p-3"><summary className="cursor-pointer text-sm">{audit!.title} <span className="text-muted-foreground">{audit!.displayValue}</span></summary><p className="mt-2 text-xs text-muted-foreground">{audit!.description || 'No additional detail.'}</p></details>)}{ids.length === 0 ? <p className="text-xs text-muted-foreground">No entries.</p> : null}</div></section>)}
        <section className="border-t border-white/10 py-5"><h2 className="mb-3 text-sm font-semibold">All audits</h2><div className="grid gap-2">{Object.values(result.audits).map((audit) => <details key={audit.id} className="rounded border border-white/10 p-3"><summary>{audit.title} — {audit.score == null ? audit.scoreDisplayMode : Math.round(audit.score * 100)}</summary><p className="mt-2 text-xs text-muted-foreground">{audit.description}</p></details>)}</div>{result.truncatedAuditCount > 0 ? <p className="mt-3 text-xs text-amber-500">{result.truncatedAuditCount} audits omitted.</p> : null}</section>
      </> : null}
    </main>
  )
}
