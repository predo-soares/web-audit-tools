import { test, expect } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  launchApp,
  navigateTo,
  waitForAllPanes
} from './helpers'

test('navigates a single URL into the preview pane', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/'))
    await waitForAllPanes(window)

    const text = await evaluateInPane<string>(
      window,
      'desktop',
      `document.getElementById('fixture-home')?.textContent ?? ''`
    )
    expect(text).toBe('Fixture Home')
  } finally {
    await close()
  }
})
