import { test, expect } from './fixtures'
import { rmSync } from 'fs'
import {
  evaluateInPane,
  fixtureUrl,
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

    await expect(window.getByTestId('save-project')).toBeEnabled()
    await window.getByTestId('save-project').click()

    await expect(window.locator('[data-testid^="project-row-"]').getByText(firstUrl)).toBeVisible()

    await navigateTo(window, secondUrl)
    await waitForAllPanes(window)

    await window.locator('[data-testid^="project-row-"]').getByText(firstUrl).click()
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

    await firstLaunch.window.getByTestId('save-project').click()
    await expect(firstLaunch.window.locator('[data-testid^="project-row-"]').getByText(firstUrl)).toBeVisible()

    await firstLaunch.close({ deleteUserData: false })

    const secondLaunch = await launchApp(firstLaunch.userDataDir)
    try {
      await expect(secondLaunch.window.locator('[data-testid^="project-row-"]').getByText(firstUrl)).toBeVisible({
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

    await window.getByTestId('url-input').fill(secondUrl)
    await window.getByTestId('url-submit').click()

    await window.getByTestId('save-project').click()

    await expect(window.locator('[data-testid^="project-row-"]').getByText(firstUrl)).toBeVisible()
    await waitForAllPanes(window)
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

    const saveButton = window.getByTestId('save-project')
    const projectRows = window.locator('[data-testid^="project-row-"]')

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
