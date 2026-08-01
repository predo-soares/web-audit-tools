import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import {
  fixtureUrl,
  getSidebarPage,
  launchApp,
  navigateTo,
  waitForAllPanes,
  waitForPaneElement
} from './helpers'

// Opens the Lighthouse workspace from the sidebar. Kept local because these are
// the only tests that need it.
async function openLighthouseView(window: Page): Promise<Page> {
  const sidebar = await getSidebarPage(window)
  await sidebar.getByTestId('sidebar-lighthouse-view').click()
  await expect(window.getByTestId('lighthouse-view')).toBeVisible()
  return window
}

test('flags an invalid URL in the Lighthouse target bar', async () => {
  const { window, close } = await launchApp()

  try {
    await waitForAllPanes(window)
    const panel = await openLighthouseView(window)
    const input = panel.getByTestId('lighthouse-target-url')

    await input.fill('not a url')
    await input.press('Enter')
    await expect(panel.getByTestId('lighthouse-url-error')).toBeVisible()
    await expect(input).toHaveAttribute('aria-invalid', 'true')

    // Editing the value clears the error without navigating anywhere.
    await input.fill('https://example.com')
    await expect(panel.getByTestId('lighthouse-url-error')).toHaveCount(0)
  } finally {
    await close()
  }
})

test('suggests visited pages from history in the Lighthouse target bar', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/with-title'))
    await waitForPaneElement(window, 'desktop', 'seo-with-title')

    const panel = await openLighthouseView(window)
    const input = panel.getByTestId('lighthouse-target-url')
    await input.click()

    const history = panel.getByTestId('lighthouse-url-history')
    await expect(history).toBeVisible()
    await expect(history.getByTestId('lighthouse-url-history-item').first()).toContainText(
      'with-title'
    )
  } finally {
    await close()
  }
})
