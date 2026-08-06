import { describe, expect, it } from 'vitest'
import { createEchoLedger } from '../../src/main/panes/echo-ledger'

function createFakeClock(start = 1_000_000): {
  now: () => number
  advance: (ms: number) => void
} {
  let now = start
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms
    }
  }
}

describe('echo ledger', () => {
  it('recognizes an expected click echo exactly once', () => {
    const ledger = createEchoLedger(createFakeClock().now)

    ledger.expect('ipad', 'click')
    expect(ledger.isEcho('ipad', 'click')).toBe(true)
    expect(ledger.isEcho('ipad', 'click')).toBe(false)
  })

  it('scopes expectations to pane and kind', () => {
    const ledger = createEchoLedger(createFakeClock().now)

    ledger.expect('ipad', 'click')
    expect(ledger.isEcho('desktop', 'click')).toBe(false)
    expect(ledger.isEcho('ipad', 'submit')).toBe(false)
    expect(ledger.isEcho('ipad', 'click')).toBe(true)
  })

  it('drops an expired click expectation so it cannot swallow a later real click', () => {
    const clock = createFakeClock()
    const ledger = createEchoLedger(clock.now)

    ledger.expect('ipad', 'click')
    clock.advance(1001)
    expect(ledger.isEcho('ipad', 'click')).toBe(false)
  })

  it('drains expired entries but consumes the first live one', () => {
    const clock = createFakeClock()
    const ledger = createEchoLedger(clock.now)

    ledger.expect('ipad', 'click')
    clock.advance(1001)
    ledger.expect('ipad', 'click')
    expect(ledger.isEcho('ipad', 'click')).toBe(true)
    expect(ledger.isEcho('ipad', 'click')).toBe(false)
  })

  it('revoking an expectation removes only that expectation', () => {
    const ledger = createEchoLedger(createFakeClock().now)

    const first = ledger.expect('ipad', 'click')
    ledger.expect('ipad', 'click')
    first.revoke()
    expect(ledger.isEcho('ipad', 'click')).toBe(true)
    expect(ledger.isEcho('ipad', 'click')).toBe(false)
  })

  it('treats scroll expectations as one-shot flags, not counters', () => {
    const ledger = createEchoLedger(createFakeClock().now)

    ledger.expect('ipad', 'scroll')
    ledger.expect('ipad', 'scroll')
    expect(ledger.isEcho('ipad', 'scroll')).toBe(true)
    expect(ledger.isEcho('ipad', 'scroll')).toBe(false)
  })

  it('still catches an in-flight scroll echo within the TTL', () => {
    const clock = createFakeClock()
    const ledger = createEchoLedger(clock.now)

    ledger.expect('ipad', 'scroll')
    clock.advance(200)
    expect(ledger.isEcho('ipad', 'scroll')).toBe(true)
  })

  it('ages out a scroll expectation whose echo never arrives (stuck-scroll fix)', () => {
    const clock = createFakeClock()
    const ledger = createEchoLedger(clock.now)

    // Mirrored scroll landed on a pane already at that position: no scroll event
    // fires, so the expectation is never consumed. It must not swallow the
    // user's next real scroll after the TTL.
    ledger.expect('ipad', 'scroll')
    clock.advance(1001)
    expect(ledger.isEcho('ipad', 'scroll')).toBe(false)
  })

  it('refreshes the scroll deadline while broadcasting continues', () => {
    const clock = createFakeClock()
    const ledger = createEchoLedger(clock.now)

    ledger.expect('ipad', 'scroll')
    clock.advance(800)
    ledger.expect('ipad', 'scroll') // continued broadcast refreshes the deadline
    clock.advance(800) // 1600ms since first expect, but only 800ms since refresh
    expect(ledger.isEcho('ipad', 'scroll')).toBe(true)
  })

  it('clears one kind without touching the others', () => {
    const ledger = createEchoLedger(createFakeClock().now)

    ledger.expect('ipad', 'scroll')
    ledger.expect('desktop', 'scroll')
    ledger.expect('ipad', 'click')
    ledger.clear('scroll')

    expect(ledger.isEcho('ipad', 'scroll')).toBe(false)
    expect(ledger.isEcho('desktop', 'scroll')).toBe(false)
    expect(ledger.isEcho('ipad', 'click')).toBe(true)
  })

  it('recognizes an expected value echo exactly once', () => {
    const ledger = createEchoLedger(createFakeClock().now)

    ledger.expect('ipad', 'value')
    expect(ledger.isEcho('ipad', 'value')).toBe(true)
    expect(ledger.isEcho('ipad', 'value')).toBe(false)
  })
  it('recognizes an expected key echo exactly once', () => {
    const ledger = createEchoLedger(createFakeClock().now)

    ledger.expect('ipad', 'key')
    expect(ledger.isEcho('ipad', 'key')).toBe(true)
    expect(ledger.isEcho('ipad', 'key')).toBe(false)
  })

  it('drops an expired key expectation so it cannot swallow a later real shortcut', () => {
    const clock = createFakeClock()
    const ledger = createEchoLedger(clock.now)

    ledger.expect('ipad', 'key')
    clock.advance(1001)
    expect(ledger.isEcho('ipad', 'key')).toBe(false)
  })
})
