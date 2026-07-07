import type { PaneId } from './types'

export interface ScrollSyncState {
  enabled: boolean
  echoFrom: Partial<Record<PaneId, boolean>>
}

export interface ScrollApplyTarget {
  paneId: PaneId
  ratio: number
}

export interface ScrollEventInput {
  paneId: PaneId
  ratio: number
  programmatic: boolean
}

export function createScrollSyncState(enabled = true): ScrollSyncState {
  return { enabled, echoFrom: {} }
}

export function setScrollSyncEnabled(_state: ScrollSyncState, enabled: boolean): ScrollSyncState {
  return { enabled, echoFrom: {} }
}

export function computeScrollRatio(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number
): number | null {
  const maxScroll = scrollHeight - clientHeight
  if (maxScroll <= 0) return null
  return Math.min(1, Math.max(0, scrollTop / maxScroll))
}

export function handleScrollEvent(
  state: ScrollSyncState,
  event: ScrollEventInput,
  paneIds: readonly PaneId[]
): { state: ScrollSyncState; targets: ScrollApplyTarget[] } {
  if (!state.enabled) {
    return { state, targets: [] }
  }

  if (event.programmatic || state.echoFrom[event.paneId]) {
    const echoFrom = { ...state.echoFrom }
    delete echoFrom[event.paneId]
    return { state: { ...state, echoFrom }, targets: [] }
  }

  const echoFrom: Partial<Record<PaneId, boolean>> = {}
  const targets: ScrollApplyTarget[] = []

  for (const paneId of paneIds) {
    if (paneId === event.paneId) continue
    echoFrom[paneId] = true
    targets.push({ paneId, ratio: event.ratio })
  }

  return {
    state: { ...state, echoFrom },
    targets
  }
}
