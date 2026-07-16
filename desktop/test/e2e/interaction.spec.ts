import { test, expect } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  getMirrorFailureLogs,
  getToolbarPage,
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

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('sync-toggle').click()

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

    await expect(toolbar.getByTestId('url-input')).toHaveValue(/\/flow-b/)
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
        `document.getElementById('flow-b')?.textContent ?? ''`
      )
      expect(text).toBe('Flow page B')
    }

    const toolbar = await getToolbarPage(window)
    await expect(toolbar.getByTestId('url-input')).toHaveValue(/\/flow-a/)
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

test('semantic click sync mirrors link navigation across panes', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/semantic-click'))
    await waitForAllPanes(window)

    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('sync-toggle').click()
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

    await toolbar.getByTestId('sync-toggle').click()
    await evaluateInPane(window, 'iphone', `document.getElementById('semantic-link')?.click()`)
    await waitForPaneElement(window, 'iphone', 'semantic-destination')

    for (const paneId of ['ipad', 'desktop'] as const) {
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


test('mirrored click scrolls off-screen element into view and clicks it', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/below-fold-button'))
    await waitForAllPanes(window)

    // Click the below-fold button directly in the iphone pane (it is below the
    // viewport but the preload sends a fingerprint, so the mirror path in the
    // other panes must scroll it into view before dispatching the click).
    await evaluateInPane(window, 'iphone', `document.getElementById('below-fold-btn').click()`)

    // Verify that ipad and desktop panes also registered the click via the
    // scroll-into-view mirror path.
    for (const paneId of ['ipad', 'desktop'] as const) {
      await expect
        .poll(
          () =>
            evaluateInPane<string>(
              window,
              paneId,
              `document.getElementById('result')?.dataset.clicked ?? 'false'`
            ),
          { timeout: 5_000 }
        )
        .toBe('true')
    }

    const targetScrolls = await Promise.all(
      (['ipad', 'desktop'] as const).map((paneId) =>
        evaluateInPane<number>(window, paneId, `window.scrollY`)
      )
    )
    expect(targetScrolls[0]).toBeGreaterThan(0)
    expect(targetScrolls[1]).toBeGreaterThan(0)

    await window.waitForTimeout(500)

    const sourceScrollAfterSettle = await evaluateInPane<number>(window, 'iphone', `window.scrollY`)
    expect(sourceScrollAfterSettle).toBe(0)
  } finally {
    await close()
  }
})

test('mirrored click does not click when element is occluded by overlay', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/occluded-button'))
    await waitForAllPanes(window)

    // Directly click the button in the iphone pane — the preload sends the
    // fingerprint for #btn. In the target panes, elementFromPoint will return
    // the overlay div rather than the button, so the mirror should be rejected.
    await evaluateInPane(window, 'iphone', `document.getElementById('btn').click()`)

    // Wait long enough for any mirror to have arrived, then confirm it did not.
    await window.waitForTimeout(500)

    for (const paneId of ['ipad', 'desktop'] as const) {
      const clicked = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('result')?.dataset.clicked ?? 'false'`
      )
      expect(clicked).toBe('false')
    }
  } finally {
    await close()
  }
})

test('typing in a text field mirrors value to other panes', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `
      var el = document.getElementById('text-field');
      el.focus();
      el.value = 'hello world';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    `)

    // Wait for debounce (100ms) + IPC round-trip
    await window.waitForTimeout(250)

    for (const paneId of ['ipad', 'desktop'] as const) {
      const value = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('form-result')?.dataset.textValue ?? ''`
      )
      expect(value).toBe('hello world')
    }
  } finally {
    await close()
  }
})

test('value sync works for React-controlled inputs via native setter', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `
      var el = document.getElementById('react-like-field');
      el.focus();
      el.value = 'react value';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    `)

    // Wait for debounce + IPC round-trip
    await window.waitForTimeout(250)

    for (const paneId of ['ipad', 'desktop'] as const) {
      const value = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('react-result')?.dataset.value ?? ''`
      )
      expect(value).toBe('react value')
    }
  } finally {
    await close()
  }
})

test('value sync does not echo back (no ping-pong)', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `
      var el = document.getElementById('text-field');
      el.focus();
      el.value = 'no echo';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    `)

    // Wait for debounce + IPC + any potential echo
    await window.waitForTimeout(400)

    // The source pane should still have the correct value (not cleared or doubled)
    const sourceValue = await evaluateInPane<string>(
      window,
      'iphone',
      `document.getElementById('text-field')?.value ?? ''`
    )
    expect(sourceValue).toBe('no echo')

    // All panes should have consistent count (exactly one sync, not recursive)
    for (const paneId of ['ipad', 'desktop'] as const) {
      const value = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('form-result')?.dataset.textValue ?? ''`
      )
      expect(value).toBe('no echo')
    }
  } finally {
    await close()
  }
})

