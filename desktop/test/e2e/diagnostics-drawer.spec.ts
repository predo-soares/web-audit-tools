import { test, expect } from './fixtures'
import {
  diagnosticsToggleShortcut,
  evaluateInPane,
  expectSidebarOpen,
  fixtureUrl,
  focusPane,
  getDiagnosticsDrawerPage,
  getSidebarPage,
  getToolbarPage,
  launchApp,
  navigateTo,
  selectComboboxOption,
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

test('diagnostics console filter narrows visible output without changing the badge', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(
      window,
      'desktop',
      `console.log('fixture-filter-keep'); console.error('fixture-filter-hide')`
    )
    await window.waitForTimeout(300)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    const badge = drawer.getByTestId('diagnostics-console-badge')
    const countBeforeFiltering = await badge.textContent()
    const filter = drawer.getByTestId('diagnostics-console-filter')

    await filter.fill('fixture-filter-keep')
    await expect(drawer.getByText('fixture-filter-keep')).toBeVisible()
    await expect(drawer.getByText('fixture-filter-hide')).toHaveCount(0)
    await expect(badge).toHaveText(countBeforeFiltering ?? '')

    await filter.fill('exceptional-no-match')
    await expect(drawer.getByText('No console output matches this filter.')).toBeVisible()

    await filter.fill('')
    await selectComboboxOption(drawer, 'diagnostics-console-level-filter', 'Errors')
    await expect(drawer.getByText('fixture-filter-hide')).toBeVisible()
    await expect(drawer.getByText('fixture-filter-keep')).toHaveCount(0)

  } finally {
    await close()
  }
})

test('diagnostics drawer network tab shows failed fetch from the active pane', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(window, 'desktop', `document.getElementById('emit-fetch-404')?.click()`)

    await window.waitForTimeout(500)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    await drawer.getByTestId('diagnostics-tab-network').click()

    const failedEntry = drawer.getByTestId('diagnostics-network-entry').filter({
      has: drawer
        .getByTestId('diagnostics-network-path')
        .filter({ hasText: '/runtime-evidence/api/missing' })
    })
    await expect(failedEntry).toBeVisible()
    await expect(failedEntry.getByTestId('diagnostics-network-status')).toHaveText('404')
    await expect(failedEntry.getByTestId('diagnostics-network-method')).toHaveText('GET')
  } finally {
    await close()
  }
})

test('diagnostics network toolbar filters requests and contains the clear action', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(window, 'desktop', `document.getElementById('emit-fetch-404')?.click()`)
    await evaluateInPane(window, 'desktop', `document.getElementById('emit-fetch-fail')?.click()`)
    await window.waitForTimeout(500)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    await drawer.getByTestId('diagnostics-tab-network').click()

    const filter = drawer.getByTestId('diagnostics-network-filter')
    const channelToolbar = filter.locator('../..')
    await expect(channelToolbar.getByTestId('diagnostics-clear-network')).toBeVisible()

    await filter.fill('/api/missing')
    await expect(
      drawer.getByTestId('diagnostics-network-path').filter({ hasText: '/api/missing' })
    ).toBeVisible()
    await expect(drawer.getByTestId('diagnostics-network-entry')).toHaveCount(1)

    await filter.fill('request-that-does-not-exist')
    await expect(drawer.getByText('No network requests match this filter.')).toBeVisible()

    await filter.fill('')
    await selectComboboxOption(drawer, 'diagnostics-network-outcome-filter', '4xx')
    await expect(
      drawer.getByTestId('diagnostics-network-path').filter({ hasText: '/api/missing' })
    ).toBeVisible()
    await expect(drawer.getByTestId('diagnostics-network-entry')).toHaveCount(1)

  } finally {
    await close()
  }
})

test('diagnostics clear console leaves network evidence intact', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-console-error')?.click()`
    )
    await evaluateInPane(window, 'desktop', `document.getElementById('emit-fetch-404')?.click()`)
    await window.waitForTimeout(500)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    await expect(drawer.getByTestId('diagnostics-console-badge')).not.toHaveText('0')
    await expect(drawer.getByTestId('diagnostics-network-badge')).not.toHaveText('0')

    await drawer.getByTestId('diagnostics-clear-console').click()
    await expect(drawer.getByTestId('diagnostics-console-badge')).toHaveText('0')
    await expect(drawer.getByTestId('diagnostics-network-badge')).not.toHaveText('0')
  } finally {
    await close()
  }
})

test('diagnostics clear network leaves console evidence intact', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-console-error')?.click()`
    )
    await evaluateInPane(window, 'desktop', `document.getElementById('emit-fetch-404')?.click()`)
    await window.waitForTimeout(500)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    await drawer.getByTestId('diagnostics-tab-network').click()
    await drawer.getByTestId('diagnostics-clear-network').click()

    await expect(drawer.getByTestId('diagnostics-network-badge')).toHaveText('0')
    await drawer.getByTestId('diagnostics-tab-console').click()
    await expect(drawer.getByTestId('diagnostics-console-badge')).not.toHaveText('0')
  } finally {
    await close()
  }
})

