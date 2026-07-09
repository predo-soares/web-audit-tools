import { test, expect } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  getOverlayPage,
  getToolbarPage,
  launchApp,
  navigateTo,
  waitForPaneElement
} from './helpers'

test('toolbar menus stay non-modal and keep the app visible', async () => {
  const { window, close } = await launchApp()

  try {
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('zoom-combobox-trigger').click()
    const overlay = await getOverlayPage(window)
    await expect(overlay.getByTestId('toolbar-custom-popover').getByText('100%')).toBeVisible()
    await expect(toolbar.getByTestId('url-input')).toBeVisible()

    await window.keyboard.press('Escape')
    await expect(overlay.getByTestId('toolbar-custom-popover')).toBeHidden()

    const themeToggle = toolbar.getByTestId('theme-toggle')
    await themeToggle.click()
    await themeToggle.click()
    await expect(
      evaluateInPane<boolean>(
        window,
        'desktop',
        `window.matchMedia('(prefers-color-scheme: dark)').matches`
      )
    ).resolves.toBe(true)
  } finally {
    await close()
  }
})

test('toolbar back and forward navigate the active pane history', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/flow-a'))
    await waitForPaneElement(window, 'iphone', 'flow-a')

    const toolbar = await getToolbarPage(window)
    await expect(toolbar.getByTestId('toolbar-back')).toBeDisabled()
    await expect(toolbar.getByTestId('toolbar-forward')).toBeDisabled()

    await evaluateInPane(
      window,
      'iphone',
      `document.getElementById('flow-link')?.click()`
    )
    await waitForPaneElement(window, 'iphone', 'flow-b')
    await expect(toolbar.getByTestId('url-input')).toHaveValue(/\/flow-b/)
    await expect(toolbar.getByTestId('toolbar-back')).toBeEnabled()
    await expect(toolbar.getByTestId('toolbar-forward')).toBeDisabled()

    await toolbar.getByTestId('toolbar-back').click()
    await waitForPaneElement(window, 'iphone', 'flow-a')
    await expect(toolbar.getByTestId('url-input')).toHaveValue(/\/flow-a/)
    await expect(toolbar.getByTestId('toolbar-forward')).toBeEnabled()

    await toolbar.getByTestId('toolbar-forward').click()
    await waitForPaneElement(window, 'iphone', 'flow-b')
    await expect(toolbar.getByTestId('url-input')).toHaveValue(/\/flow-b/)
  } finally {
    await close()
  }
})

test('toolbar back keyboard shortcut navigates the active pane', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/flow-a'))
    await waitForPaneElement(window, 'iphone', 'flow-a')

    await evaluateInPane(
      window,
      'iphone',
      `document.getElementById('flow-link')?.click()`
    )
    await waitForPaneElement(window, 'iphone', 'flow-b')

    await window.keyboard.press('Meta+[')
    await waitForPaneElement(window, 'iphone', 'flow-a')
    const toolbar = await getToolbarPage(window)
    await expect(toolbar.getByTestId('url-input')).toHaveValue(/\/flow-a/)
  } finally {
    await close()
  }
})
