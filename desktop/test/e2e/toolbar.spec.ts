import { test, expect } from './fixtures'
import { evaluateInPane, getOverlayPage, launchApp } from './helpers'

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
