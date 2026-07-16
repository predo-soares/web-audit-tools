import { test, expect } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  launchApp,
  navigateTo,
  waitForAllPanes
} from './helpers'

test.describe('device emulation', () => {
  test('ua-sniffing fixture shows mobile markup in iPhone and desktop in desktop pane', async ({
    fixturePort
  }) => {
    const { window, close } = await launchApp()
    try {
      await navigateTo(window, fixtureUrl(fixturePort, '/ua-sniff'))
      await waitForAllPanes(window)

      const iphoneVariant = await evaluateInPane<string>(
        window,
        'iphone',
        `document.getElementById('layout')?.dataset.variant ?? ''`
      )
      const desktopVariant = await evaluateInPane<string>(
        window,
        'desktop',
        `document.getElementById('layout')?.dataset.variant ?? ''`
      )

      expect(iphoneVariant).toBe('mobile')
      expect(desktopVariant).toBe('desktop')
    } finally {
      await close()
    }
  })

  test('pointer and hover media queries match touch panes only', async ({ fixturePort }) => {
    const { window, close } = await launchApp()
    try {
      await navigateTo(window, fixtureUrl(fixturePort, '/pointer-hover'))
      await waitForAllPanes(window)

      for (const paneId of ['iphone', 'ipad'] as const) {
        const coarseVisible = await evaluateInPane<boolean>(
          window,
          paneId,
          `getComputedStyle(document.getElementById('coarse')).display !== 'none'`
        )
        const hoverNoneVisible = await evaluateInPane<boolean>(
          window,
          paneId,
          `getComputedStyle(document.getElementById('hover-none')).display !== 'none'`
        )
        expect(coarseVisible).toBe(true)
        expect(hoverNoneVisible).toBe(true)
      }

      const desktopFine = await evaluateInPane<boolean>(
        window,
        'desktop',
        `getComputedStyle(document.getElementById('fine')).display !== 'none'`
      )
      const desktopHover = await evaluateInPane<boolean>(
        window,
        'desktop',
        `getComputedStyle(document.getElementById('hover-hover')).display !== 'none'`
      )
      expect(desktopFine).toBe(true)
      expect(desktopHover).toBe(true)
    } finally {
      await close()
    }
  })

  test('viewport-meta fixture lays out mobile-correctly in iPhone and iPad panes', async ({
    fixturePort
  }) => {
    const { window, close } = await launchApp()
    try {
      await navigateTo(window, fixtureUrl(fixturePort, '/viewport-meta'))
      await waitForAllPanes(window)

      // Read the live emulated viewport width rather than the fixture's
      // load-time `dataset.width` snapshot, which is recorded by an inline script
      // before the CDP device-metrics override has applied (ADR 0004 emulation
      // timing) and so captures the pre-emulation width.
      const iphoneWidth = await evaluateInPane<number>(
        window,
        'iphone',
        `document.documentElement.clientWidth`
      )
      const ipadWidth = await evaluateInPane<number>(
        window,
        'ipad',
        `document.documentElement.clientWidth`
      )

      expect(iphoneWidth).toBeGreaterThan(350)
      expect(iphoneWidth).toBeLessThan(420)
      expect(ipadWidth).toBeGreaterThan(780)
      expect(ipadWidth).toBeLessThan(900)
    } finally {
      await close()
    }
  })

  test('dpr fixture selects the 3x image in the iPhone pane', async ({ fixturePort }) => {
    const { window, close } = await launchApp()
    try {
      await navigateTo(window, fixtureUrl(fixturePort, '/dpr-image'))
      await waitForAllPanes(window)

      await evaluateInPane(
        window,
        'iphone',
        `new Promise((resolve) => {
          const img = document.getElementById('hero');
          if (img.complete) return resolve();
          img.addEventListener('load', () => resolve(), { once: true });
        })`
      )

      const loaded = await evaluateInPane<string>(
        window,
        'iphone',
        `document.getElementById('hero')?.currentSrc ?? ''`
      )
      expect(loaded).toContain('image-3x.png')
    } finally {
      await close()
    }
  })
})
