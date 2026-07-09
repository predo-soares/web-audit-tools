import { test, expect } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  getToolbarPage,
  launchApp,
  navigateTo,
  waitForAllPanes
} from './helpers'

test('scrolling one pane proportionally moves the others', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/long-scroll'))
    await waitForAllPanes(window)

    await evaluateInPane(
      window,
      'iphone',
      `(function () {
        const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        window.scrollTo(0, max * 0.4);
      })()`
    )

    await window.waitForTimeout(500)

    const ipadRatio = await evaluateInPane<number>(window, 'ipad', `window.reportScrollRatio()`)
    const desktopRatio = await evaluateInPane<number>(
      window,
      'desktop',
      `window.reportScrollRatio()`
    )

    expect(ipadRatio).toBeGreaterThan(0.3)
    expect(ipadRatio).toBeLessThan(0.5)
    expect(desktopRatio).toBeGreaterThan(0.3)
    expect(desktopRatio).toBeLessThan(0.5)
  } finally {
    await close()
  }
})

test('toggling scroll sync off and on changes scroll coupling', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/long-scroll'))
    await waitForAllPanes(window)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('sync-toggle').click()

    await evaluateInPane(
      window,
      'iphone',
      `(function () {
        const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        window.scrollTo(0, max * 0.2);
      })()`
    )
    await window.waitForTimeout(400)

    const ipadRatioOff = await evaluateInPane<number>(window, 'ipad', `window.reportScrollRatio()`)
    expect(ipadRatioOff).toBeLessThan(0.05)

    await toolbar.getByTestId('sync-toggle').click()

    await evaluateInPane(
      window,
      'desktop',
      `(function () {
        const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        window.scrollTo(0, max * 0.7);
      })()`
    )
    await window.waitForTimeout(500)

    const iphoneRatioOn = await evaluateInPane<number>(
      window,
      'iphone',
      `window.reportScrollRatio()`
    )
    expect(iphoneRatioOn).toBeGreaterThan(0.6)
  } finally {
    await close()
  }
})
