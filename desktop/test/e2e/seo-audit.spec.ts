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

test('verifies localized alternates with bounded reciprocal checks', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/i18n'))
    await waitForPaneElement(window, 'desktop', 'seo-i18n')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()
    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()
    const section = panel.getByTestId('seo-internationalization')
    await expect(section.getByTestId('seo-hreflang-item')).toHaveCount(3)
    await expect(section).toContainText('x-default')
    await expect(section).toContainText('reciprocal yes')
    await expect(
      panel.locator(
        '[data-testid="seo-finding"][data-rule-id="internationalization/hreflang-syntax"]'
      )
    ).toHaveAttribute('data-outcome', 'passed')
    await expect(
      panel.locator(
        '[data-testid="seo-finding"][data-rule-id="internationalization/reciprocal-targets"]'
      )
    ).toHaveAttribute('data-outcome', 'passed')
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

test('restores a completed result after the panel is closed and reopened', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/with-title'))
    await waitForPaneElement(window, 'desktop', 'seo-with-title')

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()

    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()
    await expect(panel.getByTestId('seo-result')).toBeVisible()

    // Close then reopen the panel; the main-process job outlives the panel.
    await toolbar.getByTestId('seo-toggle').click()
    await toolbar.getByTestId('seo-toggle').click()

    const reopened = await getSeoPanelPage(window)
    await expect(reopened.getByTestId('seo-result')).toBeVisible()
    await expect(
      reopened.locator(
        '[data-testid="seo-finding"][data-rule-id="search-appearance/title-present"]'
      )
    ).toHaveAttribute('data-outcome', 'passed')
  } finally {
    await close()
  }
})

test('marks a completed result stale after the pane navigates', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/with-title'))
    await waitForPaneElement(window, 'desktop', 'seo-with-title')

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()

    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()
    await expect(panel.getByTestId('seo-result')).toBeVisible()
    await expect(panel.getByTestId('seo-stale-banner')).toHaveCount(0)

    // Navigate the panes; the completed result should be flagged stale but stay
    // inspectable.
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/no-title'))
    await expect(panel.getByTestId('seo-stale-banner')).toBeVisible()
    await expect(panel.getByTestId('seo-result')).toBeVisible()
  } finally {
    await close()
  }
})

test('captures delivered evidence and flags a delivered-vs-rendered title discrepancy', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/hydrated-title'))
    await waitForPaneElement(window, 'desktop', 'seo-hydrated-title')

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()

    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()
    await expect(panel.getByTestId('seo-result')).toBeVisible()

    // The rendered title is present and usable.
    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="search-appearance/title-present"]')
    ).toHaveAttribute('data-outcome', 'passed')

    // Delivered evidence was fetched and compared against the rendered title.
    const hydration = panel.locator(
      '[data-testid="seo-finding"][data-rule-id="search-appearance/title-delivered-vs-rendered"]'
    )
    await expect(hydration).toHaveAttribute('data-outcome', 'warning')
    await expect(hydration.getByTestId('seo-finding-evidence')).toContainText('Delivered Title')
    await expect(hydration.getByTestId('seo-finding-evidence')).toContainText('Rendered Title')
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

test('renders a resolved search preview and preserves declared metadata', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/search-appearance'))
    await waitForPaneElement(window, 'desktop', 'seo-search-appearance')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()
    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()

    await expect(panel.getByTestId('seo-preview-title')).toHaveText('Search Appearance Fixture')
    await expect(panel.getByTestId('seo-preview-description')).toContainText(
      'precise fixture description'
    )
    await expect(panel.getByTestId('seo-preview-url')).toContainText('/seo/search-appearance')
    await expect(panel.getByTestId('seo-preview-measurements')).toContainText('characters')

    await panel.getByText('Declared and resolved metadata').click()
    await expect(panel.getByTestId('seo-declared-metadata')).toContainText('rendered · description')
    await expect(panel.getByTestId('seo-resolved-metadata')).toContainText(
      'first non-empty rendered description'
    )
  } finally {
    await close()
  }
})