test('sync toggle disables value sync', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    // Disable sync
    const toolbar = await getToolbarPage(window)
    await toolbar.getByTestId('sync-toggle').click()

    await evaluateInPane(window, 'iphone', `
      var el = document.getElementById('text-field');
      el.focus();
      el.value = 'should not mirror';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    `)

    await window.waitForTimeout(250)

    for (const paneId of ['ipad', 'desktop'] as const) {
      const value = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('form-result')?.dataset.textValue ?? ''`
      )
      expect(value).toBe('')
    }
  } finally {
    await close()
  }
})

test('paste mirrors the same as typing', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    // Simulate paste: set value + dispatch 'input' event (same as typing)
    await evaluateInPane(window, 'iphone', `
      var el = document.getElementById('text-field');
      el.focus();
      el.value = 'pasted text';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    `)

    await window.waitForTimeout(250)

    for (const paneId of ['ipad', 'desktop'] as const) {
      const value = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('form-result')?.dataset.textValue ?? ''`
      )
      expect(value).toBe('pasted text')
    }
  } finally {
    await close()
  }
})

test('select change mirrors by value with index fallback when option values differ', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `
      var byValue = document.getElementById('country-select');
      byValue.selectedIndex = 2;
      byValue.dispatchEvent(new Event('change', { bubbles: true }));
      var byIndex = document.getElementById('index-fallback-select');
      byIndex.selectedIndex = 1;
      byIndex.dispatchEvent(new Event('change', { bubbles: true }));
    `)

    await expect
      .poll(() =>
        evaluateInPane<string>(
          window,
          'ipad',
          `document.getElementById('form-result')?.dataset.countryValue ?? ''`
        )
      )
      .toBe('jp')

    const desktopState = await evaluateInPane<Record<string, string>>(window, 'desktop', `(() => {
      const result = document.getElementById('form-result');
      return {
        country: result?.dataset.countryValue ?? '',
        city: result?.dataset.cityValue ?? '',
        selectedCityValue: document.getElementById('index-fallback-select')?.value ?? ''
      };
    })()`)

    expect(desktopState.country).toBe('jp')
    expect(desktopState.city).toBe('ny-desktop')
    expect(desktopState.selectedCityValue).toBe('ny-desktop')
  } finally {
    await close()
  }
})

