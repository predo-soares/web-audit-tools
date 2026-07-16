import { test, expect } from './fixtures'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import {
  evaluateInPane,
  fixtureUrl,
  launchApp,
  navigateTo,
  openSeoView,
  reopenSeoView,
  waitForAllPanes,
  waitForPaneElement
} from './helpers'

test('runs a full audit and reports a passed title finding', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/with-title'))
    await waitForPaneElement(window, 'desktop', 'seo-with-title')

    const panel = await openSeoView(window)
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
    const overview = panel.getByTestId('seo-overview')
    await expect(overview.getByTestId('seo-category-row')).toHaveCount(9)
    await expect(overview.getByTestId('seo-outcome-filter')).toHaveCount(5)
    await overview.locator('[data-testid="seo-outcome-filter"][data-outcome="warning"]').click()
    await expect(panel.getByTestId('seo-finding')).toHaveCount(
      await panel.locator('[data-testid="seo-finding"][data-outcome="warning"]').count()
    )
    await overview.locator('[data-testid="seo-outcome-filter"][data-outcome="warning"]').click()
    const searchAppearanceCategory = overview
      .getByTestId('seo-category-row')
      .filter({ hasText: 'Search appearance' })
      .getByRole('button', { name: /^Search appearance ·/ })
    await searchAppearanceCategory.click()
    await expect
      .poll(async () => panel.getByTestId('seo-finding').allTextContents())
      .toEqual(expect.arrayContaining([expect.stringContaining('Search appearance')]))
    expect(
      (await panel.getByTestId('seo-finding').allTextContents()).every((text) =>
        text.includes('Search appearance')
      )
    ).toBe(true)
    await panel.getByText('Declared and resolved metadata').click()
    await expect(panel.getByTestId('seo-declared-metadata')).toContainText(
      'rendered · title #1: Fixture SEO Page'
    )
    await expect(panel.getByTestId('seo-resolved-metadata')).toContainText('Fixture SEO Page')
    await searchAppearanceCategory.click()
    await panel.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (value: string) => {
            ;(window as typeof window & { __copiedSeoMarkdown?: string }).__copiedSeoMarkdown =
              value
            return Promise.resolve()
          }
        }
      })
    })
    await overview.getByTestId('seo-copy-result').click()
    await expect(overview.getByTestId('seo-copy-status')).toContainText('agent-ready Markdown')
    expect(
      await panel.evaluate(
        () => (window as typeof window & { __copiedSeoMarkdown?: string }).__copiedSeoMarkdown
      )
    ).toContain('Rule catalog')
    await titleFinding.getByRole('button', { name: /Copy .* finding/ }).click()
    expect(
      await panel.evaluate(
        () => (window as typeof window & { __copiedSeoMarkdown?: string }).__copiedSeoMarkdown
      )
    ).toContain('search-appearance/title-present')

    await navigateTo(window, fixtureUrl(fixturePort, '/seo/no-title'))
    await waitForPaneElement(window, 'desktop', 'seo-no-title')
    // A real navigation returns to the browser workspace; re-open SEO to inspect.
    await openSeoView(window)
    await expect(panel.getByTestId('seo-stale-banner')).toBeVisible()
    await panel.getByTestId('seo-run-audit').click()
    await expect(titleFinding).toHaveAttribute('data-outcome', 'error')
    await expect(panel.getByTestId('seo-stale-banner')).toHaveCount(0)

    await overview.getByTestId('seo-export-snapshot').click()
    await expect(overview.getByTestId('seo-export-status')).toContainText('SEO Snapshot exported')
    const captures = join(homedir(), '.audit-screens', 'captures')
    const latest = readdirSync(captures).sort().at(-1)
    expect(latest).toBeTruthy()
    const bundle = join(captures, latest!)
    expect(existsSync(join(bundle, 'context.md'))).toBe(true)
    expect(
      existsSync(join(bundle, 'iphone-16-pro.png')) || existsSync(join(bundle, 'desktop.png'))
    ).toBe(true)
    expect(existsSync(join(bundle, 'seo-audit.json'))).toBe(true)
    expect(readFileSync(join(bundle, 'context.md'), 'utf8')).toContain('## Page SEO Audit')
    const exported = JSON.parse(readFileSync(join(bundle, 'seo-audit.json'), 'utf8'))
    expect(exported.ruleCatalogVersion).toBeTruthy()
    expect(
      exported.findings.some(
        (item: { ruleId: string }) => item.ruleId === 'search-appearance/title-present'
      )
    ).toBe(true)
    // No proprietary overall score is shown.
    await expect(result).not.toContainText('score')
  } finally {
    await close()
  }
})

