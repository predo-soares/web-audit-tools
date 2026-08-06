import { useEffect, useState } from 'react'
import {
  SegmentedControl,
  type SegmentedControlOption
} from '@renderer/components/ui/segmented-control'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { DEFAULT_MEDIA_FEATURES } from '../../../../../shared/types'
import type {
  MediaFeatureState,
  ThemePreference,
  VisionDeficiency
} from '../../../../../shared/types'

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

const VISION_DEFICIENCY_OPTIONS: { value: VisionDeficiency; label: string }[] = [
  { value: 'none', label: 'No emulation' },
  { value: 'blurredVision', label: 'Blurred vision' },
  { value: 'reducedContrast', label: 'Reduced contrast' },
  { value: 'achromatopsia', label: 'Achromatopsia' },
  { value: 'deuteranopia', label: 'Deuteranopia' },
  { value: 'protanopia', label: 'Protanopia' },
  { value: 'tritanopia', label: 'Tritanopia' }
]

const OS_TEXT_SCALE_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: 'No emulation' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: '2' },
  { value: '3', label: '3' }
]

function SegmentedRow({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 border-b border-white/5 px-1 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function CheckboxRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 border-b border-white/5 px-1 py-2.5 hover:bg-white/[0.02]">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium leading-tight">{label}</span>
        <span className="text-[10px] leading-tight text-muted-foreground">{description}</span>
      </div>
    </label>
  )
}

function SelectRow({
  label,
  description,
  value,
  options,
  onChange
}: {
  label: string
  description: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 border-b border-white/5 px-1 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium leading-tight">{label}</span>
        <span className="text-[10px] leading-tight text-muted-foreground">{description}</span>
      </div>
      <Select
        value={value}
        onValueChange={(next) => {
          // base-ui types the value as nullable (clearable selects); this one is
          // always set, so ignore a null and forward the chosen string.
          if (next !== null) onChange(next)
        }}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      {/* Rendering overlay flags */}
      <CheckboxRow
        label="Paint flashing"
        description="Highlights areas of the page (green) that need to be repainted."
        checked={media.paintFlashing}
        onChange={(v) => changeMedia('paintFlashing', v)}
      />
      <CheckboxRow
        label="Layout shift regions"
        description="Highlights areas of the page (blue) that were shifted."
        checked={media.layoutShiftRegions}
        onChange={(v) => changeMedia('layoutShiftRegions', v)}
      />
      <CheckboxRow
        label="Layer borders"
        description="Shows layer borders (orange/olive) and tiles (cyan)."
        checked={media.layerBorders}
        onChange={(v) => changeMedia('layerBorders', v)}
      />
      <CheckboxRow
        label="Frame Rendering Stats"
        description="Plots frame throughput, dropped frames distribution, and GPU memory."
        checked={media.frameRenderingStats}
        onChange={(v) => changeMedia('frameRenderingStats', v)}
      />
      <CheckboxRow
        label="Scrolling performance issues"
        description="Highlights elements (teal) that can slow down scrolling."
        checked={media.scrollingPerf}
        onChange={(v) => changeMedia('scrollingPerf', v)}
      />
      <CheckboxRow
        label="Highlight ads"
        description="Highlights elements (red) detected to be ads."
        checked={media.highlightAds}
        onChange={(v) => changeMedia('highlightAds', v)}
      />
      <CheckboxRow
        label="Disable local fonts"
        description="Disables local() sources in @font-face rules. Requires a page reload."
        checked={media.disableLocalFonts}
        onChange={(v) => changeMedia('disableLocalFonts', v)}
      />
      <CheckboxRow
        label="Emulate a focused page"
        description="Keep page focused. Commonly used for debugging disappearing elements."
        checked={media.focusedPage}
        onChange={(v) => changeMedia('focusedPage', v)}
      />
      <CheckboxRow
        label="Enable automatic dark mode"
        description="Enables automatic dark mode and sets prefers-color-scheme to dark."
        checked={media.autoDarkMode}
        onChange={(v) => changeMedia('autoDarkMode', v)}
      />

      {/* CSS media feature emulation */}
      <SegmentedRow label="Prefers-color-scheme">
        <SegmentedControl
          ariaLabel="Prefers-color-scheme"
          options={COLOR_SCHEME_OPTIONS}
          value={theme}
          onChange={changeTheme}
        />
      </SegmentedRow>
      <SegmentedRow label="Prefers-reduced-motion">
        <SegmentedControl
          ariaLabel="Prefers-reduced-motion"
          options={REDUCED_OPTIONS}
          value={media.reducedMotion}
          onChange={(value) => changeMedia('reducedMotion', value)}
        />
      </SegmentedRow>
      <SegmentedRow label="Prefers-reduced-data">
        <SegmentedControl
          ariaLabel="Prefers-reduced-data"
          options={REDUCED_OPTIONS}
          value={media.reducedData}
          onChange={(value) => changeMedia('reducedData', value)}
        />
      </SegmentedRow>
      <SegmentedRow label="Prefers-reduced-transparency">
        <SegmentedControl
          ariaLabel="Prefers-reduced-transparency"
          options={REDUCED_OPTIONS}
          value={media.reducedTransparency}
          onChange={(value) => changeMedia('reducedTransparency', value)}
        />
      </SegmentedRow>
      <SegmentedRow label="Forced-colors">
        <SegmentedControl
          ariaLabel="Forced-colors"
          options={FORCED_COLORS_OPTIONS}
          value={media.forcedColors}
          onChange={(value) => changeMedia('forcedColors', value)}
        />
      </SegmentedRow>
      <SegmentedRow label="Prefers-contrast">
        <SegmentedControl
          ariaLabel="Prefers-contrast"
          options={CONTRAST_OPTIONS}
          value={media.contrast}
          onChange={(value) => changeMedia('contrast', value)}
        />
      </SegmentedRow>
      <SegmentedRow label="Color-gamut">
        <SegmentedControl
          ariaLabel="Color-gamut"
          options={COLOR_GAMUT_OPTIONS}
          value={media.colorGamut}
          onChange={(value) => changeMedia('colorGamut', value)}
        />
      </SegmentedRow>
      <SegmentedRow label="Media type">
        <SegmentedControl
          ariaLabel="Media type"
          options={MEDIA_TYPE_OPTIONS}
          value={media.mediaType}
          onChange={(value) => changeMedia('mediaType', value)}
        />
      </SegmentedRow>

      {/* Vision / accessibility emulation */}
      <SelectRow
        label="Emulate vision deficiencies"
        description="Forces vision deficiency emulation."
        value={media.visionDeficiency}
        options={VISION_DEFICIENCY_OPTIONS}
        onChange={(v) => changeMedia('visionDeficiency', v as VisionDeficiency)}
      />
      <SelectRow
        label="Emulate OS text scale"
        description="Forces OS text scale emulation."
        value={String(media.osTextScale)}
        options={OS_TEXT_SCALE_OPTIONS}
        onChange={(v) => changeMedia('osTextScale', Number(v))}
      />

      {/* Image format disabling */}
      <CheckboxRow
        label="Disable AVIF image format"
        description="Requires a page reload to apply and disables caching for image requests."
        checked={media.disableAvif}
        onChange={(v) => changeMedia('disableAvif', v)}
      />
      <CheckboxRow
        label="Disable WebP image format"
        description="Requires a page reload to apply and disables caching for image requests."
        checked={media.disableWebp}
        onChange={(v) => changeMedia('disableWebp', v)}
      />
    </div>
  )
}