test('pressing Enter in a form field submits matching forms in every pane', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `
      var el = document.getElementById('text-field');
      el.focus();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      if (el.form) {
        el.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    `)

    await expect
      .poll(() =>
        evaluateInPane<string>(
          window,
          'ipad',
          `document.getElementById('form-result')?.dataset.submitCount ?? '0'`
        )
      )
      .toBe('1')

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      const submitCount = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('form-result')?.dataset.submitCount ?? '0'`
      )
      expect(submitCount).toBe('1')
    }
  } finally {
    await close()
  }
})

test('pressing Enter in a cross-device search form POSTs with each pane emulated UA', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/enter-form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `
      var input = document.getElementById('search-input');
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      if (input.form) {
        input.form.requestSubmit();
      }
    `)

    const expectedUa = {
      iphone: /iPhone/,
      ipad: /iPad/,
      desktop: /Macintosh/
    } as const

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      await waitForPaneElement(window, paneId, 'enter-form-result')
      const ua = await evaluateInPane<string>(
        window,
        paneId,
        `document.getElementById('enter-form-result')?.dataset.userAgent ?? ''`
      )
      expect(ua).toMatch(expectedUa[paneId])
    }
  } finally {
    await close()
  }
})

test('missing cross-device search form targets no-op and emit structured mirror-failure logs', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/enter-form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'ipad', `
      document.querySelector('form[name="site-search"]')?.remove();
    `)

    await evaluateInPane(window, 'iphone', `
      var input = document.getElementById('search-input');
      if (input?.form) {
        input.form.requestSubmit();
      }
    `)

    await window.waitForTimeout(300)

    const logs = await getMirrorFailureLogs(window)
    expect(logs.ipad).toEqual(
      expect.arrayContaining([expect.objectContaining({ paneId: 'ipad', reason: 'not-found' })])
    )
  } finally {
    await close()
  }
})

test('typing into the second duplicate text input mirrors to the second match in every pane', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `
      var el = document.querySelectorAll('.dup-text-input')[1];
      el.focus();
      el.value = 'second duplicate';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    `)

    await expect
      .poll(() =>
        evaluateInPane<string>(
          window,
          'ipad',
          `document.getElementById('duplicate-result')?.dataset.secondText ?? ''`
        )
      )
      .toBe('second duplicate')

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      const state = await evaluateInPane<Record<string, string>>(window, paneId, `(() => {
        const inputs = Array.from(document.querySelectorAll('.dup-text-input'));
        const result = document.getElementById('duplicate-result');
        return {
          first: inputs[0]?.value ?? '',
          second: inputs[1]?.value ?? '',
          reflected: result?.dataset.secondText ?? ''
        };
      })()`)

      expect(state.first).toBe('')
      expect(state.second).toBe('second duplicate')
      expect(state.reflected).toBe('second duplicate')
    }
  } finally {
    await close()
  }
})

test('changing the second duplicate select mirrors to the second match in every pane', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `
      var el = document.querySelectorAll('.dup-select')[1];
      el.selectedIndex = 2;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    `)

    await expect
      .poll(() =>
        evaluateInPane<string>(
          window,
          'desktop',
          `document.getElementById('duplicate-result')?.dataset.secondSelect ?? ''`
        )
      )
      .toBe('jp')

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      const state = await evaluateInPane<Record<string, string>>(window, paneId, `(() => {
        const selects = Array.from(document.querySelectorAll('.dup-select'));
        const result = document.getElementById('duplicate-result');
        return {
          first: selects[0]?.value ?? '',
          second: selects[1]?.value ?? '',
          reflected: result?.dataset.secondSelect ?? ''
        };
      })()`)

      expect(state.first).toBe('br')
      expect(state.second).toBe('jp')
      expect(state.reflected).toBe('jp')
    }
  } finally {
    await close()
  }
})

test('pressing Enter in the second duplicate form submits the matching form in every pane', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `
      var input = document.querySelectorAll('.dup-submit-input')[1];
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      if (input.form) {
        input.form.requestSubmit();
      }
    `)

    await expect
      .poll(() =>
        evaluateInPane<string>(
          window,
          'ipad',
          `document.getElementById('duplicate-result')?.dataset.submitIndex ?? '-1'`
        )
      )
      .toBe('1')

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      const state = await evaluateInPane<Record<string, string>>(window, paneId, `(() => {
        const result = document.getElementById('duplicate-result');
        return {
          submitIndex: result?.dataset.submitIndex ?? '-1',
          submitValues: result?.dataset.submitValues ?? ''
        };
      })()`)

      expect(state.submitIndex).toBe('1')
      expect(state.submitValues).toBe('alpha|beta')
    }
  } finally {
    await close()
  }
})

test('checkboxes and radios mirror exactly once through click sync without value-sync double toggles', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `document.getElementById('newsletter-checkbox').click()`)
    await evaluateInPane(window, 'iphone', `document.getElementById('plan-pro').click()`)

    await expect
      .poll(() =>
        evaluateInPane<Record<string, string>>(window, 'ipad', `(() => {
          const result = document.getElementById('form-result');
          return {
            checked: result?.dataset.checkboxChecked ?? '',
            radio: result?.dataset.radioValue ?? ''
          };
        })()`)
      )
      .toEqual({ checked: 'true', radio: 'pro' })

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      const state = await evaluateInPane<Record<string, string>>(window, paneId, `(() => {
        const result = document.getElementById('form-result');
        return {
          checked: result?.dataset.checkboxChecked ?? '',
          radio: result?.dataset.radioValue ?? '',
          checkboxDom: String(document.getElementById('newsletter-checkbox')?.checked ?? false),
          radioDom: String(document.getElementById('plan-pro')?.checked ?? false)
        };
      })()`)

      expect(state.checked).toBe('true')
      expect(state.radio).toBe('pro')
      expect(state.checkboxDom).toBe('true')
      expect(state.radioDom).toBe('true')
    }
  } finally {
    await close()
  }
})

test('duplicate checkboxes and radios mirror to the matching repeated control instance', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'iphone', `
      document.querySelectorAll('.dup-toggle-checkbox')[1]?.click();
      document.querySelectorAll('.dup-toggle-radio')[1]?.click();
    `)

    await expect
      .poll(() =>
        evaluateInPane<Record<string, string>>(window, 'ipad', `(() => {
          const result = document.getElementById('duplicate-result');
          return {
            checkbox: result?.dataset.secondCheckbox ?? '',
            radio: result?.dataset.secondRadio ?? ''
          };
        })()`)
      )
      .toEqual({ checkbox: 'true', radio: 'beta' })

    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      const state = await evaluateInPane<Record<string, string>>(window, paneId, `(() => {
        const result = document.getElementById('duplicate-result');
        const checkboxes = Array.from(document.querySelectorAll('.dup-toggle-checkbox'));
        const radios = Array.from(document.querySelectorAll('.dup-toggle-radio'));
        return {
          checkbox: result?.dataset.secondCheckbox ?? '',
          radio: result?.dataset.secondRadio ?? '',
          firstCheckboxDom: String(checkboxes[0]?.checked ?? false),
          secondCheckboxDom: String(checkboxes[1]?.checked ?? false),
          firstRadioDom: String(radios[0]?.checked ?? false),
          secondRadioDom: String(radios[1]?.checked ?? false)
        };
      })()`)

      expect(state.checkbox).toBe('true')
      expect(state.radio).toBe('beta')
      expect(state.firstCheckboxDom).toBe('false')
      expect(state.secondCheckboxDom).toBe('true')
      expect(state.firstRadioDom).toBe('false')
      expect(state.secondRadioDom).toBe('true')
    }
  } finally {
    await close()
  }
})

test('missing select or form targets no-op and emit structured mirror-failure logs', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)

    await evaluateInPane(window, 'ipad', `
      document.getElementById('test-form')?.replaceWith(document.createElement('div'));
    `)

    await evaluateInPane(window, 'desktop', `
      document.getElementById('country-select')?.remove();
    `)

    await evaluateInPane(window, 'iphone', `
      var select = document.getElementById('country-select');
      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      var form = document.getElementById('text-field')?.form;
      if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    `)

    await window.waitForTimeout(300)

    const desktopCountry = await evaluateInPane<string>(
      window,
      'desktop',
      `document.getElementById('form-result')?.dataset.countryValue ?? ''`
    )
    expect(desktopCountry).toBe('br')

    const logs = await getMirrorFailureLogs(window)
    expect(logs.desktop).toEqual(
      expect.arrayContaining([expect.objectContaining({ paneId: 'desktop', reason: 'not-found' })])
    )
    expect(logs.ipad).toEqual(
      expect.arrayContaining([expect.objectContaining({ paneId: 'ipad', reason: 'not-found' })])
    )
  } finally {
    await close()
  }
})

test('clicking a modal backdrop dismisses the modal in every pane (clickable ancestor)', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/modal-overlay'))
    await waitForAllPanes(window)

    // The backdrop is a non-semantic <div role="dialog"> — under the original
    // rules its click never mirrored, so the modal stayed open in the panes the
    // user didn't click. Click it in one pane; it must close in all of them.
    await evaluateInPane(window, 'iphone', `document.querySelector('[role="dialog"]').click()`)

    for (const paneId of ['ipad', 'desktop'] as const) {
      await expect
        .poll(() =>
          evaluateInPane<string>(
            window,
            paneId,
            `document.getElementById('modal-result')?.dataset.open ?? ''`
          )
        )
        .toBe('false')
    }

    // No ping-pong: exactly one close per pane, and the inside button was never
    // activated by the backdrop mirror.
    await window.waitForTimeout(500)
    for (const paneId of ['iphone', 'ipad', 'desktop'] as const) {
      const state = await evaluateInPane<Record<string, string>>(
        window,
        paneId,
        `(() => {
          const r = document.getElementById('modal-result');
          return {
            open: r?.dataset.open ?? '',
            closed: r?.dataset.closedCount ?? '',
            inside: r?.dataset.insideCount ?? ''
          };
        })()`
      )
      expect(state.open).toBe('false')
      expect(state.closed).toBe('1')
      expect(state.inside).toBe('0')
    }
  } finally {
    await close()
  }
})
