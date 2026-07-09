import { test, expect } from './fixtures'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import {
  evaluateInPane,
  fixtureUrl,
  launchApp,
  navigateTo,
  waitForAllPanes,
  waitForPaneElement
} from './helpers'
import type { SnapshotResult } from '../../src/shared/snapshot'

async function takeSnapshot(window: import('@playwright/test').Page): Promise<SnapshotResult> {
  return window.evaluate(() => window.api.takeSnapshot()) as Promise<SnapshotResult>
}

function findLatestCapture(afterMs: number): string | null {
  const capturesDir = join(homedir(), '.audit-screens', 'captures')
  if (!existsSync(capturesDir)) return null
  const entries = readdirSync(capturesDir)
    .filter((name) => {
      // Timestamp dirs look like 2026-07-09T04-43-00-000Z; parse back to ms
      const iso = name.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z')
      const ts = new Date(iso).getTime()
      return !isNaN(ts) && ts >= afterMs
    })
    .sort()
  return entries.length > 0 ? join(capturesDir, entries[entries.length - 1]) : null
}

test('snapshot bundle is created with context.md and screenshot after capturing errors', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/runtime-evidence'))
    await waitForPaneElement(window, 'desktop', 'runtime-evidence-fixture')
    await waitForAllPanes(window)

    // Emit a console error and a 404 fetch so context.md has content to assert on
    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-console-error')?.click()`
    )
    await evaluateInPane(
      window,
      'desktop',
      `document.getElementById('emit-fetch-404')?.click()`
    )
    await window.waitForTimeout(500)

    const beforeMs = Date.now()
    const result = await takeSnapshot(window)

    expect(result.ok).toBe(true)

    const bundleDir = findLatestCapture(beforeMs)
    expect(bundleDir).not.toBeNull()

    const contextMdPath = join(bundleDir!, 'context.md')
    expect(existsSync(contextMdPath)).toBe(true)

    const contextMd = readFileSync(contextMdPath, 'utf-8')
    expect(contextMd).toContain('# Audit Screens Capture')
    expect(contextMd).toContain(`URL: ${fixtureUrl(fixturePort, '/runtime-evidence')}`)
    expect(contextMd).toContain('fixture-runtime-error')
    expect(contextMd).toContain('/runtime-evidence/api/missing')
    expect(contextMd).toContain('404')

    // Screenshot PNG exists at the device-slug filename
    const pngFiles = readdirSync(bundleDir!).filter((f) => f.endsWith('.png'))
    expect(pngFiles.length).toBe(1)
    expect(existsSync(join(bundleDir!, pngFiles[0]))).toBe(true)
  } finally {
    await close()
  }
})

test('snapshot returns no-url when no page has been loaded', async () => {
  const { window, close } = await launchApp()

  try {
    const result = await takeSnapshot(window)
    expect(result).toEqual({ ok: false, reason: 'no-url' })
  } finally {
    await close()
  }
})
