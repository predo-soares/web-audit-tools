import { test } from './fixtures'
import {
  evaluateInPane,
  fixtureUrl,
  formatSyncTraceForDiag,
  getMirrorFailureLogs,
  getSyncTraceLogs,
  getToolbarPage,
  launchApp,
  navigateTo,
  waitForAllPanes
} from './helpers'

async function dumpDiagnostics(window: Awaited<ReturnType<typeof launchApp>>['window'], label: string) {
  const trace = await getSyncTraceLogs(window)
  const mirror = await getMirrorFailureLogs(window)
  console.log(`\n========== SYNC TRACE: ${label} ==========\n`)
  console.log(formatSyncTraceForDiag(trace))
  console.log(`\n========== MIRROR FAILURES: ${label} ==========\n`)
  console.log(JSON.stringify(mirror, null, 2))
}

test('diag: link navigation sync', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/semantic-click'))
    await waitForAllPanes(window)
    // sync starts enabled; ensure it is on (same as real test after second toggle)
    const enabled = await window.evaluate(() => window.api.getSyncEnabled())
    if (!enabled) {
      const toolbar = await getToolbarPage(window)
      await toolbar.getByTestId('sync-toggle').click()
    }
    await evaluateInPane(window, 'iphone', `document.getElementById('semantic-link')?.click()`)
    await window.waitForTimeout(800)
    await dumpDiagnostics(window, 'link navigation (sync on)')
  } finally {
    await close()
  }
})

test('diag: below-fold click sync', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/below-fold-button'))
    await waitForAllPanes(window)
    await evaluateInPane(window, 'iphone', `document.getElementById('below-fold-btn').click()`)
    await window.waitForTimeout(800)
    await dumpDiagnostics(window, 'below-fold')
  } finally {
    await close()
  }
})

test('diag: duplicate select sync', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)
    await evaluateInPane(window, 'iphone', `
      var el = document.querySelectorAll('.dup-select')[1];
      el.selectedIndex = 2;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    `)
    await window.waitForTimeout(800)
    await dumpDiagnostics(window, 'duplicate select')
  } finally {
    await close()
  }
})

test('diag: checkbox/radio click sync', async ({ fixturePort }) => {
  const { window, close } = await launchApp()
  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/form-sync'))
    await waitForAllPanes(window)
    await evaluateInPane(window, 'iphone', `document.getElementById('newsletter-checkbox').click()`)
    await evaluateInPane(window, 'iphone', `document.getElementById('plan-pro').click()`)
    await window.waitForTimeout(800)
    await dumpDiagnostics(window, 'checkbox/radio')
  } finally {
    await close()
  }
})

test('diag: missing select/form mirror-failure logs', async ({ fixturePort }) => {
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
    await window.waitForTimeout(800)
    await dumpDiagnostics(window, 'missing select/form')
  } finally {
    await close()
  }
})
