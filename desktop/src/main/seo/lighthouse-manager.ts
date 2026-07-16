import { launch } from 'chrome-launcher'
import type {
  LighthouseAssessmentResult,
  LighthouseAssessmentState,
  LighthouseLabSelection,
  LighthouseProfile,
  LighthouseProgressPhase,
  LighthouseResultsByProfile
} from '../../shared/lighthouse'
import {
  buildLabSpecSnapshot,
  DEFAULT_LIGHTHOUSE_LAB_SELECTION,
  EMPTY_LIGHTHOUSE_RESULTS,
  LIGHTHOUSE_PROFILES,
  markLighthouseResultsStale,
  projectLighthouseResult,
  resolveLighthouseDevice,
  resolveLighthouseNetwork,
  sanitizeLighthouseError
} from '../../shared/lighthouse'
import { sanitizeUrl } from '../../shared/seo-sanitize'
import type { PaneId } from '../../shared/types'

export interface LighthouseRunInput {
  url: string
  profile: LighthouseProfile
  paneId?: PaneId
  shareSession: boolean
  headers?: Record<string, string>
  labSelection: LighthouseLabSelection
}

export interface LighthouseDualRunInput {
  url: string
  paneId?: PaneId
  shareSession: boolean
  headers?: Record<string, string>
  labSelection?: LighthouseLabSelection
}

export type LighthouseProgressReporter = (
  phase: LighthouseProgressPhase,
  label: string
) => void

export type LighthouseRunner = (
  input: LighthouseRunInput,
  signal: AbortSignal,
  onProgress: LighthouseProgressReporter
) => Promise<LighthouseAssessmentResult>

const PROGRESS_LABELS: Record<LighthouseProgressPhase, string> = {
  launching: 'Launching isolated Chrome…',
  loading: 'Loading page in audit target…',
  auditing: 'Collecting Lighthouse metrics…',
  projecting: 'Preparing results…',
  cleanup: 'Cleaning up…'
}

function profileLabel(profile: LighthouseProfile): string {
  return profile === 'mobile' ? 'Mobile' : 'Desktop'
}

function phaseLabel(profile: LighthouseProfile, phase: LighthouseProgressPhase): string {
  return `${profileLabel(profile)} · ${PROGRESS_LABELS[phase]}`
}

export class LighthouseManager {
  private state: LighthouseAssessmentState = {
    phase: 'idle',
    results: { ...EMPTY_LIGHTHOUSE_RESULTS },
    error: null,
    progress: null
  }
  private abort: AbortController | null = null
  private runId = 0
  constructor(
    private readonly notify: (state: LighthouseAssessmentState) => void,
    private readonly runner: LighthouseRunner = runLighthouse
  ) {}
  getState(): LighthouseAssessmentState {
    return this.state
  }
  async run(input: LighthouseDualRunInput): Promise<LighthouseAssessmentState> {
    if (this.state.phase === 'running') return this.state
    const runId = ++this.runId
    this.abort = new AbortController()
    const paneId = input.paneId ?? 'desktop'
    const targetUrl = sanitizeUrl(input.url)
    const labSelection = input.labSelection ?? DEFAULT_LIGHTHOUSE_LAB_SELECTION
    let results: LighthouseResultsByProfile = { ...EMPTY_LIGHTHOUSE_RESULTS }

    this.set({
      phase: 'running',
      results,
      error: null,
      activeProfile: 'mobile',
      paneId,
      targetUrl,
      progress: {
        runId,
        profile: 'mobile',
        phase: 'launching',
        label: phaseLabel('mobile', 'launching')
      }
    })

    try {
      for (const profile of LIGHTHOUSE_PROFILES) {
        if (this.abort.signal.aborted || runId !== this.runId) {
          return this.set({
            phase: 'cancelled',
            results,
            error: null,
            progress: null
          })
        }

        this.set({
          phase: 'running',
          results,
          error: null,
          activeProfile: profile,
          paneId,
          targetUrl,
          progress: {
            runId,
            profile,
            phase: 'launching',
            label: phaseLabel(profile, 'launching')
          }
        })

        const result = await this.runner(
          {
            url: input.url,
            profile,
            paneId,
            shareSession: input.shareSession,
            headers: input.headers,
            labSelection
          },
          this.abort.signal,
          (phase) => {
            if (runId !== this.runId || this.state.phase !== 'running') return
            this.set({
              ...this.state,
              activeProfile: profile,
              progress: {
                runId,
                profile,
                phase,
                label: phaseLabel(profile, phase)
              }
            })
          }
        )

        if (this.abort.signal.aborted || runId !== this.runId) {
          return this.set({
            phase: 'cancelled',
            results,
            error: null,
            progress: null
          })
        }

        results = { ...results, [profile]: result }
        this.set({
          phase: 'running',
          results,
          error: null,
          activeProfile: profile,
          paneId,
          targetUrl,
          progress: {
            runId,
            profile,
            phase: 'cleanup',
            label: phaseLabel(profile, 'cleanup')
          }
        })
      }

      return this.set({ phase: 'completed', results, error: null, progress: null })
    } catch (error) {
      return this.set(
        this.abort.signal.aborted
          ? { phase: 'cancelled', results, error: null, progress: null }
          : {
              phase: 'failed',
              results,
              error: sanitizeLighthouseError(error),
              progress: null
            }
      )
    } finally {
      this.abort = null
    }
  }
  cancel(): void {
    this.runId++
    this.abort?.abort()
  }
  handlePaneDocumentChange(paneId: PaneId): void {
    if (this.state.phase === 'running' && this.state.paneId === paneId) this.cancel()
    this.markStale(paneId)
  }
  markStale(paneId?: PaneId): void {
    if (!Object.values(this.state.results).some(Boolean)) return
    this.set({
      ...this.state,
      results: markLighthouseResultsStale(this.state.results, paneId)
    } as LighthouseAssessmentState)
  }
  private set(state: LighthouseAssessmentState): LighthouseAssessmentState {
    this.state = state
    this.notify(state)
    return state
  }
}

