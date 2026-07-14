import { describe, expect, it } from 'vitest'
import { buildEmulatedMedia } from '../../src/shared/media-features'
import { DEFAULT_MEDIA_FEATURES } from '../../src/shared/types'
import type { MediaFeatureState } from '../../src/shared/types'

function featureMap(features: { name: string; value: string }[]): Record<string, string> {
  return Object.fromEntries(features.map((f) => [f.name, f.value]))
}

describe('buildEmulatedMedia', () => {
  it('emits nothing when theme is system and all features default', () => {
    const result = buildEmulatedMedia('system', DEFAULT_MEDIA_FEATURES)
    expect(result).toEqual({ media: '', features: [] })
  })

  it('maps a non-system theme to prefers-color-scheme', () => {
    const result = buildEmulatedMedia('dark', DEFAULT_MEDIA_FEATURES)
    expect(featureMap(result.features)).toEqual({ 'prefers-color-scheme': 'dark' })
  })

  it('omits features left at no-override', () => {
    const state: MediaFeatureState = {
      ...DEFAULT_MEDIA_FEATURES,
      reducedMotion: 'reduce',
      colorGamut: 'p3'
    }
    const result = buildEmulatedMedia('system', state)
    expect(featureMap(result.features)).toEqual({
      'prefers-reduced-motion': 'reduce',
      'color-gamut': 'p3'
    })
  })

  it('sets the media type when overridden, leaving it out of features', () => {
    const state: MediaFeatureState = { ...DEFAULT_MEDIA_FEATURES, mediaType: 'print' }
    const result = buildEmulatedMedia('system', state)
    expect(result.media).toBe('print')
    expect(result.features).toEqual([])
  })

  it('combines theme, media type, and every overridden feature', () => {
    const state: MediaFeatureState = {
      reducedMotion: 'reduce',
      reducedData: 'reduce',
      reducedTransparency: 'reduce',
      forcedColors: 'active',
      contrast: 'more',
      colorGamut: 'rec2020',
      mediaType: 'print',
      autoDarkMode: true
    }
    const result = buildEmulatedMedia('light', state)
    expect(result.media).toBe('print')
    expect(featureMap(result.features)).toEqual({
      'prefers-color-scheme': 'light',
      'prefers-reduced-motion': 'reduce',
      'prefers-reduced-data': 'reduce',
      'prefers-reduced-transparency': 'reduce',
      'forced-colors': 'active',
      'prefers-contrast': 'more',
      'color-gamut': 'rec2020'
    })
  })
})
