import { test, expect } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  getToolbarPage,
  launchApp,
  navigateTo,
  waitForAllPanes
} from './helpers'

test('Element picker selects a page element without leaving Preview', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/'))
    await waitForAllPanes(window)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('inspection-toggle').click()
    await expect(toolbar.getByTestId('inspection-toggle')).toHaveAttribute('aria-pressed', 'true')

    await evaluateInPane(window, 'desktop', `document.getElementById('fixture-home')?.click()`)

    await expect(window.getByTestId('inspection-rail')).toBeVisible()
    await expect(window.getByTestId('inspection-status')).toHaveText('Matched')
    await expect(window.getByTestId('inspection-rail')).toContainText('desktop')
    await expect(window.getByTestId('preview-canvas')).toBeVisible()

    await window.getByTestId('inspection-close').click()
    await expect(window.getByTestId('inspection-rail')).toHaveCount(0)
    await expect(toolbar.getByTestId('inspection-toggle')).toHaveAttribute('aria-pressed', 'false')
  } finally {
    await close()
  }
})

test('Element picker compares visible panes independently of interaction links', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/ua-sniff'))
    await waitForAllPanes(window)
    await window.evaluate(() => window.api.setPaneLinked('ipad', false))

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('inspection-toggle').click()
    await evaluateInPane(window, 'desktop', `document.getElementById('layout')?.click()`)

    await expect(window.getByTestId('inspection-result-iphone')).toContainText('Matched')
    await expect(window.getByTestId('inspection-result-ipad')).toContainText('Matched')
    await expect(window.getByTestId('inspection-result-desktop')).toContainText('Matched')
    await expect(window.getByTestId('inspection-result-ipad')).toContainText('Independent')
    await expect(window.getByTestId('inspection-difference-width')).toBeVisible()
  } finally {
    await close()
  }
})