test('diagnostics console row expands to show stack trace', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(window, 'desktop', `document.getElementById('emit-throw-error')?.click()`)
    await window.waitForTimeout(300)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    const entry = drawer
      .getByTestId('diagnostics-console-entry')
      .filter({ hasText: 'fixture-uncaught-error' })
    await expect(entry).toBeVisible()

    await entry.getByTestId('diagnostics-console-expand').click()
    await expect(entry.getByTestId('diagnostics-console-stack')).toContainText('runtime-evidence')
  } finally {
    await close()
  }
})

test('diagnostics network row expands to show headers', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(window, 'desktop', `document.getElementById('emit-fetch-404')?.click()`)
    await window.waitForTimeout(500)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    await drawer.getByTestId('diagnostics-tab-network').click()

    const entry = drawer.getByTestId('diagnostics-network-entry').filter({
      has: drawer
        .getByTestId('diagnostics-network-path')
        .filter({ hasText: '/runtime-evidence/api/missing' })
    })
    await entry.getByTestId('diagnostics-network-expand').click()

    const headers = entry.getByTestId('diagnostics-network-headers')
    await expect(headers).toContainText('X-Fixture-Response: missing-resource')
  } finally {
    await close()
  }
})

test('diagnostics console source link copies location to clipboard', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-console-error')?.click()`
    )
    await window.waitForTimeout(300)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    await drawer.evaluate(() => {
      ;(window as unknown as { __clipboardWrites?: string[] }).__clipboardWrites = []
      navigator.clipboard.writeText = async (text: string) => {
        ;(window as unknown as { __clipboardWrites?: string[] }).__clipboardWrites?.push(text)
      }
    })

    const entry = drawer
      .getByTestId('diagnostics-console-entry')
      .filter({ hasText: 'fixture-runtime-error' })
    await entry.getByTestId('diagnostics-console-source-link').click()

    const copied = await drawer.evaluate(
      () => (window as unknown as { __clipboardWrites?: string[] }).__clipboardWrites?.[0] ?? ''
    )
    expect(copied).toMatch(/runtime-evidence:\d+:\d+/)
  } finally {
    await close()
  }
})

test('diagnostics list smart-scrolls only when already at the bottom', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(window, 'desktop', `document.getElementById('emit-many-logs')?.click()`)
    await window.waitForTimeout(500)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    const list = drawer.getByTestId('diagnostics-list')

    await expect(list.getByText('fixture-log-batch 29')).toBeVisible()

    const scrollTopBeforePause = await list.evaluate((element) => {
      element.scrollTop = 0
      return element.scrollTop
    })
    expect(scrollTopBeforePause).toBe(0)

    await evaluateInPane(window, 'desktop', `document.getElementById('emit-many-logs')?.click()`)
    await window.waitForTimeout(500)

    const scrollTopAfterBurst = await list.evaluate((element) => element.scrollTop)
    expect(scrollTopAfterBurst).toBe(0)
    await expect(list.getByText('fixture-log-batch 00').first()).toBeVisible()

    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    await evaluateInPane(
      window,
      'desktop',
      `console.log('fixture-log-tail', 'after-return-to-bottom')`
    )
    await window.waitForTimeout(300)

    await expect(list.getByText('fixture-log-tail after-return-to-bottom')).toBeVisible()
    const scrollTopAfterTail = await list.evaluate(
      (element) => element.scrollHeight - element.scrollTop - element.clientHeight
    )
    // Within ~one row of the bottom. Row heights can be fractional (observed
    // 48.5px), so allow a small sub-pixel margin above one row.
    expect(scrollTopAfterTail).toBeLessThanOrEqual(50)
  } finally {
    await close()
  }
})

test('diagnostics drawer refreshes when the active pane changes', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')
    await waitForPaneElement(window, 'iphone', 'runtime-evidence-fixture')

    await evaluateInPane(
      window,
      'desktop',
      `console.error('fixture-pane-desktop', 'desktop-only error')`
    )
    await evaluateInPane(
      window,
      'iphone',
      `console.error('fixture-pane-iphone', 'iphone-only error')`
    )
    await window.waitForTimeout(300)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    const drawerRoot = drawer.getByTestId('diagnostics-drawer')
    await expect(drawerRoot).toHaveAttribute('data-pane-id', 'desktop')
    await expect(drawer.getByText('desktop-only error')).toBeVisible()
    await expect(drawer.getByText('iphone-only error')).toHaveCount(0)

    await focusPane(window, 'iphone')
    await window.waitForTimeout(300)

    await expect(drawerRoot).toHaveAttribute('data-pane-id', 'iphone')
    await expect(drawer.getByText('iphone-only error')).toBeVisible()
    await expect(drawer.getByText('desktop-only error')).toHaveCount(0)
  } finally {
    await close()
  }
})

