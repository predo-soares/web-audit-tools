import { describe, expect, it } from 'vitest'
import { normalizeUrl } from '../../src/shared/url'

describe('normalizeUrl', () => {
  it('defaults to https for regular hosts', () => {
    expect(normalizeUrl('example.com/path')).toBe('https://example.com/path')
  })

  it('uses http for localhost', () => {
    expect(normalizeUrl('localhost:3000')).toBe('http://localhost:3000')
    expect(normalizeUrl('127.0.0.1:4173/')).toBe('http://127.0.0.1:4173/')
  })

  it('preserves explicit schemes', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com')
    expect(normalizeUrl('http://localhost:8080')).toBe('http://localhost:8080')
  })
})
