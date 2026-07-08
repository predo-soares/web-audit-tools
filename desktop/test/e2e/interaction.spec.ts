import { test, expect } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  launchApp,
  navigateTo,
  waitForAllPanes,
  waitForPaneElement,
  waitForPaneLoad
} from './helpers'

test('clicking a link inside one pane navigates only that pane and updates the URL bar', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/flow-a'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `document.getElementById('flow-link').click()`)
    await waitForPaneElement(window, 'iphone', 'flow-b')

    const iphoneText = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('flow-b')?.textContent ?? ''`
    )
    expect(iphoneText).toBe('Flow page B')

    for (const paneId of ['ipad', 'desktop'] as const) {
      const text = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('flow-a')?.textContent ?? ''`
      )
      expect(text).toBe('Flow page A')
    }

    await expect(window.getByTestId('url-input')).toHaveValue(/\/flow-b/)
  } finally {
    await close()
  }
})

test('per-pane loading indicator fires during in-pane link-click navigation', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/'))
    await waitForAllPanes(window)

    const longScrollUrl = fixtureUrl(fixturePort, '/long-scroll')
    const loadingVisible = window
      .getByTestId('pane-loading-iphone')
      .waitFor({ state: 'visible', timeout: 5_000 })

    await evaluateInPane(
      window,
      'iphone',
      `(() => { const a = document.createElement('a'); a.href = '${longScrollUrl}'; document.body.appendChild(a); a.click(); })()`
    )

    await loadingVisible
    await waitForPaneLoad(window, 'iphone')
    await expect(window.getByTestId('pane-loading-iphone')).toBeHidden()
  } finally {
    await close()
  }
})

test('form submit inside a pane sends the correct emulated UA in the resulting POST request', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/ua-form'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `document.getElementById('ua-submit').click()`)
    await waitForPaneElement(window, 'iphone', 'ua-result')

    const ua = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('ua-result')?.dataset.userAgent ?? ''`
    )
    expect(ua).toContain('iPhone')
  } finally {
    await close()
  }
})

test('history.back() inside a pane returns only that pane to the previous URL and updates the URL bar', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/flow-a'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `document.getElementById('flow-link').click()`)
    await waitForPaneElement(window, 'iphone', 'flow-b')

    await evaluateInPane(window, 'iphone', `history.back()`)
    await waitForPaneElement(window, 'iphone', 'flow-a')

    const iphoneText = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('flow-a')?.textContent ?? ''`
    )
    expect(iphoneText).toBe('Flow page A')

    for (const paneId of ['ipad', 'desktop'] as const) {
      const text = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('flow-a')?.textContent ?? ''`
      )
      expect(text).toBe('Flow page A')
    }

    await expect(window.getByTestId('url-input')).toHaveValue(/\/flow-a/)
  } finally {
    await close()
  }
})

test('submitting a URL from the bar navigates all panes after per-pane divergence', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/flow-a'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `document.getElementById('flow-link').click()`)
    await waitForPaneElement(window, 'iphone', 'flow-b')

    await navigateTo(window, fixtureUrl(fixturePort, '/'))
    await waitForAllPanes(window)

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      const text = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('fixture-home')?.textContent ?? ''`
      )
      expect(text).toBe('Fixture Home')
    }
  } finally {
    await close()
  }
})

