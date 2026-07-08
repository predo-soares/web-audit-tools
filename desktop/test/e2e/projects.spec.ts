import { test, expect } from './fixtures'
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
    await expect(window.getByTestId('save-project-dialog')).toBeVisible()
    await window.getByTestId('project-name-input').fill('Strict Headers')
    await window.getByTestId('project-save-confirm').click()

    await expect(window.getByText('Strict Headers')).toBeVisible()

    await navigateTo(window, secondUrl)
    await waitForAllPanes(window)

    await window.getByText('Strict Headers').click()
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
    await firstLaunch.window.getByTestId('project-name-input').fill('Restart Project')
    await firstLaunch.window.getByTestId('project-save-confirm').click()
    await expect(firstLaunch.window.getByText('Restart Project')).toBeVisible()

    await firstLaunch.close()

    const secondLaunch = await launchApp(firstLaunch.userDataDir)
    try {
      await expect(secondLaunch.window.getByText('Restart Project')).toBeVisible({
        timeout: 15_000
      })
    } finally {
      await secondLaunch.close()
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
    await expect(window.getByTestId('project-name-input')).toHaveValue('Strict headers page')
    await window.getByTestId('project-save-confirm').click()

    await expect(window.getByText('Strict headers page')).toBeVisible()
    await waitForAllPanes(window)
  } finally {
    await close()
  }
})
