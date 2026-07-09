import { test, expect } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  focusPane,
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
    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-fetch-404')?.click()`
    )
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

    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-throw-error')?.click()`
    )
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

    const entry = drawer
      .getByTestId('diagnostics-network-entry')
      .filter({ has: drawer.getByTestId('diagnostics-network-path').filter({ hasText: '/runtime-evidence/api/missing' }) })
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

    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-many-logs')?.click()`
    )
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

    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-many-logs')?.click()`
    )
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
    expect(scrollTopAfterTail).toBeLessThanOrEqual(48)
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
