import { test, expect } from './fixtures'
import { evaluateInPane, launchApp } from './helpers'

test('toolbar menus stay non-modal and keep the app visible', async () => {
  const { window, close } = await launchApp()

  try {
    await window.getByTestId('zoom-combobox-trigger').click()
    await expect(window.getByTestId('toolbar-custom-popover').getByText('Zoom')).toBeVisible()
    await expect(window.getByTestId('url-input')).toBeVisible()

    await window.keyboard.press('Escape')

    await window.getByTestId('theme-preferences-trigger').click()
    await expect(window.getByTestId('toolbar-custom-popover').getByText('Theme')).toBeVisible()
    await expect(window.getByTestId('toolbar-custom-popover').getByText('System')).toBeVisible()
    await expect(window.getByTestId('url-input')).toBeVisible()

    await window.getByTestId('toolbar-custom-popover').getByText('Dark').click()
    await expect(window.getByTestId('toolbar-custom-popover')).toBeHidden()
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
