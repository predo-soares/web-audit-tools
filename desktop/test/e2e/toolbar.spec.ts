import { test, expect } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  getOverlayPage,
  launchApp,
  navigateTo,
  waitForPaneElement
} from './helpers'

test('toolbar menus stay non-modal and keep the app visible', async () => {
  const { window, close } = await launchApp()

  try {
    await window.getByTestId('zoom-combobox-trigger').click()
    const overlay = await getOverlayPage(window)
    await expect(overlay.getByTestId('toolbar-custom-popover').getByText('100%')).toBeVisible()
    await expect(window.getByTestId('url-input')).toBeVisible()

    await window.keyboard.press('Escape')
    await expect(overlay.getByTestId('toolbar-custom-popover')).toBeHidden()

    await window.getByTestId('theme-preferences-trigger').click()
    await expect(overlay.getByTestId('toolbar-custom-popover').getByText('Theme')).toBeVisible()
    await expect(overlay.getByTestId('toolbar-custom-popover').getByText('System')).toBeVisible()
    await expect(window.getByTestId('url-input')).toBeVisible()

    await overlay.getByTestId('toolbar-custom-popover').getByText('Dark').click()
    await expect(overlay.getByTestId('toolbar-custom-popover')).toBeHidden()
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

    await expect(window.getByTestId('toolbar-back')).toBeDisabled()
    await expect(window.getByTestId('toolbar-forward')).toBeDisabled()

    await evaluateInPane(
      window,
      'iphone',
      `document.getElementById('flow-link')?.click()`
    )
    await waitForPaneElement(window, 'iphone', 'flow-b')
    await expect(window.getByTestId('url-input')).toHaveValue(/\/flow-b/)
    await expect(window.getByTestId('toolbar-back')).toBeEnabled()
    await expect(window.getByTestId('toolbar-forward')).toBeDisabled()

    await window.getByTestId('toolbar-back').click()
    await waitForPaneElement(window, 'iphone', 'flow-a')
    await expect(window.getByTestId('url-input')).toHaveValue(/\/flow-a/)
    await expect(window.getByTestId('toolbar-forward')).toBeEnabled()

    await window.getByTestId('toolbar-forward').click()
    await waitForPaneElement(window, 'iphone', 'flow-b')
    await expect(window.getByTestId('url-input')).toHaveValue(/\/flow-b/)
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
    await expect(window.getByTestId('url-input')).toHaveValue(/\/flow-a/)
  } finally {
    await close()
  }
})
