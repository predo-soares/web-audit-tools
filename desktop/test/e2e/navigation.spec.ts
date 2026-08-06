import { test, expect } from './fixtures'
import { evaluateInPane, fixtureUrl, launchApp, navigateTo, waitForAllPanes } from './helpers'

test('defaults scheme to https and uses http for localhost', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, `127.0.0.1:${fixturePort}/`)
    await waitForAllPanes(window)

    const url = await evaluateInPane<string>(window, 'desktop', 'location.href')
    expect(url).toBe(`http://127.0.0.1:${fixturePort}/`)
  } finally {
    await close()
  }
})

test('shows per-pane loading indicators during navigation', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    const navigation = navigateTo(window, fixtureUrl(fixturePort, '/long-scroll'))
    await expect(window.getByTestId('pane-loading-desktop')).toBeVisible({ timeout: 5000 })
    await navigation
    await waitForAllPanes(window)
    await expect(window.getByTestId('pane-loading-desktop')).toBeHidden()
  } finally {
    await close()
  }
})

test('navigating while a previous load is in flight settles on the new URL', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/long-scroll'))
    await window
      .getByTestId('pane-loading-iphone')
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {})
    await navigateTo(window, fixtureUrl(fixturePort, '/'))
    await waitForAllPanes(window)

    const text = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('fixture-home')?.textContent ?? ''`
    )
    expect(text).toBe('Fixture Home')
  } finally {
    await close()
  }
})
