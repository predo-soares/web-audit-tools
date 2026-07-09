import { describe, expect, it } from 'vitest'
import { createEchoLedger } from '../../src/main/echo-ledger'

function createFakeClock(start = 1_000_000) {
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

  it('never expires a scroll expectation by time', () => {
    const clock = createFakeClock()
    const ledger = createEchoLedger(clock.now)

    ledger.expect('ipad', 'scroll')
    clock.advance(60_000)
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
})
