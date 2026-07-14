import { test, expect } from './fixtures'
import {
  fixtureUrl,
  getSeoPanelPage,
  getToolbarPage,
  launchApp,
  navigateTo,
  waitForAllPanes,
  waitForPaneElement
} from './helpers'

test('runs a full audit and reports a passed title finding', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/with-title'))
    await waitForPaneElement(window, 'desktop', 'seo-with-title')

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()

    const panel = await getSeoPanelPage(window)
    await expect(panel.getByTestId('seo-target-url')).toHaveText(
      fixtureUrl(fixturePort, '/seo/with-title')
    )

    // No result until the user explicitly runs the audit.
    await expect(panel.getByTestId('seo-result')).toHaveCount(0)

    await panel.getByTestId('seo-run-audit').click()

    const result = panel.getByTestId('seo-result')
    await expect(result).toBeVisible()
    await expect(panel.getByTestId('seo-catalog-version')).toBeVisible()

    const titleFinding = panel.locator(
      '[data-testid="seo-finding"][data-rule-id="search-appearance/title-present"]'
    )
    await expect(titleFinding).toHaveAttribute('data-outcome', 'passed')
    await expect(titleFinding.getByTestId('seo-finding-evidence')).toContainText('Fixture SEO Page')
    // No proprietary overall score is shown.
    await expect(result).not.toContainText('score')
  } finally {
    await close()
  }
})

test('reports an error finding when the page has no title', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/no-title'))
    await waitForPaneElement(window, 'desktop', 'seo-no-title')

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()

    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()

    const titleFinding = panel.locator(
      '[data-testid="seo-finding"][data-rule-id="search-appearance/title-present"]'
    )
    await expect(titleFinding).toHaveAttribute('data-outcome', 'error')
    await expect(titleFinding.getByTestId('seo-finding-summary')).toHaveText('Page has no title')
    await expect(titleFinding.getByTestId('seo-finding-remediation')).toBeVisible()
  } finally {
    await close()
  }
})

test('explains there is nothing to audit before a page is committed', async () => {
  const { window, close } = await launchApp()

  try {
    await waitForAllPanes(window)
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()

    const panel = await getSeoPanelPage(window)
    await expect(panel.getByTestId('seo-empty')).toBeVisible()
    await expect(panel.getByTestId('seo-run-audit')).toHaveCount(0)
  } finally {
    await close()
  }
})
