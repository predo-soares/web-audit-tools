import { describe, expect, it } from 'vitest'
import {
  buildInspectionTarget,
  buildInspectionLayers,
  createInspectionRecord,
  formatInspectionContext,
  getInspectionDifferences,
  matchesInspectionLayer,
  resolveInspectionTarget,
  type InspectionElementDescriptor,
  type InspectionPageSnapshot
} from '../../src/shared/inspection'
import { DEVICE_PRESETS } from '../../src/shared/device-presets'

function descriptor(
  overrides: Partial<InspectionElementDescriptor> = {}
): InspectionElementDescriptor {
  return {
    tagName: 'div',
    id: null,
    testId: null,
    accessibleName: null,
    role: null,
    visibleText: 'Card',
    structuralPath: 'main > div:nth-child(1)',
    ...overrides
  }
}

describe('inspection identity', () => {
  it('keeps inspection layers separate and ordered from stable to structural', () => {
    expect(buildInspectionLayers(descriptor({ id: 'hero-card', testId: 'hero' }))).toEqual([
      { type: 'id', value: 'hero-card' },
      { type: 'test-id', value: 'hero' },
      { type: 'visible-text', tagName: 'div', value: 'Card' },
      { type: 'structural-path', value: 'main > div:nth-child(1)' }
    ])
  })

  it('uses an index to disambiguate duplicate semantic candidates', () => {
    const first = descriptor({ id: null, structuralPath: 'main > div:nth-child(1)' })
    const second = descriptor({ id: null, structuralPath: 'main > div:nth-child(2)' })
    const target = buildInspectionTarget(second, [first, second], 1)

    expect(target.indexAmongMatches).toBe(1)
    expect(resolveInspectionTarget(target, [first, second])).toMatchObject({
      status: 'matched',
      index: 1,
      layer: { type: 'visible-text', value: 'Card' }
    })
  })

  it('reports ambiguity instead of choosing a nearby element', () => {
    const source = descriptor({ id: null, structuralPath: 'main > div:nth-child(8)' })
    const candidates = [
      descriptor({ structuralPath: 'main > div:nth-child(1)' }),
      descriptor({ structuralPath: 'main > div:nth-child(2)' })
    ]
    const target = buildInspectionTarget(source)

    expect(resolveInspectionTarget(target, candidates)).toMatchObject({
      status: 'ambiguous',
      index: null
    })
  })

  it('uses structural path only when no semantic signal exists', () => {
    const source = descriptor({
      visibleText: null,
      structuralPath: 'main > section:nth-child(2)'
    })
    const matching = descriptor({
      visibleText: null,
      structuralPath: 'main > section:nth-child(2)'
    })
    const target = buildInspectionTarget(source)

    expect(resolveInspectionTarget(target, [matching])).toMatchObject({
      status: 'matched',
      index: 0,
      layer: { type: 'structural-path' }
    })
  })

  it('matches responsive markup through a stable id even when text changes', () => {
    const source = descriptor({
      tagName: 'div',
      id: 'layout',
      visibleText: 'desktop markup',
      structuralPath: 'main > div:nth-child(1)'
    })
    const mobile = descriptor({
      tagName: 'section',
      id: 'layout',
      visibleText: 'mobile markup',
      structuralPath: 'main > section:nth-child(2)'
    })
    const target = buildInspectionTarget(source)

    expect(resolveInspectionTarget(target, [mobile])).toMatchObject({
      status: 'matched',
      index: 0,
      layer: { type: 'id' }
    })
  })

  it('reports a strict not-found result when every semantic signal is absent', () => {
    const target = buildInspectionTarget(
      descriptor({
        id: 'source-only',
        visibleText: null,
        structuralPath: 'main > div:nth-child(3)'
      })
    )
    expect(
      resolveInspectionTarget(target, [descriptor({ id: 'other', visibleText: 'Other' })])
    ).toEqual({
      status: 'not-found',
      index: null,
      layer: null,
      provenance: null
    })
  })

  it('does not accept coordinate data as an identity signal', () => {
    const layer = { type: 'id' as const, value: 'stable' }
    expect(matchesInspectionLayer(layer, descriptor({ id: 'stable' }))).toBe(true)
    expect('x' in descriptor()).toBe(false)
  })

  it('projects geometry and style differences in stable order', () => {
    const target = buildInspectionTarget(descriptor({ id: 'layout' }))
    const snapshot = (overrides: Partial<InspectionPageSnapshot> = {}): InspectionPageSnapshot => ({
      target,
      selector: '#layout',
      domPath: 'main > div:nth-child(1)',
      geometry: { x: 0, y: 0, width: 200, height: 80 },
      visibility: { visible: true, clipped: false, offscreen: false },
      layout: {
        display: 'block',
        position: 'static',
        width: '200px',
        height: '80px',
        overflow: 'visible',
        flex: null,
        grid: null
      },
      styles: {
        margin: '0px',
        padding: '8px',
        color: 'white',
        background: 'black',
        font: '16px system-ui',
        fontSize: '16px',
        lineHeight: '24px',
        fontWeight: '400',
        zIndex: 'auto',
        minWidth: '0px',
        maxWidth: 'none',
        minHeight: '0px',
        maxHeight: 'none'
      },
      url: 'https://fixture.test/',
      capturedAt: 1,
      ...overrides
    })
    const source = createInspectionRecord({
      paneId: 'desktop',
      source: true,
      target,
      profile: DEVICE_PRESETS.desktop,
      url: 'https://fixture.test/',
      snapshot: snapshot()
    })
    const targetRecord = createInspectionRecord({
      paneId: 'iphone',
      source: false,
      target,
      profile: DEVICE_PRESETS.iphone,
      url: 'https://fixture.test/',
      snapshot: snapshot({
        geometry: { x: 8, y: 0, width: 160, height: 80 },
        styles: { ...snapshot().styles, color: 'yellow' }
      }),
      status: 'matched'
    })

    const differences = getInspectionDifferences([source, targetRecord])
    expect(differences.slice(0, 2).map((difference) => difference.key)).toEqual(['x', 'width'])
    expect(differences.at(-1)).toMatchObject({ category: 'styles', key: 'color' })

    const unavailable = createInspectionRecord({
      paneId: 'ipad',
      source: false,
      target,
      profile: DEVICE_PRESETS.ipad,
      url: 'https://fixture.test/',
      status: 'unavailable',
      error: 'pane loading'
    })
    const state = { active: true, record: source, records: [source, targetRecord, unavailable] }
    const context = formatInspectionContext(state)
    expect(formatInspectionContext(state)).toBe(context)
    expect(context).toContain('status: Unavailable')
    expect(context).toContain('evidence: none (Unavailable)')
    expect(context).toContain('observed page evidence; this is not a guaranteed diagnosis')
    expect(context).toContain('width=200px')
  })
})
