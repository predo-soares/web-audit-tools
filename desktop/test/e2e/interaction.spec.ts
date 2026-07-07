import { test, expect } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  launchApp,
  navigateTo,
  waitForAllPanes,
  waitForPaneElement,
  waitForPaneLoad
} from './helpers'

test('clicking a link inside one pane navigates only that pane and updates the URL bar', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/flow-a'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `document.getElementById('flow-link').click()`)
    await waitForPaneElement(window, 'iphone', 'flow-b')

    const iphoneText = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('flow-b')?.textContent ?? ''`
    )
    expect(iphoneText).toBe('Flow page B')

    for (const paneId of ['ipad', 'desktop'] as const) {
      const text = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('flow-a')?.textContent ?? ''`
      )
      expect(text).toBe('Flow page A')
    }

    await expect(window.getByTestId('url-input')).toHaveValue(/\/flow-b/)
  } finally {
    await close()
  }
})

test('per-pane loading indicator fires during in-pane link-click navigation', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/'))
    await waitForAllPanes(window)

    const longScrollUrl = fixtureUrl(fixturePort, '/long-scroll')
    const loadingVisible = window
      .getByTestId('pane-loading-iphone')
      .waitFor({ state: 'visible', timeout: 5_000 })

    await evaluateInPane(
      window,
      'iphone',
      `(() => { const a = document.createElement('a'); a.href = '${longScrollUrl}'; document.body.appendChild(a); a.click(); })()`
    )

    await loadingVisible
    await waitForPaneLoad(window, 'iphone')
    await expect(window.getByTestId('pane-loading-iphone')).toBeHidden()
  } finally {
    await close()
  }
})

test('form submit inside a pane sends the correct emulated UA in the resulting POST request', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/ua-form'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `document.getElementById('ua-submit').click()`)
    await waitForPaneElement(window, 'iphone', 'ua-result')

    const ua = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('ua-result')?.dataset.userAgent ?? ''`
    )
    expect(ua).toContain('iPhone')
  } finally {
    await close()
  }
})

test('history.back() inside a pane returns only that pane to the previous URL and updates the URL bar', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/flow-a'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `document.getElementById('flow-link').click()`)
    await waitForPaneElement(window, 'iphone', 'flow-b')

    await evaluateInPane(window, 'iphone', `history.back()`)
    await waitForPaneElement(window, 'iphone', 'flow-a')

    const iphoneText = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('flow-a')?.textContent ?? ''`
    )
    expect(iphoneText).toBe('Flow page A')

    for (const paneId of ['ipad', 'desktop'] as const) {
      const text = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('flow-a')?.textContent ?? ''`
      )
      expect(text).toBe('Flow page A')
    }

    await expect(window.getByTestId('url-input')).toHaveValue(/\/flow-a/)
  } finally {
    await close()
  }
})

test('submitting a URL from the bar navigates all panes after per-pane divergence', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/flow-a'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `document.getElementById('flow-link').click()`)
    await waitForPaneElement(window, 'iphone', 'flow-b')

    await navigateTo(window, fixtureUrl(fixturePort, '/'))
    await waitForAllPanes(window)

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      const text = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('fixture-home')?.textContent ?? ''`
      )
      expect(text).toBe('Fixture Home')
    }
  } finally {
    await close()
  }
})