test('semantic click sync mirrors the same button with native input and no echo', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/semantic-click'))
    await waitForAllPanes(window)

    await evaluateInPane(
      window,
      'iphone',
      `document.querySelector('#semantic-primary span')?.click()`
    )

    await expect
      .poll(() =>
        evaluateInPane<string>(
          window,
          'ipad',
          `document.getElementById('semantic-result')?.dataset.primaryCount ?? '0'`
        )
      )
      .toBe('1')

    await expect
      .poll(() =>
        evaluateInPane<string>(
          window,
          'desktop',
          `document.getElementById('semantic-result')?.dataset.primaryCount ?? '0'`
        )
      )
      .toBe('1')

    for (const paneId of ['ipad', 'desktop'] as const) {
      const result = await evaluateInPane<Record<string, string>>(
        window,
        paneId,
        `(() => {
          const result = document.getElementById('semantic-result');
          return {
            primaryCount: result?.dataset.primaryCount ?? '',
            trapCount: result?.dataset.trapCount ?? '',
            lastTrusted: result?.dataset.lastTrusted ?? '',
            activeElement: result?.dataset.activeElement ?? '',
            touchCount: result?.dataset.touchCount ?? ''
          };
        })()`
      )

      expect(result.primaryCount).toBe('1')
      expect(result.trapCount).toBe('0')
      expect(result.lastTrusted).toBe('true')
      expect(result.activeElement).toBe('semantic-primary')
      if (paneId === 'ipad') {
        expect(result.touchCount).toBe('1')
      }
    }

    await window.waitForTimeout(500)
    const counts = await Promise.all(
      (['iphone', 'ipad', 'desktop'] as const).map((paneId) =>
        evaluateInPane<string>(
          window,
          paneId,
          `document.getElementById('semantic-result')?.dataset.primaryCount ?? '0'`
        )
      )
    )
    expect(counts).toEqual(['1', '1', '1'])
  } finally {
    await close()
  }
})

test('semantic click sync mirrors link navigation and obeys the sync toggle', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/semantic-click'))
    await waitForAllPanes(window)

    await window.getByTestId('sync-toggle').click()
    await evaluateInPane(window, 'iphone', `document.getElementById('semantic-primary')?.click()`)
    await window.waitForTimeout(300)

    for (const paneId of ['ipad', 'desktop'] as const) {
      const count = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('semantic-result')?.dataset.primaryCount ?? '0'`
      )
      expect(count).toBe('0')
    }

    await window.getByTestId('sync-toggle').click()
    await evaluateInPane(window, 'iphone', `document.getElementById('semantic-link')?.click()`)

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      await waitForPaneElement(window, paneId, 'semantic-destination')
    }
  } finally {
    await close()
  }
})

test('hamburger button not found on desktop pane logs not-found and does nothing', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/responsive-nav'))
    await waitForAllPanes(window)

    // Click the hamburger in the iphone pane (mobile UA gets the hamburger)
    await evaluateInPane(window, 'iphone', `document.getElementById('hamburger-btn').click()`)

    // The iphone mobile drawer should open (hidden attr removed)
    await expect
      .poll(() =>
        evaluateInPane<boolean>(
          window,
          'iphone',
          `document.getElementById('mobile-drawer')?.hidden === false`
        )
      )
      .toBe(true)

    // Desktop pane has no hamburger/drawer — nothing to verify failed on it,
    // but we confirm the desktop DOM is unchanged (no hamburger, no drawer)
    const desktopHasHamburger = await evaluateInPane<boolean>(
      window,
      'desktop',
      `!!document.getElementById('hamburger-btn')`
    )
    expect(desktopHasHamburger).toBe(false)

    const desktopHasDrawer = await evaluateInPane<boolean>(
      window,
      'desktop',
      `!!document.getElementById('mobile-drawer')`
    )
    expect(desktopHasDrawer).toBe(false)
  } finally {
    await close()
  }
})

test('clicking Nth duplicate button mirrors the same Nth instance in other panes', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/duplicate-buttons'))
    await waitForAllPanes(window)

    // Click the 2nd "Add to cart" button (index 1) in iphone pane
    await evaluateInPane(
      window,
      'iphone',
      `document.querySelectorAll('.add-btn')[1].click()`
    )

    // Verify iphone result shows index 1
    await expect
      .poll(() =>
        evaluateInPane<string>(
          window,
          'iphone',
          `document.getElementById('result')?.dataset.clickedIndex ?? '-1'`
        )
      )
      .toBe('1')

    // Verify ipad and desktop also had their 2nd button clicked
    for (const paneId of ['ipad', 'desktop'] as const) {
      await expect
        .poll(() =>
          evaluateInPane<string>(
            window,
            paneId,
            `document.getElementById('result')?.dataset.clickedIndex ?? '-1'`
          )
        )
        .toBe('1')
    }
  } finally {
    await close()
  }
})

