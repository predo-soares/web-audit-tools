import { describe, expect, it, vi } from 'vitest'
import { LighthouseManager } from '../../src/main/seo/lighthouse-manager'
import type { LighthouseAssessmentResult } from '../../src/shared/lighthouse'

function makeResult(
  profile: 'mobile' | 'desktop',
  paneId: 'iphone' | 'desktop' = 'iphone'
): LighthouseAssessmentResult {
  return {
    id: `lh-${profile}`,
    paneId,
    lighthouseVersion: '13.4.0',
    configuration: 'navigation-default',
    deviceMode: profile,
    startedAt: 1,
    completedAt: 10,
    requestedUrl: 'https://site.test/',
    finalUrl: 'https://site.test/',
    targetUrl: 'https://site.test/',
    pageAuditId: null,
    shareSession: false,
    distinctLoad: true,
    stale: false,
    categories: [{ id: 'performance', title: 'Performance', score: 0.9, auditIds: [] }],
    scores: { performance: 0.9 },
    audits: {},
    auditGroups: {},
    opportunityIds: [],
    diagnosticIds: [],
    retainedAuditCount: 0,
    totalAuditCount: 0,
    truncatedAuditCount: 0,
    labSpec: {
      deviceId: profile === 'mobile' ? 'moto-g-power' : 'desktop-1350',
      deviceLabel: profile === 'mobile' ? 'Moto G Power' : 'Desktop 1350×940',
      networkId: profile === 'mobile' ? 'slow-4g' : 'none',
      networkLabel: profile === 'mobile' ? 'Slow 4G throttling' : 'No network throttling',
      cpuLabel: profile === 'mobile' ? '4× CPU slowdown' : 'No CPU throttling',
      formFactor: profile,
      screen: {
        mobile: profile === 'mobile',
        width: profile === 'mobile' ? 412 : 1350,
        height: profile === 'mobile' ? 823 : 940,
        deviceScaleFactor: profile === 'mobile' ? 1.75 : 1,
        disabled: false
      },
      browserLabel: 'Headless Chromium',
      lighthouseVersion: '13.4.0',
      completedAt: 10
    }
  }
}

describe('LighthouseManager', () => {
  it('runs mobile then desktop and stores both results', async () => {
    const states: string[] = []
    const profiles: string[] = []
    const runner = vi.fn(
      async (
        input: { profile: 'mobile' | 'desktop' },
        _signal: AbortSignal,
        onProgress: (phase: string, label: string) => void
      ) => {
        profiles.push(input.profile)
        onProgress('auditing', 'Auditing…')
        return makeResult(input.profile)
      }
    )
    const manager = new LighthouseManager((state) => {
      states.push(state.phase)
    }, runner)

    const completed = await manager.run({
      url: 'https://site.test/',
      paneId: 'iphone',
      shareSession: false
    })

    expect(profiles).toEqual(['mobile', 'desktop'])
    expect(runner).toHaveBeenCalledTimes(2)
    expect(completed.phase).toBe('completed')
    expect(completed.results.mobile).toMatchObject({
      lighthouseVersion: '13.4.0',
      deviceMode: 'mobile',
      distinctLoad: true
    })
    expect(completed.results.desktop).toMatchObject({
      deviceMode: 'desktop'
    })
    expect(states.at(-1)).toBe('completed')
  })

  it('cancels the owned run and keeps partial results', async () => {
    let releaseDesktop: (() => void) | null = null
    const desktopStarted = new Promise<void>((resolve) => {
      releaseDesktop = resolve
    })
    const runner = (
      input: { profile: 'mobile' | 'desktop' },
      signal: AbortSignal
    ): Promise<LighthouseAssessmentResult> => {
      if (input.profile === 'mobile') return Promise.resolve(makeResult('mobile'))
      releaseDesktop?.()
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted')))
      )
    }
    const manager = new LighthouseManager(() => {}, runner)
    const pending = manager.run({
      url: 'https://site.test/',
      paneId: 'desktop',
      shareSession: true,
      headers: { Cookie: 'private' }
    })
    await desktopStarted
    manager.cancel()
    const cancelled = await pending
    expect(cancelled.phase).toBe('cancelled')
    expect(cancelled.results.mobile?.deviceMode).toBe('mobile')
    expect(cancelled.results.desktop).toBeNull()
  })

  it('marks completed results stale without rerunning', async () => {
    const manager = new LighthouseManager(
      () => {},
      async (input) => makeResult(input.profile)
    )
    await manager.run({
      url: 'https://site.test/',
      paneId: 'iphone',
      shareSession: false
    })
    manager.markStale()
    expect(manager.getState().results.mobile?.stale).toBe(true)
    expect(manager.getState().results.desktop?.stale).toBe(true)
  })

  it('marks only the matching pane result stale', async () => {
    const manager = new LighthouseManager(
      () => {},
      async (input) => makeResult(input.profile, 'iphone')
    )
    await manager.run({
      url: 'https://site.test/',
      paneId: 'iphone',
      shareSession: false
    })
    manager.handlePaneDocumentChange('desktop')
    expect(manager.getState().results.mobile?.stale).toBe(false)
    manager.handlePaneDocumentChange('iphone')
    expect(manager.getState().results.mobile?.stale).toBe(true)
    expect(manager.getState().results.desktop?.stale).toBe(true)
  })
})
