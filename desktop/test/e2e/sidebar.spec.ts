import { rmSync } from 'fs'
import { test, expect } from './fixtures'
import {
  clearHistoryViaApi,
  evaluateInPane,
  expectSidebarOpen,
  fixtureUrl,
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
    await expect(window.getByTestId('sidebar-toggle')).toHaveAttribute('aria-expanded', 'true')
  } finally {
    await close()
  }
})

test('sidebar toggles from the toolbar button and keyboard shortcut', async () => {
  const { window, close } = await launchApp()

  try {
    await expectSidebarOpen(window, true)

    await window.getByTestId('sidebar-toggle').click()
    await expectSidebarOpen(window, false)
    await expect(window.getByTestId('sidebar-toggle')).toHaveAttribute('aria-expanded', 'false')

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

    const historyRow = window.getByTestId(historyRowTestId(url))
    await historyRow.focus()
    await expect(historyRow).toBeFocused()

    await window.getByTestId('sidebar-toggle').click()
    await waitForSidebarSettled(window)

    await expect(window.getByTestId('sidebar-toggle')).toBeFocused()
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

    const historyRows = window.locator(
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

    const historyRow = window.getByTestId(historyRowTestId(url))
    await expect(historyRow).toHaveAttribute('data-history-active', 'true')

    const before = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('strict-ok')?.textContent ?? ''`
    )

    await historyRow.click()

    await expect(window.getByTestId('url-input')).toHaveValue(url)
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

    await window.getByTestId('save-project').click()
    const projectRow = window.locator('[data-testid^="project-row-"]').first()
    await expect(projectRow).toBeVisible()

    const before = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('strict-ok')?.textContent ?? ''`
    )

    await projectRow.click()

    await expect(window.getByTestId('url-input')).toHaveValue(url)
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

    const firstRow = window.getByTestId(historyRowTestId(firstUrl))
    await firstRow.focus()
    await window.keyboard.press('Enter')
    await waitForAllPanes(window)
    await expect(window.getByTestId('url-input')).toHaveValue(firstUrl)
    await expect(window.getByTestId(historyRowTestId(firstUrl))).toHaveAttribute(
      'data-history-active',
      'true'
    )

    await navigateToCommitted(window, secondUrl)

    const menuButton = window.getByTestId(`${historyRowTestId(firstUrl)}-menu`)
    await menuButton.focus()
    await window.keyboard.press('Enter')
    await window.getByTestId(`${historyRowTestId(firstUrl)}-delete`).click()

    await expect(window.getByTestId(historyRowTestId(firstUrl))).toHaveCount(0)
    await expect(window.getByTestId('url-input')).toHaveValue(secondUrl)
    await expect(window.getByTestId(historyRowTestId(secondUrl))).toBeFocused()
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

    await window.getByTestId('history-clear-all').click()
    await expect(window.getByTestId('clear-history-dialog')).toBeVisible()
    await window.getByTestId('clear-history-confirm').click()

    await expect(
      window.locator('button[data-testid^="history-row-"]:not([data-testid$="-menu"])')
    ).toHaveCount(0)
    await expect(window.getByTestId('url-input')).toHaveValue(url)
    await expect(window.getByTestId('history-heading')).toBeFocused()
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

    await firstLaunch.window.getByTestId('save-project').click()
    await expect(
      firstLaunch.window.locator('[data-testid^="project-row-"]').getByText(secondUrl)
    ).toBeVisible()

    await firstLaunch.window.getByTestId('sidebar-toggle').click()
    await expectSidebarOpen(firstLaunch.window, false)

    await firstLaunch.close({ deleteUserData: false })

    const secondLaunch = await launchApp(firstLaunch.userDataDir)
    try {
      await expectSidebarOpen(secondLaunch.window, false)
      await expect(
        secondLaunch.window.locator('[data-testid^="project-row-"]').getByText(secondUrl)
      ).toBeVisible({ timeout: 15_000 })
      await expect(secondLaunch.window.getByTestId(historyRowTestId(secondUrl))).toBeVisible({
        timeout: 15_000
      })
      await expect(secondLaunch.window.getByTestId(historyRowTestId(firstUrl))).toBeVisible()
    } finally {
      await secondLaunch.close()
      rmSync(firstLaunch.userDataDir, { recursive: true, force: true })
    }
  } catch (error) {
    await firstLaunch.close()
    throw error
  }
})
