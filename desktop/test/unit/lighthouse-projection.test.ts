import { describe, expect, it } from 'vitest'
import { projectLighthouseResult, sanitizeLighthouseError } from '../../src/shared/lighthouse'

describe('Lighthouse result projection', () => {
  it('projects categories and prioritizes opportunities and diagnostics', () => {
    const result = projectLighthouseResult(
      {
        lighthouseVersion: '13.4.0',
        finalDisplayedUrl: 'https://site.test/final',
        categories: {
          performance: {
            title: 'Performance',
            score: 0.82,
            auditRefs: [
              { id: 'unused-css', group: 'load-opportunities' },
              { id: 'main-thread', group: 'diagnostics' }
            ]
          }
        },
        audits: {
          'unused-css': { title: 'Remove unused CSS', score: 0.2, displayValue: '120 KiB' },
          'main-thread': { title: 'Main thread work', score: 0.5, numericValue: 2400 },
          'final-screenshot': {
            title: 'Final screenshot',
            score: 1,
            details: { type: 'screenshot', data: 'data:image/jpeg;base64,Y2FwdHVyZQ==' }
          }
        }
      },
      {
        id: 'lh-1',
        paneId: 'iphone',
        profile: 'mobile',
        requestedUrl: 'https://site.test/',
        shareSession: false,
        startedAt: 1,
        completedAt: 2,
        labSpec: {
          deviceId: 'moto-g-power',
          deviceLabel: 'Moto G Power',
          networkId: 'slow-4g',
          networkLabel: 'Slow 4G throttling',
          cpuLabel: '4× CPU slowdown',
          formFactor: 'mobile',
          screen: {
            mobile: true,
            width: 412,
            height: 823,
            deviceScaleFactor: 1.75,
            disabled: false
          },
          browserLabel: 'Headless Chromium',
          lighthouseVersion: '13.4.0',
          completedAt: 2
        }
      }
    )

    expect(result.categories[0]).toMatchObject({ id: 'performance', score: 0.82 })
    expect(result.opportunityIds).toEqual(['unused-css'])
    expect(result.diagnosticIds).toEqual(['main-thread'])
    expect(result.finalUrl).toBe('https://site.test/final')
    expect(result.labSpec.deviceLabel).toBe('Moto G Power')
    expect(result.screenshotDataUrl).toBe('data:image/jpeg;base64,Y2FwdHVyZQ==')
  })

  it('rejects non-image final screenshot data', () => {
    const result = projectLighthouseResult(
      {
        audits: { 'final-screenshot': { details: { data: 'data:text/html;base64,PHNjcmlwdD4=' } } }
      },
      {
        id: 'lh-2',
        paneId: 'desktop',
        profile: 'desktop',
        requestedUrl: 'https://site.test/',
        shareSession: false,
        startedAt: 1,
        completedAt: 2,
        labSpec: {
          deviceId: 'desktop-1350',
          deviceLabel: 'Desktop 1350×940',
          networkId: 'none',
          networkLabel: 'No network throttling',
          cpuLabel: 'No CPU throttling',
          formFactor: 'desktop',
          screen: {
            mobile: false,
            width: 1350,
            height: 940,
            deviceScaleFactor: 1,
            disabled: false
          },
          browserLabel: 'Headless Chromium',
          lighthouseVersion: '13.4.0',
          completedAt: 2
        }
      }
    )

    expect(result.screenshotDataUrl).toBeNull()
  })

  it('sanitizes sensitive failure text', () => {
    expect(
      sanitizeLighthouseError(new Error('failed /Users/me/secret Cookie:token'))
    ).not.toContain('/Users/me/secret')
  })
})
