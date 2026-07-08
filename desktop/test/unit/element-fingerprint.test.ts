import { describe, expect, it } from 'vitest'
import {
  buildElementFingerprint,
  isMachineGeneratedId,
  resolveElementFingerprint
} from '../../src/shared/element-fingerprint'

describe('element fingerprint', () => {
  it('builds and resolves the stable id layer first', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      id: 'open-menu',
      visibleText: 'Open menu'
    })

    expect(fingerprint).toEqual({
      layers: [
        { type: 'id', id: 'open-menu' },
        { type: 'text-tag', tagName: 'button', text: 'Open menu' }
      ]
    })

    expect(
      resolveElementFingerprint(fingerprint!, [
        { tagName: 'button', id: 'other', visibleText: 'Open menu' },
        { tagName: 'button', id: 'open-menu', visibleText: 'Renamed' }
      ])
    ).toEqual({ index: 1, layer: { type: 'id', id: 'open-menu' } })
  })

  it('skips machine-generated-looking ids and resolves by visible text plus tag', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      id: 'button-123456',
      visibleText: 'Save changes'
    })

    expect(isMachineGeneratedId('button-123456')).toBe(true)
    expect(fingerprint).toEqual({
      layers: [{ type: 'text-tag', tagName: 'button', text: 'Save changes' }]
    })

    expect(
      resolveElementFingerprint(fingerprint!, [
        { tagName: 'a', visibleText: 'Save changes' },
        { tagName: 'button', visibleText: ' Save   changes ' }
      ])
    ).toEqual({
      index: 1,
      layer: { type: 'text-tag', tagName: 'button', text: 'Save changes' }
    })
  })

  it('returns no match when the matching text and tag layer is ambiguous', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      visibleText: 'Add to cart'
    })

    expect(
      resolveElementFingerprint(fingerprint!, [
        { tagName: 'button', visibleText: 'Add to cart' },
        { tagName: 'button', visibleText: 'Add to cart' }
      ])
    ).toBeNull()
  })
})
