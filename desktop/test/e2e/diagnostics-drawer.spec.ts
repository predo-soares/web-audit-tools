import { test, expect } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  getDiagnosticsDrawerPage,
  getToolbarPage,
  launchApp,
  navigateTo,
  waitForPaneElement
} from './helpers'

test('diagnostics drawer shows console errors from the active pane', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-console-error')?.click()`
    )

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    const errorEntry = drawer
      .getByTestId('diagnostics-console-entry')
      .filter({ hasText: 'fixture-runtime-error' })
    await expect(errorEntry).toBeVisible()
    await expect(errorEntry.getByText('deliberate test error')).toBeVisible()
    await expect(errorEntry.getByTestId('diagnostics-console-level')).toHaveText('error')
  } finally {
    await close()
  }
})

test('diagnostics drawer network tab shows failed fetch from the active pane', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-fetch-404')?.click()`
    )

    await window.waitForTimeout(500)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    await drawer.getByTestId('diagnostics-tab-network').click()

    const failedEntry = drawer
      .getByTestId('diagnostics-network-entry')
      .filter({ has: drawer.getByTestId('diagnostics-network-path').filter({ hasText: '/runtime-evidence/api/missing' }) })
    await expect(failedEntry).toBeVisible()
    await expect(failedEntry.getByTestId('diagnostics-network-status')).toHaveText('404')
    await expect(failedEntry.getByTestId('diagnostics-network-method')).toHaveText('GET')
  } finally {
    await close()
  }
})
