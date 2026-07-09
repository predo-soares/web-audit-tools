import { rmSync } from 'fs'
import { test, expect } from './fixtures'
import {
  clearHistoryViaApi,
  evaluateInPane,
  expectSidebarOpen,
  fixtureUrl,
  getSidebarPage,
  getToolbarPage,
  historyRowTestId,
  launchApp,
  launchAppReady,
  navigateToCommitted,
  sidebarToggleShortcut,
  waitForAllPanes,
  waitForSidebarSettled
} from './helpers'

test('first launch opens the sidebar by default', async () => {
  const { window, close } = await launchApp()

  try {
    await expectSidebarOpen(window, true)
    const toolbar = await getToolbarPage(window)
    await expect(toolbar.getByTestId('sidebar-toggle')).toHaveAttribute('aria-expanded', 'true')
  } finally {
    await close()
  }
})

test('sidebar toggles from the toolbar button and keyboard shortcut', async () => {
  const { window, close } = await launchApp()

  try {
    await expectSidebarOpen(window, true)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('sidebar-toggle').click()
    await expectSidebarOpen(window, false)
    await expect(toolbar.getByTestId('sidebar-toggle')).toHaveAttribute('aria-expanded', 'false')

    await window.keyboard.press(sidebarToggleShortcut())
    await expectSidebarOpen(window, true)

    await window.keyboard.press(sidebarToggleShortcut())
    await expectSidebarOpen(window, false)
  } finally {
    await close()
  }
})

test('closing the sidebar returns focus to the toggle when focus was inside it', async ({
  fixturePort
}) => {
  const { window, close } = await launchAppReady()

  try {
    const url = fixtureUrl(fixturePort, '/strict-headers')
    await navigateToCommitted(window, url)

    const sidebar = await getSidebarPage(window)
    const historyRow = sidebar.getByTestId(historyRowTestId(url))
    await historyRow.focus()
    await expect(historyRow).toBeFocused()

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('sidebar-toggle').click()
    await waitForSidebarSettled(window)

    await expect(toolbar.getByTestId('sidebar-toggle')).toBeFocused()
  } finally {
    await close()
  }
})

test('revisiting a page bumps it to the top of history without duplicating', async ({
  fixturePort
}) => {
  const { window, close } = await launchAppReady()

  try {
    const firstUrl = fixtureUrl(fixturePort, '/strict-headers')
    const secondUrl = fixtureUrl(fixturePort, '/login')

    await clearHistoryViaApi(window)
    await navigateToCommitted(window, firstUrl)
    await navigateToCommitted(window, secondUrl)
    await navigateToCommitted(window, firstUrl)

    const sidebar = await getSidebarPage(window)
    const historyRows = sidebar.locator(
      'button[data-testid^="history-row-"]:not([data-testid$="-menu"]):not([data-testid$="-delete"])'
    )
    await expect(historyRows).toHaveCount(2)
    await expect(historyRows.first()).toHaveAttribute('data-testid', historyRowTestId(firstUrl))
    await expect(historyRows.nth(1)).toHaveAttribute('data-testid', historyRowTestId(secondUrl))
  } finally {
    await close()
  }
})

test('clicking the active history row is a no-op', async ({ fixturePort }) => {
  const { window, close } = await launchAppReady()

  try {
    const url = fixtureUrl(fixturePort, '/strict-headers')
    await navigateToCommitted(window, url)

    const sidebar = await getSidebarPage(window)
    const historyRow = sidebar.getByTestId(historyRowTestId(url))
    await expect(historyRow).toHaveAttribute('data-history-active', 'true')

    const before = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('strict-ok')?.textContent ?? ''`
    )

    await historyRow.click()

    const toolbar = await getToolbarPage(window)
    await expect(toolbar.getByTestId('url-input')).toHaveValue(url)
    const after = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('strict-ok')?.textContent ?? ''`
    )
    expect(after).toBe(before)
  } finally {
    await close()
  }
})

test('clicking the active project row is a no-op', async ({ fixturePort }) => {
  const { window, close } = await launchAppReady()

  try {
    const url = fixtureUrl(fixturePort, '/strict-headers')
    await navigateToCommitted(window, url)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('save-project').click()
    const sidebar = await getSidebarPage(window)
    const projectRow = sidebar.locator('[data-testid^="project-row-"]').first()
    await expect(projectRow).toBeVisible()

    const before = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('strict-ok')?.textContent ?? ''`
    )

    await projectRow.click()

    await expect(toolbar.getByTestId('url-input')).toHaveValue(url)
    const after = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('strict-ok')?.textContent ?? ''`
    )
    expect(after).toBe(before)
  } finally {
    await close()
  }
})

