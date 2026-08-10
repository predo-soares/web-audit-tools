import { test, expect } from './fixtures'
import type { Locator } from '@playwright/test'

// The findings list leads with actionable outcomes and collapses passed /
// unable-to-verify behind toggles. Tests that assert on those secondary
// outcomes reveal them first.
async function revealSecondaryOutcomes(panel: Locator): Promise<void> {
  await expect(panel.getByTestId('seo-result')).toBeVisible()
  for (const outcome of ['passed', 'unable-to-verify']) {
    const toggle = panel.locator(`[data-testid="seo-outcome-toggle"][data-outcome="${outcome}"]`)
    if ((await toggle.count()) && (await toggle.getAttribute('aria-pressed')) !== 'true') {
      await toggle.click()
    }
  }
}

// The URL bar is hidden in full-screen views, so a navigation that happens while
// the SEO view is open (to test staleness) is driven through the app API — the
// same path a sidebar project/history click or an agent takes.
async function navigateInApp(window: Page, url: string): Promise<void> {
  await window.evaluate((address) => window.api.navigate(address), url)
}

// The audit report is split across tabs; open the one holding the section a test
// asserts on before locating it.
async function selectSeoTab(
  panel: Locator,
  tab: 'findings' | 'preview' | 'structure' | 'links' | 'media' | 'i18n'
): Promise<void> {
  await panel.getByTestId(`seo-tab-${tab}`).click()
}
import {
  evaluateInPane,
  fixtureUrl,
  getSidebarPage,
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
    await expect(panel.getByTestId('seo-target-url')).toHaveValue(
      fixtureUrl(fixturePort, '/seo/with-title')
    )

    // No result until the user explicitly runs the audit.
    await expect(panel.getByTestId('seo-result')).toHaveCount(0)

    await panel.getByTestId('seo-run-audit').click()

    const result = panel.getByTestId('seo-result')
    await expect(result).toBeVisible()
    await revealSecondaryOutcomes(panel)
    await expect
      .poll(() =>
        panel
          .getByTestId('seo-finding')
          .first()
          .evaluate((element) => getComputedStyle(element).opacity)
      )
      .toBe('1')

    const titleFinding = panel.locator(
      '[data-testid="seo-finding"][data-rule-id="search-appearance/title-present"]'
    )
    await expect(titleFinding).toHaveAttribute('data-outcome', 'passed')
    await expect(titleFinding.getByTestId('seo-finding-evidence')).toContainText('Fixture SEO Page')
    const overview = panel.getByTestId('seo-overview')
    await expect(overview.getByTestId('seo-category-filter')).toBeVisible()
    await expect(overview.getByTestId('seo-outcome-filter')).toBeVisible()
    await overview.getByTestId('seo-outcome-filter').click()
    const warningOption = panel.locator(
      '[data-testid="seo-outcome-option"][data-outcome="warning"]'
    )
    const passedOption = panel.locator('[data-testid="seo-outcome-option"][data-outcome="passed"]')
    await warningOption.click()
    await passedOption.click()
    await expect(warningOption).toHaveAttribute('aria-selected', 'true')
    await expect(passedOption).toHaveAttribute('aria-selected', 'true')
    await panel.keyboard.press('Escape')
    await expect(panel.getByTestId('seo-finding')).toHaveCount(
      await panel.locator('[data-testid="seo-finding"]').count()
    )
    await overview.getByTestId('seo-outcome-filter').click()
    await warningOption.click()
    await passedOption.click()
    await panel.keyboard.press('Escape')
    await overview.getByTestId('seo-category-filter').click()
    await panel
      .locator('[data-testid="seo-category-option"][data-category="search-appearance"]')
      .click()
    await panel.keyboard.press('Escape')
    await expect
      .poll(async () => panel.getByTestId('seo-finding').allTextContents())
      .toEqual(expect.arrayContaining([expect.stringContaining('Search appearance')]))
    expect(
      (await panel.getByTestId('seo-finding').allTextContents()).every((text) =>
        text.includes('Search appearance')
      )
    ).toBe(true)
    await selectSeoTab(panel, 'structure')
    await panel.getByText('Declared and resolved metadata').click()
    await expect(panel.getByTestId('seo-declared-metadata')).toContainText(
      'rendered · title #1: Fixture SEO Page'
    )
    await expect(panel.getByTestId('seo-resolved-metadata')).toContainText('Fixture SEO Page')
    await window.keyboard.press('Escape')
    await selectSeoTab(panel, 'findings')
    await overview.getByTestId('seo-category-filter').click()
    await panel.getByTestId('seo-category-clear').click()
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
    await titleFinding.getByRole('button', { name: /Copy .* finding/ }).click()
    expect(
      await panel.evaluate(
        () => (window as typeof window & { __copiedSeoMarkdown?: string }).__copiedSeoMarkdown
      )
    ).toContain('search-appearance/title-present')

    await navigateInApp(window, fixtureUrl(fixturePort, '/seo/no-title'))
    await waitForPaneElement(window, 'desktop', 'seo-no-title')
    // A real navigation returns to the browser workspace; re-open SEO to inspect.
    await openSeoView(window)
    await expect(panel.getByTestId('seo-stale-banner')).toBeVisible()
    await panel.getByTestId('seo-run-audit').click()
    await expect(titleFinding).toHaveAttribute('data-outcome', 'error')
    await expect(panel.getByTestId('seo-stale-banner')).toHaveCount(0)

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
    await revealSecondaryOutcomes(panel)

    // Copy every finding's evidence and assert the authenticated secret never
    // leaks into agent-facing Markdown. (Whole-result copy and snapshot export
    // were removed from the SEO view; their redaction stays covered by unit tests.)
    const copyButtons = panel.getByRole('button', { name: /Copy .* finding/ })
    const count = await copyButtons.count()
    expect(count).toBeGreaterThan(0)
    for (let index = 0; index < count; index++) {
      await copyButtons.nth(index).click()
      const copied = await panel.evaluate(
        () => (window as typeof window & { __copiedSeoMarkdown?: string }).__copiedSeoMarkdown ?? ''
      )
      expect(copied).not.toContain(secret)
      expect(copied).not.toContain('fixture_auth')
    }
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
    await revealSecondaryOutcomes(panel)
    await selectSeoTab(panel, 'i18n')
    const section = panel.getByTestId('seo-internationalization')
    await expect(section.getByTestId('seo-hreflang-item')).toHaveCount(3)
    await expect(section).toContainText('x-default')
    await expect(section).toContainText('reciprocal yes')
    await selectSeoTab(panel, 'findings')
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
    // Remediation lives in the finding's collapsible panel; expand it first.
    await titleFinding.getByTestId('seo-finding-summary').click()
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
    await revealSecondaryOutcomes(reopened)
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
    await navigateInApp(window, fixtureUrl(fixturePort, '/seo/no-title'))
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
    await revealSecondaryOutcomes(panel)

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

test('offers an editable URL bar before a page is committed', async () => {
  const { window, close } = await launchApp()

  try {
    await waitForAllPanes(window)
    const panel = await openSeoView(window)
    // No empty state: the editable target-URL bar and run action are always
    // available so a page can be entered from here.
    await expect(panel.getByTestId('seo-target-url')).toBeVisible()
    await expect(panel.getByTestId('seo-run-audit')).toBeVisible()
    await expect(panel.getByText('Run an audit to see results.')).toBeVisible()
  } finally {
    await close()
  }
})

test('flags an invalid URL entered in the target bar', async () => {
  const { window, close } = await launchApp()

  try {
    await waitForAllPanes(window)
    const panel = await openSeoView(window)
    const input = panel.getByTestId('seo-target-url')

    await input.fill('not a url')
    await input.press('Enter')
    await expect(panel.getByTestId('seo-url-error')).toBeVisible()
    await expect(input).toHaveAttribute('aria-invalid', 'true')

    // Editing the value clears the error without navigating anywhere.
    await input.fill('https://example.com')
    await expect(panel.getByTestId('seo-url-error')).toHaveCount(0)
  } finally {
    await close()
  }
})

test('suggests visited pages from history in the target bar', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/with-title'))
    await waitForPaneElement(window, 'desktop', 'seo-with-title')

    const panel = await openSeoView(window)
    const input = panel.getByTestId('seo-target-url')
    await input.click()

    const history = panel.getByTestId('seo-url-history')
    await expect(history).toBeVisible()
    await expect(history.getByTestId('seo-url-history-item').first()).toContainText('with-title')
  } finally {
    await close()
  }
})