export const runLighthouse: LighthouseRunner = async (input, signal, onProgress) => {
  onProgress('launching', PROGRESS_LABELS.launching)
  const lighthouse = (await import('lighthouse')).default
  const chrome = await launch({
    chromeFlags: ['--headless=new', '--no-first-run', '--disable-gpu']
  })
  const stop = (): void => {
    void chrome.kill()
  }
  signal.addEventListener('abort', stop, { once: true })
  try {
    if (signal.aborted) throw new Error('aborted')
    onProgress('loading', PROGRESS_LABELS.loading)
    const device = resolveLighthouseDevice(input.profile, input.labSelection)
    const network = resolveLighthouseNetwork(input.profile, input.labSelection)
    onProgress('auditing', PROGRESS_LABELS.auditing)
    const run = await lighthouse(input.url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'silent',
      formFactor: input.profile,
      screenEmulation: device.screenEmulation,
      throttlingMethod: network.throttlingMethod,
      ...(network.throttling ? { throttling: network.throttling } : {}),
      extraHeaders: input.shareSession ? input.headers : undefined
    })
    if (!run) throw new Error('Lighthouse returned no result')
    onProgress('projecting', PROGRESS_LABELS.projecting)
    const completedAt = Date.now()
    const lighthouseVersion = String(run.lhr.lighthouseVersion ?? 'unknown')
    const hostUa = String(run.lhr.environment?.hostUserAgent ?? '')
    const browserMatch = hostUa.match(/HeadlessChrome\/[\d.]+|Chrome\/[\d.]+/i)
    const browserLabel = browserMatch
      ? browserMatch[0].replace('HeadlessChrome', 'Headless Chromium')
      : 'Headless Chromium'
    return projectLighthouseResult(run.lhr, {
      id: `lighthouse-${completedAt}-${Math.random().toString(36).slice(2, 8)}`,
      paneId: input.paneId ?? 'desktop',
      profile: input.profile,
      requestedUrl: sanitizeUrl(input.url),
      shareSession: input.shareSession,
      startedAt: completedAt,
      completedAt,
      labSpec: buildLabSpecSnapshot({
        profile: input.profile,
        selection: input.labSelection,
        lighthouseVersion,
        browserLabel,
        completedAt
      })
    })
  } finally {
    onProgress('cleanup', PROGRESS_LABELS.cleanup)
    signal.removeEventListener('abort', stop)
    try {
      chrome.kill()
    } catch {
      /* already stopped */
    }
  }
}
