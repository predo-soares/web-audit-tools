import type { PaneId } from '../../shared/types'

export type EchoKind = 'click' | 'submit' | 'scroll' | 'value' | 'key'

export interface EchoExpectation {
  revoke(): void
}

export interface EchoLedger {
  /**
   * Record that a mirrored action is about to be applied to a pane, so the
   * pane's re-report of that action is recognized as an echo. Returns an
   * expectation that can be revoked if the action ends up not being applied.
   */
  expect(paneId: PaneId, kind: EchoKind): EchoExpectation
  /**
   * Check whether an incoming event from a pane is the echo of a mirrored
   * action. Consumes one live expectation; expired expectations are dropped
   * so they can't swallow a later real event.
   */
  isEcho(paneId: PaneId, kind: EchoKind): boolean
  /** Drop every expectation of a kind across all panes. */
  clear(kind: EchoKind): void
}

// Mirrored clicks/submits are trusted native input, so the target pane's
// preload re-reports them; if the mirrored action never produces an event
// (e.g. mousedown/mouseup land on different elements) the expectation must
// age out rather than swallow a later real click. Scroll expectations are
// one-shot flags — a broadcast scroll produces exactly one echo report per
// target — but they still age out on a finite TTL: a broadcast scroll that
// lands on a pane already at that position produces NO echo event, so an
// immortal flag would silently swallow the user's next real scroll on that
// pane. The TTL is refreshed on each re-expect so an in-flight echo is still
// caught while active broadcasting continues.
const KIND_TTL_MS: Record<EchoKind, number> = {
  click: 1000,
  submit: 1000,
  scroll: 1000,
  value: 1000,
  key: 1000
}

interface Entry {
  expiresAt: number
}

/**
 * Echo ledger — the single record of "this pane is about to report an event
 * that we caused". All echo suppression across Interaction sync and Scroll
 * sync goes through this interface; per-kind TTL and one-shot semantics are
 * implementation.
 */
export function createEchoLedger(now: () => number = Date.now): EchoLedger {
  const queues = new Map<string, Entry[]>()

  function queueFor(paneId: PaneId, kind: EchoKind): Entry[] {
    const key = `${paneId}:${kind}`
    let queue = queues.get(key)
    if (!queue) {
      queue = []
      queues.set(key, queue)
    }
    return queue
  }

  return {
    expect(paneId: PaneId, kind: EchoKind): EchoExpectation {
      const queue = queueFor(paneId, kind)
      let entry: Entry
      if (kind === 'scroll' && queue.length > 0) {
        // One-shot flag: expecting a scroll echo twice is the same expectation.
        // Refresh its deadline so continued broadcasting keeps it live, but a
        // quiet flag (no echo ever arrives) still ages out via the TTL.
        entry = queue[0]
        entry.expiresAt = now() + KIND_TTL_MS[kind]
      } else {
        entry = { expiresAt: now() + KIND_TTL_MS[kind] }
        queue.push(entry)
      }
      return {
        revoke(): void {
          const index = queue.indexOf(entry)
          if (index !== -1) queue.splice(index, 1)
        }
      }
    },

    isEcho(paneId: PaneId, kind: EchoKind): boolean {
      const queue = queueFor(paneId, kind)
      const timestamp = now()
      while (queue.length) {
        const entry = queue.shift()
        if (entry !== undefined && entry.expiresAt >= timestamp) return true
      }
      return false
    },

    clear(kind: EchoKind): void {
      for (const key of queues.keys()) {
        if (key.endsWith(`:${kind}`)) queues.delete(key)
      }
    }
  }
}
