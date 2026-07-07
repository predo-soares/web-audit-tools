import { describe, expect, it } from 'vitest'
import { PANE_IDS } from '../../src/shared/device-presets'
import {
  computeScrollRatio,
  createScrollSyncState,
  handleScrollEvent,
  setScrollSyncEnabled
} from '../../src/shared/scroll-sync'

describe('scroll-sync', () => {
  it('computes ratio from scroll metrics', () => {
    expect(computeScrollRatio(375, 1250, 500)).toBe(0.5)
    expect(computeScrollRatio(0, 500, 500)).toBeNull()
  })

  it('propagates user scroll to other panes', () => {
    const state = createScrollSyncState(true)
    const result = handleScrollEvent(state, { paneId: 'iphone', ratio: 0.4, programmatic: false }, PANE_IDS)

    expect(result.targets).toEqual([
      { paneId: 'ipad', ratio: 0.4 },
      { paneId: 'desktop', ratio: 0.4 }
    ])
    expect(result.state.echoFrom).toEqual({ ipad: true, desktop: true })
  })

  it('suppresses echo from programmatic scroll events', () => {
    let state = createScrollSyncState(true)
    const first = handleScrollEvent(
      state,
      { paneId: 'iphone', ratio: 0.4, programmatic: false },
      PANE_IDS
    )
    state = first.state

    const echo = handleScrollEvent(
      state,
      { paneId: 'ipad', ratio: 0.4, programmatic: true },
      PANE_IDS
    )

    expect(echo.targets).toEqual([])
    expect(echo.state.echoFrom.ipad).toBeUndefined()
  })

  it('handles rapid alternating scrolls without stale echo flags', () => {
    let state = createScrollSyncState(true)

    const a = handleScrollEvent(state, { paneId: 'iphone', ratio: 0.2, programmatic: false }, PANE_IDS)
    state = a.state
    const ipadEcho = handleScrollEvent(
      state,
      { paneId: 'ipad', ratio: 0.2, programmatic: true },
      PANE_IDS
    )
    state = ipadEcho.state
    const desktopEcho = handleScrollEvent(
      state,
      { paneId: 'desktop', ratio: 0.2, programmatic: true },
      PANE_IDS
    )
    state = desktopEcho.state
    const c = handleScrollEvent(state, { paneId: 'desktop', ratio: 0.8, programmatic: false }, PANE_IDS)

    expect(c.targets).toEqual([
      { paneId: 'iphone', ratio: 0.8 },
      { paneId: 'ipad', ratio: 0.8 }
    ])
  })

  it('does nothing when sync is disabled', () => {
    const state = setScrollSyncEnabled(createScrollSyncState(true), false)
    const result = handleScrollEvent(state, { paneId: 'iphone', ratio: 0.5, programmatic: false }, PANE_IDS)
    expect(result.targets).toEqual([])
  })
})
