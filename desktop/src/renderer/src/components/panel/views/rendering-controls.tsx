import { useEffect, useState } from 'react'
import {
  SegmentedControl,
  type SegmentedControlOption
} from '@renderer/components/ui/segmented-control'
import { DEFAULT_MEDIA_FEATURES } from '../../../../../shared/types'
import type { MediaFeatureState, ThemePreference } from '../../../../../shared/types'

const THEME_STORAGE_KEY = 'audit-screens-theme-preference'
const MEDIA_FEATURES_STORAGE_KEY = 'audit-screens-media-features'

function readStoredTheme(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

const COLOR_SCHEME_OPTIONS: SegmentedControlOption<ThemePreference>[] = [
  { value: 'system', label: 'auto' },
  { value: 'light', label: 'light' },
  { value: 'dark', label: 'dark' }
]

// Each row's leftmost option carries 'no-override' (page behaves naturally) but
// is labelled with the CSS default so the layout mirrors the DevTools panel.
const REDUCED_OPTIONS: SegmentedControlOption<MediaFeatureState['reducedMotion']>[] = [
  { value: 'no-override', label: 'no-preference' },
  { value: 'reduce', label: 'reduce' }
]

const FORCED_COLORS_OPTIONS: SegmentedControlOption<MediaFeatureState['forcedColors']>[] = [
  { value: 'no-override', label: 'none' },
  { value: 'active', label: 'active' }
]

const CONTRAST_OPTIONS: SegmentedControlOption<MediaFeatureState['contrast']>[] = [
  { value: 'no-override', label: 'no-preference' },
  { value: 'less', label: 'less' },
  { value: 'more', label: 'more' },
  { value: 'custom', label: 'custom' }
]

const COLOR_GAMUT_OPTIONS: SegmentedControlOption<MediaFeatureState['colorGamut']>[] = [
  { value: 'no-override', label: 'off' },
  { value: 'srgb', label: 'srgb' },
  { value: 'p3', label: 'p3' },
  { value: 'rec2020', label: 'rec2020' }
]

const MEDIA_TYPE_OPTIONS: SegmentedControlOption<MediaFeatureState['mediaType']>[] = [
  { value: 'no-override', label: 'screen' },
  { value: 'print', label: 'print' }
]

const AUTO_DARK_OPTIONS: SegmentedControlOption<'off' | 'on'>[] = [
  { value: 'off', label: 'off' },
  { value: 'on', label: 'on' }
]

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 border-b border-white/5 px-1 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function RenderingControls(): React.JSX.Element {
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme)
  const [media, setMedia] = useState<MediaFeatureState>(DEFAULT_MEDIA_FEATURES)

  useEffect(() => {
    void window.panelApi.getMediaFeatures().then(setMedia)

    const unsubscribeTheme = window.panelApi.onPanelThemeChanged(setTheme)
    const unsubscribeMedia = window.panelApi.onMediaFeaturesChanged(setMedia)
    return () => {
      unsubscribeTheme()
      unsubscribeMedia()
    }
  }, [])

  const changeTheme = (preference: ThemePreference): void => {
    setTheme(preference)
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
    void window.panelApi.setPaneThemePreference(preference)
  }

  const changeMedia = <K extends keyof MediaFeatureState>(
    key: K,
    value: MediaFeatureState[K]
  ): void => {
    const next = { ...media, [key]: value }
    setMedia(next)
    window.localStorage.setItem(MEDIA_FEATURES_STORAGE_KEY, JSON.stringify(next))
    void window.panelApi.setMediaFeatures(next)
  }

  return (
    <div
      data-testid="rendering-controls"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-1"
    >
      <Row label="Prefers-color-scheme">
        <SegmentedControl
          ariaLabel="Prefers-color-scheme"
          options={COLOR_SCHEME_OPTIONS}
          value={theme}
          onChange={changeTheme}
        />
      </Row>
      <Row label="Prefers-reduced-motion">
        <SegmentedControl
          ariaLabel="Prefers-reduced-motion"
          options={REDUCED_OPTIONS}
          value={media.reducedMotion}
          onChange={(value) => changeMedia('reducedMotion', value)}
        />
      </Row>
      <Row label="Prefers-reduced-data">
        <SegmentedControl
          ariaLabel="Prefers-reduced-data"
          options={REDUCED_OPTIONS}
          value={media.reducedData}
          onChange={(value) => changeMedia('reducedData', value)}
        />
      </Row>
      <Row label="Prefers-reduced-transparency">
        <SegmentedControl
          ariaLabel="Prefers-reduced-transparency"
          options={REDUCED_OPTIONS}
          value={media.reducedTransparency}
          onChange={(value) => changeMedia('reducedTransparency', value)}
        />
      </Row>
      <Row label="Forced-colors">
        <SegmentedControl
          ariaLabel="Forced-colors"
          options={FORCED_COLORS_OPTIONS}
          value={media.forcedColors}
          onChange={(value) => changeMedia('forcedColors', value)}
        />
      </Row>
      <Row label="Prefers-contrast">
        <SegmentedControl
          ariaLabel="Prefers-contrast"
          options={CONTRAST_OPTIONS}
          value={media.contrast}
          onChange={(value) => changeMedia('contrast', value)}
        />
      </Row>
      <Row label="Color-gamut">
        <SegmentedControl
          ariaLabel="Color-gamut"
          options={COLOR_GAMUT_OPTIONS}
          value={media.colorGamut}
          onChange={(value) => changeMedia('colorGamut', value)}
        />
      </Row>
      <Row label="Media type">
        <SegmentedControl
          ariaLabel="Media type"
          options={MEDIA_TYPE_OPTIONS}
          value={media.mediaType}
          onChange={(value) => changeMedia('mediaType', value)}
        />
      </Row>
      <Row label="Automatic dark theme">
        <SegmentedControl
          ariaLabel="Automatic dark theme"
          options={AUTO_DARK_OPTIONS}
          value={media.autoDarkMode ? 'on' : 'off'}
          onChange={(value) => changeMedia('autoDarkMode', value === 'on')}
        />
      </Row>
    </div>
  )
}