test('history rows support keyboard activation and overflow delete', async ({ fixturePort }) => {
  const { window, close } = await launchAppReady()

  try {
    const firstUrl = fixtureUrl(fixturePort, '/strict-headers')
    const secondUrl = fixtureUrl(fixturePort, '/login')

    await clearHistoryViaApi(window)
    await navigateToCommitted(window, firstUrl)
    await navigateToCommitted(window, secondUrl)

    const sidebar = await getSidebarPage(window)
    const firstRow = sidebar.getByTestId(historyRowTestId(firstUrl))
    await firstRow.focus()
    await window.keyboard.press('Enter')
    await waitForAllPanes(window)
    const toolbar = await getToolbarPage(window)
    await expect(toolbar.getByTestId('url-input')).toHaveValue(firstUrl)
    await expect(sidebar.getByTestId(historyRowTestId(firstUrl))).toHaveAttribute(
      'data-history-active',
      'true'
    )

    await navigateToCommitted(window, secondUrl)

    const menuButton = sidebar.getByTestId(`${historyRowTestId(firstUrl)}-menu`)
    await menuButton.focus()
    await window.keyboard.press('Enter')
    await sidebar.getByTestId(`${historyRowTestId(firstUrl)}-delete`).click()

    await expect(sidebar.getByTestId(historyRowTestId(firstUrl))).toHaveCount(0)
    await expect(toolbar.getByTestId('url-input')).toHaveValue(secondUrl)
    await expect(sidebar.getByTestId(historyRowTestId(secondUrl))).toBeFocused()
  } finally {
    await close()
  }
})

test('clearing history empties the list, keeps the page open, and restores focus', async ({
  fixturePort
}) => {
  const { window, close } = await launchAppReady()

  try {
    const url = fixtureUrl(fixturePort, '/strict-headers')
    await navigateToCommitted(window, url)

    const sidebar = await getSidebarPage(window)
    await sidebar.getByTestId('history-clear-all').click()
    await expect(sidebar.getByTestId('clear-history-dialog')).toBeVisible()
    await sidebar.getByTestId('clear-history-confirm').click()

    await expect(
      sidebar.locator('button[data-testid^="history-row-"]:not([data-testid$="-menu"])')
    ).toHaveCount(0)
    const toolbar = await getToolbarPage(window)
    await expect(toolbar.getByTestId('url-input')).toHaveValue(url)
    await expect(sidebar.getByTestId('history-heading')).toBeFocused()
  } finally {
    await close()
  }
})

test('sidebar state, projects, and history survive app restart', async ({ fixturePort }) => {
  const firstUrl = fixtureUrl(fixturePort, '/strict-headers')
  const secondUrl = fixtureUrl(fixturePort, '/login')
  const firstLaunch = await launchAppReady()

  try {
    await navigateToCommitted(firstLaunch.window, firstUrl)
    await navigateToCommitted(firstLaunch.window, secondUrl)

    const firstToolbar = await getToolbarPage(firstLaunch.window)
    await firstToolbar.getByTestId('save-project').click()
    const firstSidebar = await getSidebarPage(firstLaunch.window)
    await expect(
      firstSidebar.locator('[data-testid^="project-row-"]').getByText(secondUrl)
    ).toBeVisible()

    await firstToolbar.getByTestId('sidebar-toggle').click()
    await expectSidebarOpen(firstLaunch.window, false)

    await firstLaunch.close({ deleteUserData: false })

    const secondLaunch = await launchApp(firstLaunch.userDataDir)
    try {
      await expectSidebarOpen(secondLaunch.window, false)
      const secondToolbar = await getToolbarPage(secondLaunch.window)
      await secondToolbar.getByTestId('sidebar-toggle').click()
      await expectSidebarOpen(secondLaunch.window, true)
      const secondSidebar = await getSidebarPage(secondLaunch.window)
      await expect(
        secondSidebar.locator('[data-testid^="project-row-"]').getByText(secondUrl)
      ).toBeVisible({ timeout: 15_000 })
      await expect(secondSidebar.getByTestId(historyRowTestId(secondUrl))).toBeVisible({
        timeout: 15_000
      })
      await expect(secondSidebar.getByTestId(historyRowTestId(firstUrl))).toBeVisible()
    } finally {
      await secondLaunch.close()
      rmSync(firstLaunch.userDataDir, { recursive: true, force: true })
    }
  } catch (error) {
    await firstLaunch.close()
    throw error
  }
})
