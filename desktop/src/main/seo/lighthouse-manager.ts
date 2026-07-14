import { launch } from 'chrome-launcher'
import type {
  LighthouseAssessmentResult,
  LighthouseAssessmentState,
  LighthouseProfile
} from '../../shared/seo-audit'
import { sanitizeUrl } from '../../shared/seo-sanitize'

export interface LighthouseRunInput {
  url: string
  profile: LighthouseProfile
  pageAuditId: string | null
  shareSession: boolean
  headers?: Record<string, string>
}
export type LighthouseRunner = (
  input: LighthouseRunInput,
  signal: AbortSignal
) => Promise<LighthouseAssessmentResult>

export class LighthouseManager {
  private state: LighthouseAssessmentState = { phase: 'idle', result: null, error: null }
  private abort: AbortController | null = null
  constructor(
    private readonly notify: (state: LighthouseAssessmentState) => void,
    private readonly runner: LighthouseRunner = runLighthouse
  ) {}
  getState(): LighthouseAssessmentState {
    return this.state
  }
  async run(input: LighthouseRunInput): Promise<LighthouseAssessmentState> {
    if (this.state.phase === 'running') return this.state
    this.abort = new AbortController()
    this.set({
      phase: 'running',
      result: this.state.result,
      error: null,
      profile: input.profile,
      targetUrl: sanitizeUrl(input.url)
    })
    try {
      const result = await this.runner(input, this.abort.signal)
      if (this.abort.signal.aborted)
        return this.set({ phase: 'cancelled', result: this.state.result, error: null })
      return this.set({ phase: 'completed', result, error: null })
    } catch (error) {
      return this.set(
        this.abort.signal.aborted
          ? { phase: 'cancelled', result: this.state.result, error: null }
          : {
              phase: 'failed',
              result: this.state.result,
              error: error instanceof Error ? error.message : String(error)
            }
      )
    } finally {
      this.abort = null
    }
  }
  cancel(): void {
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
    const categories = run.lhr.categories
    return {
      lighthouseVersion: run.lhr.lighthouseVersion,
      configuration: 'navigation-default',
      deviceMode: input.profile,
      completedAt: Date.now(),
      targetUrl: sanitizeUrl(input.url),
      pageAuditId: input.pageAuditId,
      distinctLoad: true,
      stale: false,
      scores: Object.fromEntries(
        Object.entries(categories).map(([id, category]) => [id, category.score])
      ),
      findings: Object.values(run.lhr.audits)
        .filter((audit) => audit.score !== null && audit.score < 1)
        .slice(0, 30)
        .map((audit) => ({
          id: audit.id,
          title: audit.title,
          score: audit.score,
          displayValue: audit.displayValue ?? null
        }))
    }
  } finally {
    signal.removeEventListener('abort', stop)
    try {
      chrome.kill()
    } catch {
      /* already stopped */
    }
  }
}
