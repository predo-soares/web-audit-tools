import { launch } from 'chrome-launcher'
import type {
  LighthouseAssessmentResult,
  LighthouseAssessmentState,
  LighthouseProfile
} from '../../shared/lighthouse'
import { projectLighthouseResult, sanitizeLighthouseError } from '../../shared/lighthouse'
import { sanitizeUrl } from '../../shared/seo-sanitize'
import type { PaneId } from '../../shared/types'

export interface LighthouseRunInput {
  url: string
  profile: LighthouseProfile
  paneId?: PaneId
  shareSession: boolean
  headers?: Record<string, string>
}
export type LighthouseRunner = (
  input: LighthouseRunInput,
  signal: AbortSignal
) => Promise<LighthouseAssessmentResult>

export class LighthouseManager {
  private state: LighthouseAssessmentState = {
    phase: 'idle',
    result: null,
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
  async run(input: LighthouseRunInput): Promise<LighthouseAssessmentState> {
    if (this.state.phase === 'running') return this.state
    const runId = ++this.runId
    this.abort = new AbortController()
    this.set({
      phase: 'running',
      result: this.state.result,
      error: null,
      profile: input.profile,
      targetUrl: sanitizeUrl(input.url),
      progress: { runId, phase: 'launching', label: 'Launching isolated Chrome target…' }
    })
    try {
      const result = await this.runner(input, this.abort.signal)
      if (this.abort.signal.aborted || runId !== this.runId)
        return this.set({ phase: 'cancelled', result: this.state.result, error: null, progress: null })
      return this.set({ phase: 'completed', result, error: null, progress: null })
    } catch (error) {
      return this.set(
        this.abort.signal.aborted
          ? { phase: 'cancelled', result: this.state.result, error: null, progress: null }
          : {
              phase: 'failed',
              result: this.state.result,
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
  markStale(): void {
    if (this.state.result)
      this.set({
        ...this.state,
        result: { ...this.state.result, stale: true }
      } as LighthouseAssessmentState)
  }
  private set(state: LighthouseAssessmentState): LighthouseAssessmentState {
    this.state = state
    this.notify(state)
    return state
  }
}

export const runLighthouse: LighthouseRunner = async (input, signal) => {
  const lighthouse = (await import('lighthouse')).default
  const chrome = await launch({
    chromeFlags: ['--headless=new', '--no-first-run', '--disable-gpu']
  })
  const stop = (): void => {
    void chrome.kill()
  }
  signal.addEventListener('abort', stop, { once: true })
  try {
    const desktop = input.profile === 'desktop'
    const run = await lighthouse(input.url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'silent',
      formFactor: input.profile,
      screenEmulation: desktop
        ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
        : { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
      extraHeaders: input.shareSession ? input.headers : undefined
    })
    if (!run) throw new Error('Lighthouse returned no result')
    const completedAt = Date.now()
    return projectLighthouseResult(run.lhr, {
      id: `lighthouse-${completedAt}-${Math.random().toString(36).slice(2, 8)}`,
      paneId: input.paneId ?? 'desktop',
      profile: input.profile,
      requestedUrl: sanitizeUrl(input.url),
      shareSession: input.shareSession,
      startedAt: completedAt,
      completedAt
    })
  } finally {
    signal.removeEventListener('abort', stop)
    try {
      chrome.kill()
    } catch {
      /* already stopped */
    }
  }
}
