import { test, expect } from './fixtures'
import { rmSync } from 'fs'
import {
  evaluateInPane,
  fixtureUrl,
  getSidebarPage,
  getToolbarPage,
  launchApp,
  navigateTo,
  waitForAllPanes
} from './helpers'

test('saving a project persists it and clicking navigates all panes', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    const firstUrl = fixtureUrl(fixturePort, '/strict-headers')
    const secondUrl = fixtureUrl(fixturePort, '/login')

    await navigateTo(window, firstUrl)
    await waitForAllPanes(window)

    const toolbar = await getToolbarPage(window)
    await expect(toolbar.getByTestId('save-project')).toBeEnabled()
    await toolbar.getByTestId('save-project').click()

    const sidebar = await getSidebarPage(window)
    await expect(sidebar.locator('[data-testid^="project-row-"]').getByText(firstUrl)).toBeVisible()

    await navigateTo(window, secondUrl)
    await waitForAllPanes(window)

    await sidebar.locator('[data-testid^="project-row-"]').getByText(firstUrl).click()
    await waitForAllPanes(window)

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      const href = await evaluateInPane<string>(window, paneId, 'window.location.href')
      expect(href).toBe(firstUrl)
    }
  } finally {
    await close()
  }
})

test('projects survive app restart', async ({ fixturePort }) => {
  const firstUrl = fixtureUrl(fixturePort, '/strict-headers')
  const firstLaunch = await launchApp()

  try {
    await navigateTo(firstLaunch.window, firstUrl)
    await waitForAllPanes(firstLaunch.window)

    const firstToolbar = await getToolbarPage(firstLaunch.window)
    await firstToolbar.getByTestId('save-project').click()
    const firstSidebar = await getSidebarPage(firstLaunch.window)
    await expect(firstSidebar.locator('[data-testid^="project-row-"]').getByText(firstUrl)).toBeVisible()

    await firstLaunch.close({ deleteUserData: false })

    const secondLaunch = await launchApp(firstLaunch.userDataDir)
    try {
      const secondSidebar = await getSidebarPage(secondLaunch.window)
      await expect(secondSidebar.locator('[data-testid^="project-row-"]').getByText(firstUrl)).toBeVisible({
        timeout: 15_000
      })
    } finally {
      await secondLaunch.close()
      rmSync(firstLaunch.userDataDir, { recursive: true, force: true })
    }
  } catch (error) {
    await firstLaunch.close()
    throw error
  }
})

test('save uses last committed page while navigation is loading', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    const firstUrl = fixtureUrl(fixturePort, '/strict-headers')
    const secondUrl = fixtureUrl(fixturePort, '/login')

    await navigateTo(window, firstUrl)
    await waitForAllPanes(window)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('url-input').fill(secondUrl)
    // Fire the navigation without awaiting so the save happens mid-load. The
    // in-flight navigation can tear down this evaluate's execution context
    // ("target closed"); that rejection is expected and must not fail the test.
    void window.evaluate((url) => window.api.navigate(url), secondUrl).catch(() => {})
    await toolbar.getByTestId('save-project').click()

    const sidebar = await getSidebarPage(window)
    await expect(sidebar.locator('[data-testid^="project-row-"]').getByText(firstUrl)).toBeVisible()
  } finally {
    await close()
  }
})

test('save-project toggles the current project and keeps only one saved row per site', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    const url = fixtureUrl(fixturePort, '/strict-headers')

    await navigateTo(window, url)
    await waitForAllPanes(window)

    const toolbar = await getToolbarPage(window)
    const saveButton = toolbar.getByTestId('save-project')
    const sidebar = await getSidebarPage(window)
    const projectRows = sidebar.locator('[data-testid^="project-row-"]')

    await saveButton.click()
    await expect(projectRows).toHaveCount(1)

    await saveButton.click()
    await expect(projectRows).toHaveCount(0)

    await saveButton.click()
    await expect(projectRows).toHaveCount(1)
  } finally {
    await close()
  }
})