test('keeps authenticated audit secrets out of copied and persisted evidence', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  const secret = 'issue15-private-token'

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/login'))
    await waitForAllPanes(window)
    await evaluateInPane(window, 'desktop', `document.getElementById('login-btn')?.click()`)
    await waitForAllPanes(window)
    await navigateTo(window, fixtureUrl(fixturePort, `/auth-check?token=${secret}`))
    await waitForPaneElement(window, 'desktop', 'auth-status')

    const panel = await openSeoView(window)
    await panel.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (value: string) => {
            ;(window as typeof window & { __copiedSeoMarkdown?: string }).__copiedSeoMarkdown =
              value
            return Promise.resolve()
          }
        }
      })
    })
    await panel.getByTestId('seo-run-audit').click()
    await expect(panel.getByTestId('seo-result')).toBeVisible()
    await panel.getByTestId('seo-copy-result').click()
    const copied = await panel.evaluate(
      () => (window as typeof window & { __copiedSeoMarkdown?: string }).__copiedSeoMarkdown ?? ''
    )
    expect(copied).not.toContain(secret)
    expect(copied).not.toContain('fixture_auth')

    await panel.getByTestId('seo-export-snapshot').click()
    await expect(panel.getByTestId('seo-export-status')).toContainText('SEO Snapshot exported')
    const captures = join(homedir(), '.audit-screens', 'captures')
    const latest = readdirSync(captures).sort().at(-1)
    expect(latest).toBeTruthy()
    const bundle = join(captures, latest!)
    const context = readFileSync(join(bundle, 'context.md'), 'utf8')
    const auditJson = readFileSync(join(bundle, 'seo-audit.json'), 'utf8')
    expect(context).not.toContain(secret)
    expect(auditJson).not.toContain(secret)
    expect(auditJson).not.toContain('fixture_auth')
    expect(JSON.parse(auditJson).accessContext.authenticated).toBe(true)
  } finally {
    await close()
  }
})

test('verifies localized alternates with bounded reciprocal checks', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/i18n'))
    await waitForPaneElement(window, 'desktop', 'seo-i18n')
    const panel = await openSeoView(window)
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

    const panel = await openSeoView(window)
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

    const panel = await openSeoView(window)
    await panel.getByTestId('seo-run-audit').click()
    await expect(panel.getByTestId('seo-result')).toBeVisible()

    // Close then reopen the view; the main-process job outlives the panel.
    const reopened = await reopenSeoView(window)
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

    const panel = await openSeoView(window)
    await panel.getByTestId('seo-run-audit').click()
    await expect(panel.getByTestId('seo-result')).toBeVisible()
    await expect(panel.getByTestId('seo-stale-banner')).toHaveCount(0)

    // Navigate the panes; the completed result should be flagged stale but stay
    // inspectable. A real navigation returns to the browser workspace first.
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/no-title'))
    await openSeoView(window)
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

    const panel = await openSeoView(window)
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
    const panel = await openSeoView(window)
    await expect(panel.getByTestId('seo-view-empty')).toBeVisible()
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
    const panel = await openSeoView(window)
    await panel.getByTestId('seo-run-audit').click()

    await expect(panel.getByTestId('seo-preview-title')).toHaveText('Search Appearance Fixture')
    await expect(panel.getByTestId('seo-preview-description')).toContainText(
      'precise fixture description'
    )
    await expect(panel.getByTestId('seo-preview-url')).toContainText('/seo/search-appearance')
    await expect(panel.getByTestId('seo-preview-measurements')).toContainText('chars')

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
    const panel = await openSeoView(window)
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
    const panel = await openSeoView(window)
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
    const panel = await openSeoView(window)
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
    const panel = await openSeoView(window)
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
    const panel = await openSeoView(window)
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
    const panel = await openSeoView(window)
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
    const panel = await openSeoView(window)
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
    const panel = await openSeoView(window)
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
    const panel = await openSeoView(window)
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
    const panel = await openSeoView(window)
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

// Lighthouse moved out of the SEO panel into its own workspace (sidebar
// "Lighthouse" → lighthouse-view). This coverage belongs in a dedicated
// lighthouse spec against the new view once it is committed; skipped here so it
// stops asserting against the removed in-SEO Lighthouse section.
test.skip('runs real Lighthouse in an isolated desktop target without mutating pane evidence', async ({
  fixturePort
}) => {
  test.setTimeout(180_000)
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/with-title'))
    await waitForPaneElement(window, 'desktop', 'seo-with-title')
    const before = await window.evaluate(() => window.api.getRuntimeEvidence())
    const panel = await openSeoView(window)
    await panel.getByTestId('seo-run-audit').click()
    const section = panel.getByTestId('seo-lighthouse')
    await section.getByRole('button', { name: 'Desktop' }).click()
    await section.getByTestId('seo-lighthouse-run').click()
    await expect(section.getByTestId('seo-lighthouse-progress')).toBeVisible()
    await expect(section.getByTestId('seo-lighthouse-result')).toBeVisible({ timeout: 90_000 })
    await expect(section.getByTestId('seo-lighthouse-result')).toContainText('Lighthouse 13.')
    await expect(section.getByTestId('seo-lighthouse-score')).not.toHaveCount(0)
    await waitForPaneElement(window, 'desktop', 'seo-with-title')
    const after = await window.evaluate(() => window.api.getRuntimeEvidence())
    expect(after.problemCount).toBe(before.problemCount)
  } finally {
    await close()
  }
})