test('diagnostics toolbar badge increments while drawer stays closed', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    const toolbar = await getToolbarPage(window)
    await expect(toolbar.getByTestId('diagnostics-toggle')).toHaveAttribute(
      'aria-expanded',
      'false'
    )

    const badge = toolbar.getByTestId('diagnostics-problem-badge')
    const countBefore = (await badge.count()) > 0 ? Number(await badge.textContent()) : 0

    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-console-error')?.click()`
    )
    await window.waitForTimeout(300)

    await expect(badge).toHaveText(String(countBefore + 1))
    await expect(toolbar.getByTestId('diagnostics-toggle')).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  } finally {
    await close()
  }
})

test('diagnostics drawer does not auto-open when a new problem arrives', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    const toolbar = await getToolbarPage(window)
    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-console-error')?.click()`
    )
    await window.waitForTimeout(300)

    await expect(toolbar.getByTestId('diagnostics-problem-badge')).not.toHaveText('0')
    await expect(toolbar.getByTestId('diagnostics-toggle')).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  } finally {
    await close()
  }
})

test('diagnostics drawer toggles with keyboard shortcut', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    const toolbar = await getToolbarPage(window)
    await expect(toolbar.getByTestId('diagnostics-toggle')).toHaveAttribute(
      'aria-expanded',
      'false'
    )

    await window.keyboard.press(diagnosticsToggleShortcut())
    await expect(toolbar.getByTestId('diagnostics-toggle')).toHaveAttribute('aria-expanded', 'true')

    await window.keyboard.press(diagnosticsToggleShortcut())
    await expect(toolbar.getByTestId('diagnostics-toggle')).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  } finally {
    await close()
  }
})

test('diagnostics drawer opens on the tab with more problems', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(window, 'desktop', `document.getElementById('emit-fetch-404')?.click()`)
    await evaluateInPane(window, 'desktop', `document.getElementById('emit-fetch-404')?.click()`)
    await evaluateInPane(window, 'desktop', `document.getElementById('emit-fetch-fail')?.click()`)
    await window.waitForTimeout(500)

    const expectedTab = await window.evaluate(async () => {
      const snapshot = await window.api.getRuntimeEvidence()
      const consoleProblems = snapshot.console.filter((entry) =>
        ['error', 'warn', 'exception', 'rejection'].includes(entry.level)
      ).length
      const networkProblems = snapshot.network.filter(
        (entry) => entry.failed || (entry.status !== undefined && entry.status >= 400)
      ).length
      return networkProblems > consoleProblems ? 'network' : 'console'
    })

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    await expect(drawer.getByTestId(`diagnostics-tab-${expectedTab}`)).toHaveAttribute(
      'aria-selected',
      'true'
    )
  } finally {
    await close()
  }
})

test('diagnostics drawer opens on console when problem counts tie', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-console-error')?.click()`
    )
    await evaluateInPane(window, 'desktop', `document.getElementById('emit-fetch-404')?.click()`)
    await window.waitForTimeout(500)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()

    const drawer = await getDiagnosticsDrawerPage(window)
    await expect(drawer.getByTestId('diagnostics-tab-console')).toHaveAttribute(
      'aria-selected',
      'true'
    )
  } finally {
    await close()
  }
})

test('diagnostics drawer and sidebar can be open together with pane interaction', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')

    await expectSidebarOpen(window, true)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('diagnostics-toggle').click()
    await expect(toolbar.getByTestId('diagnostics-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expectSidebarOpen(window, true)

    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-console-error')?.click()`
    )
    await window.waitForTimeout(300)

    const drawer = await getDiagnosticsDrawerPage(window)
    await expect(drawer.getByText('deliberate test error')).toBeVisible()
  } finally {
    await close()
  }
})

test('diagnostics drawer closes outside preview and restores on return', async () => {
  const { window, close } = await launchApp()

  try {
    const toolbar = await getToolbarPage(window)
    const sidebar = await getSidebarPage(window)

    await toolbar.getByTestId('diagnostics-toggle').click()
    await expect(toolbar.getByTestId('diagnostics-toggle')).toHaveAttribute('aria-expanded', 'true')

    await sidebar.getByTestId('sidebar-seo-view').click()
    await expect(window.getByTestId('seo-view')).toBeVisible()
    await expect
      .poll(async () => {
        const openPanels = await window.evaluate(() => window.api.getOpenPanels())
        return openPanels.includes('diagnostics-right')
      })
      .toBe(false)
    await expect(toolbar.getByTestId('diagnostics-toggle')).toHaveAttribute(
      'aria-expanded',
      'false'
    )

    await sidebar.getByTestId('sidebar-preview-view').click()
    await expect(window.getByTestId('seo-view')).toHaveCount(0)
    await expect
      .poll(async () => {
        const openPanels = await window.evaluate(() => window.api.getOpenPanels())
        return openPanels.includes('diagnostics-right')
      })
      .toBe(true)
    await expect(toolbar.getByTestId('diagnostics-toggle')).toHaveAttribute('aria-expanded', 'true')
  } finally {
    await close()
  }
})
