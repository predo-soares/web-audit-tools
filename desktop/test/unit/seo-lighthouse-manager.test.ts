import { describe, expect, it, vi } from 'vitest'
import { LighthouseManager } from '../../src/main/seo/lighthouse-manager'
import type { LighthouseAssessmentResult } from '../../src/shared/seo-audit'

const result: LighthouseAssessmentResult = {
  lighthouseVersion: '13.4.0',
  configuration: 'navigation-default',
  deviceMode: 'mobile',
  completedAt: 10,
  targetUrl: 'https://site.test/',
  pageAuditId: 'audit-1',
  distinctLoad: true,
  stale: false,
  scores: { performance: 0.9 },
  findings: []
}

describe('LighthouseManager', () => {
  it('owns progress and attributed results outside the visible pane', async () => {
    const states: string[] = []
    const runner = vi.fn().mockResolvedValue(result)
    const manager = new LighthouseManager((state) => states.push(state.phase), runner)
    const completed = await manager.run({
      url: 'https://site.test/',
      profile: 'mobile',
      pageAuditId: 'audit-1',
      shareSession: false
    })
    expect(states).toEqual(['running', 'completed'])
    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({ shareSession: false, profile: 'mobile' }),
      expect.any(AbortSignal)
    )
    expect(completed.result).toMatchObject({ lighthouseVersion: '13.4.0', distinctLoad: true })
  })

  it('cancels the owned run and keeps the hidden lifecycle from leaking', async () => {
    const runner = (_input: unknown, signal: AbortSignal): Promise<LighthouseAssessmentResult> =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted')))
      )
    const manager = new LighthouseManager(() => {}, runner)
    const pending = manager.run({
      url: 'https://site.test/',
      profile: 'desktop',
      pageAuditId: null,
      shareSession: true,
      headers: { Cookie: 'private' }
    })
    manager.cancel()
    expect((await pending).phase).toBe('cancelled')
  })

  it('marks completed results stale without rerunning', async () => {
    const manager = new LighthouseManager(
      () => {},
      async () => result
    )
    await manager.run({
      url: 'https://site.test/',
      profile: 'mobile',
      pageAuditId: 'audit-1',
      shareSession: false
    })
    manager.markStale()
    expect(manager.getState().result?.stale).toBe(true)
  })
})