test('reports duplicate and conflicting search metadata without hiding declarations', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/conflicting-metadata'))
    await waitForPaneElement(window, 'desktop', 'seo-conflicting-metadata')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()
    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()

    const finding = panel.locator(
      '[data-testid="seo-finding"][data-rule-id="search-appearance/declarations-consistent"]'
    )
    await expect(finding).toHaveAttribute('data-outcome', 'warning')
    await expect(finding.getByTestId('seo-finding-evidence')).toContainText('declarations conflict')

    await panel.getByText('Declared and resolved metadata').click()
    const declared = panel.getByTestId('seo-declared-metadata')
    await expect(declared).toContainText('First description')
    await expect(declared).toContainText('Second description')
    await expect(declared).toContainText('Rendered description')
  } finally {
    await close()
  }
})

test('audits indexability controls and verifies only declared discovery resources', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/indexability-allowed'))
    await waitForPaneElement(window, 'desktop', 'seo-indexability-allowed')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()
    const panel = await getSeoPanelPage(window)
    await panel.getByRole('radio', { name: 'Indexable', exact: true }).click()
    await panel.getByTestId('seo-run-audit').click()

    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="indexability/final-status"]')
    ).toHaveAttribute('data-outcome', 'passed')
    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="indexability/canonical-target"]')
    ).toHaveAttribute('data-outcome', 'passed')
    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="indexability/robots-txt-access"]')
    ).toHaveAttribute('data-outcome', 'passed')
    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="indexability/declared-sitemaps"]')
    ).toHaveAttribute('data-outcome', 'passed')
  } finally {
    await close()
  }
})

test('reports contradictory noindex controls against indexable intent', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/indexability-blocked'))
    await waitForPaneElement(window, 'desktop', 'seo-indexability-blocked')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()
    const panel = await getSeoPanelPage(window)
    await panel.getByRole('radio', { name: 'Indexable', exact: true }).click()
    await panel.getByTestId('seo-run-audit').click()

    const directives = panel.locator(
      '[data-testid="seo-finding"][data-rule-id="indexability/robots-directives"]'
    )
    await expect(directives).toHaveAttribute('data-outcome', 'error')
    await expect(directives.getByTestId('seo-finding-summary')).toHaveText(
      'Robots directives conflict'
    )
    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="indexability/robots-txt-access"]')
    ).toHaveAttribute('data-outcome', 'error')
  } finally {
    await close()
  }
})

test('resolves social fallbacks, verifies the image, and renders representative previews', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/social-sharing'))
    await waitForPaneElement(window, 'desktop', 'seo-social-sharing')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()
    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()

    await expect(panel.getByTestId('seo-social-previews')).toContainText(
      'Representative approximation'
    )
    await expect(panel.getByTestId('seo-social-preview')).toHaveCount(5)
    await expect(panel.getByTestId('seo-social-previews')).toContainText('Social Fixture Card')
    const imageFinding = panel.locator(
      '[data-testid="seo-finding"][data-rule-id="social-sharing/images-valid"]'
    )
    await expect(imageFinding).toHaveAttribute('data-outcome', 'passed')
    await expect(imageFinding.getByTestId('seo-finding-evidence')).toContainText('1200×630')

    await panel.getByText('Declared social metadata').click()
    await expect(panel.getByTestId('seo-social-declarations')).toContainText('og:image')
    await expect(panel.getByTestId('seo-social-declarations')).toContainText('twitter:card')
  } finally {
    await close()
  }
})

test('inspects JSON-LD, Microdata, RDFa, and attributed enhancement eligibility', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/structured-data'))
    await waitForPaneElement(window, 'desktop', 'seo-structured-data')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()
    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()

    const inspector = panel.getByTestId('seo-structured-data')
    await expect(inspector).toContainText('does not guarantee a rich result')
    await expect(inspector.getByTestId('seo-structured-source')).toHaveCount(3)
    await expect(inspector).toContainText('CustomThing')
    await expect(
      inspector.getByTestId('seo-search-enhancement').filter({ hasText: 'Article · eligible' })
    ).toHaveCount(1)
    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="structured-data/standards-valid"]')
    ).toHaveAttribute('data-outcome', 'passed')
  } finally {
    await close()
  }
})

