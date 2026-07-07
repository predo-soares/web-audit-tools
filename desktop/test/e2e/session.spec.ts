import { test, expect } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  launchApp,
  navigateTo,
  waitForAllPanes
} from './helpers'

test('strict-header fixture loads in all panes', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/strict-headers'))
    await waitForAllPanes(window)

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      const text = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('strict-ok')?.textContent ?? ''`
      )
      expect(text).toBe('Strict headers page')
    }
  } finally {
    await close()
  }
})

test('login in one pane is reflected in the others after reload', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/login'))
    await waitForAllPanes(window)

    await evaluateInPane(
      window,
      'iphone',
      `document.getElementById('login-btn')?.click()`
    )
    await waitForAllPanes(window)

    await navigateTo(window, fixtureUrl(fixturePort, '/auth-check'))
    await waitForAllPanes(window)

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      const status = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('auth-status')?.dataset.authed ?? ''`
      )
      expect(status).toBe('yes')
    }
  } finally {
    await close()
  }
})

test('ua request header matches each pane emulated ua', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/ua-echo'))
    await waitForAllPanes(window)

    const iphoneUa = await evaluateInPane<string>(
      window,
      'iphone',
      `document.body.textContent || ''`
    )
    const desktopUa = await evaluateInPane<string>(
      window,
      'desktop',
      `document.body.textContent || ''`
    )

    const iphoneJson = JSON.parse(iphoneUa) as { userAgent: string }
    const desktopJson = JSON.parse(desktopUa) as { userAgent: string }

    expect(iphoneJson.userAgent).toContain('iPhone')
    expect(desktopJson.userAgent).toContain('Chrome/')
  } finally {
    await close()
  }
})
