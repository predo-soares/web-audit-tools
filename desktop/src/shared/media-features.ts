import { DEFAULT_MEDIA_FEATURES, type MediaFeatureState, type ThemePreference } from './types'

export interface EmulatedMediaFeature {
  name: string
  value: string
}

export interface EmulatedMedia {
  /** CDP `media` param: '' means no media-type override (renders as screen). */
  media: string
  /** Only the features the user has actually overridden. */
  features: EmulatedMediaFeature[]
}

/**
 * Fill any missing keys from persisted / partial media-feature payloads so CDP
 * commands always receive valid parameters (undefined enum values throw
 * "Invalid parameters").
 */
export function normalizeMediaFeatures(
  state: Partial<MediaFeatureState> | null | undefined
): MediaFeatureState {
  return { ...DEFAULT_MEDIA_FEATURES, ...(state ?? {}) }
}

/**
 * Map the theme preference + emulated media features onto the argument shape of
 * CDP `Emulation.setEmulatedMedia`. A feature is emitted only when it is
 * overridden, so a fully-default state clears all emulation (empty `features`,
 * empty `media`). `prefers-color-scheme` comes from {@link ThemePreference}
 * (`system` = no override) to stay in sync with the toolbar theme toggle.
 */
export function buildEmulatedMedia(
  theme: ThemePreference,
  mediaFeatures: MediaFeatureState
): EmulatedMedia {
  const features: EmulatedMediaFeature[] = []

  if (theme !== 'system') {
    features.push({ name: 'prefers-color-scheme', value: theme })
  }

  const push = (name: string, value: MediaFeatureState[keyof MediaFeatureState]): void => {
    if (typeof value === 'string' && value !== 'no-override') {
      features.push({ name, value })
    }
  }

  push('prefers-reduced-motion', mediaFeatures.reducedMotion)
  push('prefers-reduced-data', mediaFeatures.reducedData)
  push('prefers-reduced-transparency', mediaFeatures.reducedTransparency)
  push('forced-colors', mediaFeatures.forcedColors)
  push('prefers-contrast', mediaFeatures.contrast)
  push('color-gamut', mediaFeatures.colorGamut)

  const media = mediaFeatures.mediaType === 'no-override' ? '' : mediaFeatures.mediaType

  return { media, features }
}
