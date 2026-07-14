import { describe, expect, it } from 'vitest'
import { overlayBitmap } from '../../src/main/chrome/bitmap-overlay'

describe('overlayBitmap', () => {
  it('paints an opaque overlay onto the base image', () => {
    const width = 4
    const height = 4
    const base = Buffer.alloc(width * height * 4, 0)
    for (let i = 0; i < width * height; i++) {
      base[i * 4 + 3] = 255
    }

    const overlay = Buffer.alloc(width * 1 * 4)
    for (let i = 0; i < width; i++) {
      overlay[i * 4] = 0
      overlay[i * 4 + 1] = 0
      overlay[i * 4 + 2] = 255
      overlay[i * 4 + 3] = 255
    }

    overlayBitmap(base, width, height, overlay, width, 1, 0, 0)

    expect(base[0]).toBe(0)
    expect(base[1]).toBe(0)
    expect(base[2]).toBe(255)
    expect(base[3]).toBe(255)

    const below = 1 * width * 4
    expect(base[below]).toBe(0)
    expect(base[below + 1]).toBe(0)
    expect(base[below + 2]).toBe(0)
    expect(base[below + 3]).toBe(255)
  })
})
