import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import {
  evaluateInPane,
  fixtureUrl,
  getToolbarPage,
  launchApp,
  navigateTo,
  waitForAllPanes
} from './helpers'

async function activateInspection(window: Page, toolbar: Page): Promise<void> {
  await toolbar.getByTestId('diagnostics-toggle').click()
  await expect(window.getByTestId('diagnostics-drawer')).toBeVisible()
  await expect(window.getByTestId('diagnostics-tab-inspection')).toHaveAttribute(
    'aria-label',
    'Inspection'
  )
  await window.getByTestId('diagnostics-tab-inspection').click()
  await expect(window.getByTestId('diagnostics-tab-inspection')).toHaveAttribute(
    'aria-selected',
    'true'
  )
}

async function hoverInPane(window: Page, paneId: string, elementId: string): Promise<void> {
  await evaluateInPane(
    window,
    paneId,
    `document.getElementById(${JSON.stringify(elementId)})?.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }))`
  )
}

test('Element picker selects a page element without leaving Preview', async ({ fixturePort }) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/'))
    await waitForAllPanes(window)

    const toolbar = await getToolbarPage(window)
    await activateInspection(window, toolbar)

    await hoverInPane(window, 'desktop', 'fixture-home')

    await expect(window.getByTestId('diagnostics-drawer')).toBeVisible()
    await expect(window.getByTestId('diagnostics-tab-inspection')).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(window.getByTestId('inspection-rail')).toBeVisible()
    await expect(window.getByTestId('inspection-rail')).toContainText('desktop')
    await expect(window.getByTestId('preview-canvas')).toBeVisible()

    const markupTree = window.getByTestId('inspection-markup-tree')
    const rootMarkupNode = markupTree.getByRole('treeitem').first()
    await expect(rootMarkupNode).toHaveAttribute('data-selected-node', 'true')
    await expect(rootMarkupNode).toHaveAttribute('aria-expanded', 'true')
    await expect(markupTree.getByRole('treeitem')).not.toHaveCount(1)
    await expect(markupTree).not.toHaveCSS('user-select', 'none')

    await rootMarkupNode.focus()
    await rootMarkupNode.press('ArrowLeft')
    await expect(rootMarkupNode).toHaveAttribute('aria-expanded', 'false')
    await rootMarkupNode.press('ArrowRight')
    await expect(rootMarkupNode).toHaveAttribute('aria-expanded', 'true')

    await expect(window.getByTestId('inspection-box-model')).toBeVisible()
    await expect(window.getByTestId('inspection-box-model')).toContainText('margin')
    await expect(window.getByTestId('inspection-computed-properties')).toContainText('display')
    await expect(window.getByTestId('inspection-computed-properties-list')).toHaveCSS(
      'max-height',
      '320px'
    )
    await expect(window.getByTestId('inspection-markup-tree')).toBeVisible()
    await expect(window.getByTestId('inspection-markup-section')).toHaveCSS('max-height', '320px')
    await expect(window.getByRole('tab', { name: 'Box model' })).toHaveCount(0)

    await window.getByTestId('inspection-close').click()
    await expect(window.getByTestId('inspection-rail')).toHaveCount(0)
    await expect(window.getByTestId('diagnostics-tab-console')).toBeVisible()
  } finally {
    await close()
  }
})

test('Element picker compares visible panes independently of interaction links', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/ua-sniff'))
    await waitForAllPanes(window)
    await window.evaluate(() => window.api.setPaneLinked('ipad', false))

    const toolbar = await getToolbarPage(window)
    await activateInspection(window, toolbar)
    await hoverInPane(window, 'desktop', 'layout')

    await expect(window.getByTestId('inspection-difference-width')).toBeVisible()
  } finally {
    await close()
  }
})

test('Element picker marks a removed node stale without blocking page lifecycle', async ({
  fixturePort
}) => {
  const { window, close } = await launchApp()

  try {
    await navigateTo(window, fixtureUrl(fixturePort, '/long-scroll'))
    await waitForAllPanes(window)
    const toolbar = await getToolbarPage(window)
    await activateInspection(window, toolbar)
    await hoverInPane(window, 'desktop', 'section-0')
    await expect(window.getByTestId('inspection-rail')).toBeVisible()

    await evaluateInPane(window, 'desktop', `document.getElementById('section-0')?.remove()`)
    await expect(window.getByTestId('inspection-empty-desktop')).toContainText('Stale')

    await evaluateInPane(window, 'desktop', `window.scrollTo({ top: 400, behavior: 'instant' })`)
    await expect(window.getByTestId('inspection-rail')).toBeVisible()
  } finally {
    await close()
  }
})