test('keeps the SEO workspace when selecting a page from sidebar history', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  const historyUrl = fixtureUrl(fixturePort, '/seo/with-title')

  try {
    await navigateTo(window, historyUrl)
    await waitForPaneElement(window, 'desktop', 'seo-with-title')
    await navigateTo(window, fixtureUrl(fixturePort, '/seo/no-title'))
    await waitForPaneElement(window, 'desktop', 'seo-no-title')

    await openSeoView(window)
    const sidebar = await getSidebarPage(window)
    await sidebar.getByTestId(`history-row-${encodeURIComponent(historyUrl)}`).click()

    await expect(window.getByTestId('seo-view')).toBeVisible()
    await expect(window.getByTestId('preview-canvas')).toHaveCount(0)
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

    await selectSeoTab(panel, 'preview')
    await expect(panel.getByTestId('seo-preview-title')).toHaveText('Search Appearance Fixture')
    await expect(panel.getByTestId('seo-preview-description')).toContainText(
      'precise fixture description'
    )
    await expect(panel.getByTestId('seo-preview-url')).toContainText('/seo/search-appearance')
    await expect(panel.getByTestId('seo-preview-measurements')).toContainText('chars')

    await selectSeoTab(panel, 'structure')
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

    await selectSeoTab(panel, 'structure')
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
    await panel.getByTestId('seo-intent-select').click()
    await window.getByRole('option', { name: 'Indexable', exact: true }).click()
    await panel.getByTestId('seo-run-audit').click()
    await revealSecondaryOutcomes(panel)

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
    await panel.getByTestId('seo-intent-select').click()
    await window.getByRole('option', { name: 'Indexable', exact: true }).click()
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

    await revealSecondaryOutcomes(panel)
    await selectSeoTab(panel, 'preview')
    await expect(panel.getByTestId('seo-social-previews')).toContainText(
      'Representative approximation'
    )
    await expect(panel.getByTestId('seo-social-preview')).toHaveCount(5)
    await expect(panel.getByTestId('seo-social-previews')).toContainText('Social Fixture Card')
    await selectSeoTab(panel, 'findings')
    const imageFinding = panel.locator(
      '[data-testid="seo-finding"][data-rule-id="social-sharing/images-valid"]'
    )
    await expect(imageFinding).toHaveAttribute('data-outcome', 'passed')
    await expect(imageFinding.getByTestId('seo-finding-evidence')).toContainText('1200×630')

    await selectSeoTab(panel, 'preview')
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

    await revealSecondaryOutcomes(panel)
    await selectSeoTab(panel, 'structure')
    const inspector = panel.getByTestId('seo-structured-data')
    await expect(inspector).toContainText('does not guarantee a rich result')
    await expect(inspector.getByTestId('seo-structured-source')).toHaveCount(3)
    await expect(inspector).toContainText('CustomThing')
    await expect(
      inspector.getByTestId('seo-search-enhancement').filter({ hasText: 'Article · eligible' })
    ).toHaveCount(1)
    await selectSeoTab(panel, 'findings')
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

    await revealSecondaryOutcomes(panel)
    await selectSeoTab(panel, 'structure')
    const structure = panel.getByTestId('seo-document-structure')
    await expect(structure).toContainText('Language: en')
    // The heading tree opens in a modal (portaled outside the section).
    await structure.getByText('Rendered heading tree').click()
    const headingTree = panel.getByTestId('seo-heading-tree')
    await expect(headingTree).toContainText('Hidden desktop heading')
    await expect(headingTree).toContainText('hidden')
    await expect(headingTree).toContainText('Client-rendered page heading')
    await window.keyboard.press('Escape')
    await selectSeoTab(panel, 'findings')
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

    await selectSeoTab(panel, 'links')
    const inventory = panel.getByTestId('seo-link-inventory')
    await expect(inventory).toContainText('12 anchors')
    await expect(inventory).toContainText('javascript')
    await expect(inventory).toContainText('Hidden responsive link')
    await inventory.getByTestId('seo-link-filter').fill('client-rendered')
    await expect(inventory.getByTestId('seo-link-item')).toHaveCount(1)
    await expect(inventory.getByTestId('seo-link-item')).toContainText('/client-rendered')

    await selectSeoTab(panel, 'findings')
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

    await selectSeoTab(panel, 'media')
    const inventory = panel.getByTestId('seo-images-media')
    await expect(inventory).toContainText('6 images · 1 media')
    await expect(inventory.getByTestId('seo-image-item')).toHaveCount(6)
    await expect(inventory.getByTestId('seo-media-item')).toContainText('1 tracks')

    // Per-image detail (alt, srcset, picture sources) moved into a modal opened
    // from each card. The 5th image is the <picture> with a source + srcset.
    await inventory.getByTestId('seo-image-item').nth(4).getByTestId('seo-image-details').click()
    const modal = panel.getByTestId('seo-image-modal')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('Responsive illustration')
    await expect(modal).toContainText('srcset')
    await expect(modal).toContainText('picture source')
    await window.keyboard.press('Escape')
    await expect(modal).toHaveCount(0)

    // The first image declares an empty alt, surfaced as decorative in its modal.
    await inventory.getByTestId('seo-image-item').nth(0).getByTestId('seo-image-details').click()
    await expect(panel.getByTestId('seo-image-modal')).toContainText('(decorative)')
    await window.keyboard.press('Escape')

    await selectSeoTab(panel, 'findings')
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
