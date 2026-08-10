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
  const lighthouseView = window.getByTestId('lighthouse-view')
  await expect(lighthouseView).toBeVisible()
  await expect(lighthouseView).toHaveCSS('position', 'relative')
  return window
}

test('flags an invalid URL in the Lighthouse target bar', async () => {
  const { window, close } = await launchApp()

  try {
    await waitForAllPanes(window)
    const panel = await openLighthouseView(window)
    const input = panel.getByTestId('lighthouse-target-url')
    await expect(panel.getByTestId('lighthouse-tab-mobile')).toHaveCount(0)
    await expect(panel.getByTestId('lighthouse-tab-desktop')).toHaveCount(0)

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

test('renders the final Lighthouse screenshot in the results summary', async ({ fixturePort }) => {
  test.setTimeout(180_000)
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/with-title'))
    await waitForPaneElement(window, 'desktop', 'seo-with-title')

    const panel = await openLighthouseView(window)
    const runButton = panel.getByTestId('lighthouse-run')
    await runButton.click()
    const progress = panel.getByTestId('lighthouse-progress')
    await expect(progress).toBeVisible({ timeout: 5000 })
    await expect(progress).toHaveCSS('position', 'fixed')
    await expect
      .poll(() =>
        progress.evaluate((element) => {
          const { left, top, width } = element.getBoundingClientRect()
          return (
            Math.round(left) === 0 &&
            Math.round(top) === 0 &&
            Math.round(width) === document.documentElement.clientWidth
          )
        })
      )
      .toBe(true)
    await expect(progress.getByRole('progressbar')).toHaveAttribute('aria-valuenow')
    await expect(runButton).toBeEnabled({ timeout: 120_000 })

    const screenshot = panel.getByTestId('lighthouse-final-screenshot')
    await expect(screenshot).toBeVisible({ timeout: 120_000 })
    await expect(panel.getByTestId('lighthouse-tab-mobile')).toBeVisible()
    await expect(panel.getByTestId('lighthouse-tab-desktop')).toBeVisible()
    await expect(screenshot).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
    await expect
      .poll(() => screenshot.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)

    const specs = panel.getByTestId('lighthouse-specs')
    await expect(specs).toBeVisible()
    await expect(specs).toHaveAttribute('aria-label', 'Lighthouse lab specs')
    await expect(specs).toHaveCSS('position', 'sticky')

    const performance = panel.getByTestId('lighthouse-performance-overview')
    await performance.hover()
    const subgauges = performance.getByTestId('lighthouse-performance-subgauge')
    await expect(subgauges).toHaveCount(5)
    await expect
      .poll(() => subgauges.first().evaluate((element) => getComputedStyle(element).opacity))
      .toBe('1')
  } finally {
    await close()
  }
})