test('reports malformed sources, missing requirements, and broken entity relationships', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/structured-data-invalid'))
    await waitForPaneElement(window, 'desktop', 'seo-structured-data-invalid')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()
    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()

    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="structured-data/standards-valid"]')
    ).toHaveAttribute('data-outcome', 'error')
    await expect(
      panel.locator(
        '[data-testid="seo-finding"][data-rule-id="structured-data/relationships-valid"]'
      )
    ).toHaveAttribute('data-outcome', 'warning')
    await expect(
      panel.locator(
        '[data-testid="seo-finding"][data-rule-id="structured-data/search-enhancement-eligibility"]'
      )
    ).toHaveAttribute('data-outcome', 'warning')
  } finally {
    await close()
  }
})

test('inspects client-rendered headings, responsive visibility, and page landmarks', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/document-structure'))
    await waitForPaneElement(window, 'desktop', 'client-content')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()
    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()

    const structure = panel.getByTestId('seo-document-structure')
    await expect(structure).toContainText('Language: en')
    await structure.getByText('Rendered heading tree').click()
    await expect(structure.getByTestId('seo-heading-tree')).toContainText('Hidden desktop heading')
    await expect(structure.getByTestId('seo-heading-tree')).toContainText('hidden')
    await expect(structure.getByTestId('seo-heading-tree')).toContainText(
      'Client-rendered page heading'
    )
    await expect(
      panel.locator(
        '[data-testid="seo-finding"][data-rule-id="document-structure/primary-heading"]'
      )
    ).toHaveAttribute('data-outcome', 'passed')
  } finally {
    await close()
  }
})

test('reports missing language, heading defects, and an empty main landmark', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/document-structure-invalid'))
    await waitForPaneElement(window, 'desktop', 'seo-document-structure-invalid')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()
    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()

    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="document-structure/language"]')
    ).toHaveAttribute('data-outcome', 'warning')
    await expect(
      panel.locator(
        '[data-testid="seo-finding"][data-rule-id="document-structure/primary-heading"]'
      )
    ).toHaveAttribute('data-outcome', 'warning')
    await expect(
      panel.locator(
        '[data-testid="seo-finding"][data-rule-id="document-structure/heading-hierarchy"]'
      )
    ).toHaveAttribute('data-outcome', 'warning')
    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="document-structure/page-landmarks"]')
    ).toHaveAttribute('data-outcome', 'warning')
  } finally {
    await close()
  }
})

test('inventories and filters rendered links without crawling ordinary destinations', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/links'))
    await waitForPaneElement(window, 'desktop', 'client-links')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()
    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()

    const inventory = panel.getByTestId('seo-link-inventory')
    await expect(inventory).toContainText('12 anchors')
    await expect(inventory).toContainText('javascript')
    await expect(inventory).toContainText('Hidden responsive link')
    await inventory.getByTestId('seo-link-filter').fill('client-rendered')
    await expect(inventory.getByTestId('seo-link-item')).toHaveCount(1)
    await expect(inventory.getByTestId('seo-link-item')).toContainText('/client-rendered')

    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="links/destinations-valid"]')
    ).toHaveAttribute('data-outcome', 'error')
    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="links/directives-consistent"]')
    ).toHaveAttribute('data-outcome', 'warning')
    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="links/inventory"]')
    ).toHaveAttribute('data-outcome', 'opportunity')
  } finally {
    await close()
  }
})

test('inspects selected responsive images and client-inserted media evidence', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/images-media'))
    await waitForPaneElement(window, 'desktop', 'client-media')
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('seo-toggle').click()
    const panel = await getSeoPanelPage(window)
    await panel.getByTestId('seo-run-audit').click()

    const inventory = panel.getByTestId('seo-images-media')
    await expect(inventory).toContainText('6 images · 1 media')
    await expect(inventory).toContainText('decorative')
    await expect(inventory).toContainText('Client inserted image')
    await expect(inventory).toContainText('srcset')
    await expect(inventory).toContainText('picture source')
    await expect(inventory.getByTestId('seo-media-item')).toContainText('1 tracks')
    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="images-media/alternatives"]')
    ).toHaveAttribute('data-outcome', 'warning')
    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="images-media/sources-available"]')
    ).toHaveAttribute('data-outcome', 'error')
    await expect(
      panel.locator('[data-testid="seo-finding"][data-rule-id="images-media/dimensions"]')
    ).toHaveAttribute('data-outcome', 'warning')
  } finally {
    await close()
  }
})
