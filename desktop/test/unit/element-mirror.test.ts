import { describe, expect, it } from 'vitest'
import { createElementMirror, type ElementDescriptor } from '../../src/shared/element-mirror'

const {
  buildElementFingerprint,
  buildElementFingerprintInContext,
  classifyMirrorFailure,
  isMachineGeneratedId,
  resolveElementFingerprint
} = createElementMirror()

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

  // --- testid layer ---

  it('builds and resolves by data-testid layer', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      testId: 'submit-btn',
      visibleText: 'Submit'
    })

    expect(fingerprint?.layers).toContainEqual({ type: 'testid', testId: 'submit-btn' })

    const candidates: ElementDescriptor[] = [
      { tagName: 'button', testId: 'cancel-btn', visibleText: 'Cancel' },
      { tagName: 'button', testId: 'submit-btn', visibleText: 'Submit' }
    ]
    expect(resolveElementFingerprint(fingerprint!, candidates)).toEqual({
      index: 1,
      layer: { type: 'testid', testId: 'submit-btn' }
    })
  })

  it('testid layer resolves even when text differs across panes', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      testId: 'nav-toggle',
      visibleText: '☰'
    })

    const candidates: ElementDescriptor[] = [
      { tagName: 'button', testId: 'nav-toggle', visibleText: 'Menu' }
    ]
    expect(resolveElementFingerprint(fingerprint!, candidates)).toEqual({
      index: 0,
      layer: { type: 'testid', testId: 'nav-toggle' }
    })
  })

  // --- accessible-name layer ---

  it('builds and resolves by accessible-name layer using aria-label', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      ariaLabel: 'Open menu',
      role: 'button'
    })

    expect(fingerprint?.layers).toContainEqual({
      type: 'accessible-name',
      tagName: 'button',
      role: 'button',
      name: 'Open menu'
    })

    const candidates: ElementDescriptor[] = [
      { tagName: 'button', ariaLabel: 'Close menu', role: 'button' },
      { tagName: 'button', ariaLabel: 'Open menu', role: 'button' }
    ]
    expect(resolveElementFingerprint(fingerprint!, candidates)).toEqual({
      index: 1,
      layer: { type: 'accessible-name', tagName: 'button', role: 'button', name: 'Open menu' }
    })
  })

  it('accessible-name layer uses tagName as role when role is absent', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      ariaLabel: 'Search'
    })

    expect(fingerprint?.layers).toContainEqual({
      type: 'accessible-name',
      tagName: 'button',
      role: 'button',
      name: 'Search'
    })

    const candidates: ElementDescriptor[] = [
      { tagName: 'button', ariaLabel: 'Search' } // no explicit role
    ]
    expect(resolveElementFingerprint(fingerprint!, candidates)).toEqual({
      index: 0,
      layer: { type: 'accessible-name', tagName: 'button', role: 'button', name: 'Search' }
    })
  })

  it('normalizes whitespace in aria-label when building accessible-name layer', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      ariaLabel: '  Open   menu  '
    })

    expect(fingerprint?.layers).toContainEqual({
      type: 'accessible-name',
      tagName: 'button',
      role: 'button',
      name: 'Open menu'
    })
  })

  // --- structural-path layer ---

  it('builds and resolves by structural-path as last resort', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      structuralPath: 'div:nth-child(1) > ul > li:nth-child(3) > button:nth-child(1)'
    })

    expect(fingerprint?.layers).toContainEqual({
      type: 'structural-path',
      path: 'div:nth-child(1) > ul > li:nth-child(3) > button:nth-child(1)'
    })

    const candidates: ElementDescriptor[] = [
      {
        tagName: 'button',
        structuralPath: 'div:nth-child(1) > ul > li:nth-child(1) > button:nth-child(1)'
      },
      {
        tagName: 'button',
        structuralPath: 'div:nth-child(1) > ul > li:nth-child(3) > button:nth-child(1)'
      }
    ]
    expect(resolveElementFingerprint(fingerprint!, candidates)).toEqual({
      index: 1,
      layer: {
        type: 'structural-path',
        path: 'div:nth-child(1) > ul > li:nth-child(3) > button:nth-child(1)'
      }
    })
  })

  it('includes structural-path as the last layer even when higher-priority layers exist', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      visibleText: 'Add to cart',
      structuralPath: 'div:nth-child(2) > button:nth-child(1)'
    })

    expect(fingerprint?.layers).toEqual([
      { type: 'text-tag', tagName: 'button', text: 'Add to cart' },
      { type: 'structural-path', path: 'div:nth-child(2) > button:nth-child(1)' }
    ])
  })

  it('falls through an ambiguous text-tag layer and resolves by structural-path', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      visibleText: 'Add to cart',
      structuralPath: 'div:nth-child(2) > button:nth-child(1)'
    })

    const candidates: ElementDescriptor[] = [
      {
        tagName: 'button',
        visibleText: 'Add to cart',
        structuralPath: 'div:nth-child(1) > button:nth-child(1)'
      },
      {
        tagName: 'button',
        visibleText: 'Add to cart',
        structuralPath: 'div:nth-child(2) > button:nth-child(1)'
      }
    ]

    expect(resolveElementFingerprint(fingerprint!, candidates)).toEqual({
      index: 1,
      layer: {
        type: 'structural-path',
        path: 'div:nth-child(2) > button:nth-child(1)'
      }
    })
  })

  // --- layer ordering ---

  it('layer order is: id > testid > accessible-name > text-tag > structural-path', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      id: 'my-btn',
      testId: 'btn-test',
      ariaLabel: 'My button',
      role: 'button',
      visibleText: 'Click me',
      structuralPath: 'div > button:nth-child(1)'
    })

    expect(fingerprint?.layers.map((l) => l.type)).toEqual([
      'id',
      'testid',
      'accessible-name',
      'text-tag',
      'structural-path'
    ])
  })

  it('machine-generated id is skipped and falls through to testid layer', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      id: 'button-123456', // machine-generated
      testId: 'my-action-btn',
      visibleText: 'Click'
    })

    expect(fingerprint?.layers[0].type).toBe('testid')
  })

  it('machine-generated id is skipped and falls through to accessible-name layer', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      id: ':r0:', // machine-generated (React colon pattern)
      ariaLabel: 'Open dialog',
      visibleText: 'Open'
    })

    expect(fingerprint?.layers[0].type).toBe('accessible-name')
  })

  it('machine-generated id is skipped and falls through to text-tag layer', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      id: 'abc123def456', // machine-generated (long alphanumeric)
      visibleText: 'Save'
    })

    expect(fingerprint?.layers[0].type).toBe('text-tag')
  })

  // --- index-among-matches ---

  it('clicking Nth duplicate button captures indexAmongMatches', () => {
    const candidates: ElementDescriptor[] = [
      { tagName: 'button', visibleText: 'Add to cart', structuralPath: 'div > button:nth-child(1)' },
      { tagName: 'button', visibleText: 'Add to cart', structuralPath: 'div > button:nth-child(2)' },
      { tagName: 'button', visibleText: 'Add to cart', structuralPath: 'div > button:nth-child(3)' }
    ]

    // Click the 2nd button (index 1)
    const fingerprint = buildElementFingerprintInContext(candidates[1], candidates)

    expect(fingerprint).not.toBeNull()
    expect(fingerprint!.indexAmongMatches).toBe(1)
  })

  it('resolves Nth duplicate button using indexAmongMatches', () => {
    const sourceCandidates: ElementDescriptor[] = [
      { tagName: 'button', visibleText: 'Add to cart', structuralPath: 'div > button:nth-child(1)' },
      { tagName: 'button', visibleText: 'Add to cart', structuralPath: 'div > button:nth-child(2)' },
      { tagName: 'button', visibleText: 'Add to cart', structuralPath: 'div > button:nth-child(3)' }
    ]

    const fingerprint = buildElementFingerprintInContext(sourceCandidates[1], sourceCandidates)
    expect(fingerprint!.indexAmongMatches).toBe(1)

    // Target pane has the same buttons
    const targetCandidates: ElementDescriptor[] = [
      { tagName: 'button', visibleText: 'Add to cart', structuralPath: 'div > button:nth-child(1)' },
      { tagName: 'button', visibleText: 'Add to cart', structuralPath: 'div > button:nth-child(2)' },
      { tagName: 'button', visibleText: 'Add to cart', structuralPath: 'div > button:nth-child(3)' }
    ]

    const resolved = resolveElementFingerprint(fingerprint!, targetCandidates)
    expect(resolved).not.toBeNull()
    expect(resolved!.index).toBe(1)
  })

  it('resolves 0th and 2nd duplicate buttons correctly', () => {
    const candidates: ElementDescriptor[] = [
      { tagName: 'button', visibleText: 'Add to cart', structuralPath: 'div > button:nth-child(1)' },
      { tagName: 'button', visibleText: 'Add to cart', structuralPath: 'div > button:nth-child(2)' },
      { tagName: 'button', visibleText: 'Add to cart', structuralPath: 'div > button:nth-child(3)' }
    ]

    const fp0 = buildElementFingerprintInContext(candidates[0], candidates)
    const fp2 = buildElementFingerprintInContext(candidates[2], candidates)

    expect(fp0!.indexAmongMatches).toBe(0)
    expect(fp2!.indexAmongMatches).toBe(2)

    expect(resolveElementFingerprint(fp0!, candidates)!.index).toBe(0)
    expect(resolveElementFingerprint(fp2!, candidates)!.index).toBe(2)
  })

  it('captures and resolves indexAmongMatches for duplicate text inputs by shared name', () => {
    const sourceCandidates: ElementDescriptor[] = [
      {
        tagName: 'input',
        testId: 'shared-text',
        structuralPath: 'section > div:nth-child(1) > input:nth-child(1)'
      },
      {
        tagName: 'input',
        testId: 'shared-text',
        structuralPath: 'section > div:nth-child(2) > input:nth-child(1)'
      }
    ]

    const fingerprint = buildElementFingerprintInContext(sourceCandidates[1], sourceCandidates)

    expect(fingerprint).toEqual({
      layers: [
        { type: 'testid', testId: 'shared-text' },
        { type: 'structural-path', path: 'section > div:nth-child(2) > input:nth-child(1)' }
      ],
      indexAmongMatches: 1
    })

    const targetCandidates: ElementDescriptor[] = [
      {
        tagName: 'input',
        testId: 'shared-text',
        structuralPath: 'section > div:nth-child(1) > div:nth-child(1) > input:nth-child(2)'
      },
      {
        tagName: 'input',
        testId: 'shared-text',
        structuralPath: 'section > div:nth-child(2) > div:nth-child(1) > input:nth-child(2)'
      }
    ]

    expect(resolveElementFingerprint(fingerprint!, targetCandidates)).toEqual({
      index: 1,
      layer: { type: 'testid', testId: 'shared-text' }
    })
  })

  it('captures and resolves indexAmongMatches for duplicate selects by shared name', () => {
    const sourceCandidates: ElementDescriptor[] = [
      {
        tagName: 'select',
        testId: 'shared-select',
        structuralPath: 'section > div:nth-child(1) > select:nth-child(1)'
      },
      {
        tagName: 'select',
        testId: 'shared-select',
        structuralPath: 'section > div:nth-child(2) > select:nth-child(1)'
      }
    ]

    const fingerprint = buildElementFingerprintInContext(sourceCandidates[1], sourceCandidates)
    expect(fingerprint!.indexAmongMatches).toBe(1)

    const targetCandidates: ElementDescriptor[] = [
      {
        tagName: 'select',
        testId: 'shared-select',
        structuralPath: 'section > div:nth-child(1) > div:nth-child(1) > select:nth-child(2)'
      },
      {
        tagName: 'select',
        testId: 'shared-select',
        structuralPath: 'section > div:nth-child(2) > div:nth-child(1) > select:nth-child(2)'
      }
    ]

    expect(resolveElementFingerprint(fingerprint!, targetCandidates)).toEqual({
      index: 1,
      layer: { type: 'testid', testId: 'shared-select' }
    })
  })

  it('builds and resolves forms by name before structural-path fallback', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'form',
      testId: 'site-search',
      structuralPath: 'form:nth-child(1)'
    })

    expect(fingerprint?.layers).toContainEqual({ type: 'testid', testId: 'site-search' })

    const targetCandidates: ElementDescriptor[] = [
      {
        tagName: 'form',
        testId: 'site-search',
        structuralPath: 'section > div:nth-child(1) > form:nth-child(1)'
      }
    ]

    expect(resolveElementFingerprint(fingerprint!, targetCandidates)).toEqual({
      index: 0,
      layer: { type: 'testid', testId: 'site-search' }
    })
  })

  it('captures and resolves indexAmongMatches for duplicate forms before structural-path fallback', () => {
    const sourceCandidates: ElementDescriptor[] = [
      {
        tagName: 'form',
        visibleText: 'Save draft',
        structuralPath: 'section > form:nth-child(1)'
      },
      {
        tagName: 'form',
        visibleText: 'Save draft',
        structuralPath: 'section > form:nth-child(2)'
      }
    ]

    const fingerprint = buildElementFingerprintInContext(sourceCandidates[1], sourceCandidates)
    expect(fingerprint!.indexAmongMatches).toBe(1)

    const targetCandidates: ElementDescriptor[] = [
      {
        tagName: 'form',
        visibleText: 'Save draft',
        structuralPath: 'section > div:nth-child(1) > form:nth-child(1)'
      },
      {
        tagName: 'form',
        visibleText: 'Save draft',
        structuralPath: 'section > div:nth-child(2) > form:nth-child(1)'
      }
    ]

    expect(resolveElementFingerprint(fingerprint!, targetCandidates)).toEqual({
      index: 1,
      layer: { type: 'text-tag', tagName: 'form', text: 'Save draft' }
    })
  })

  it('unique element needs no indexAmongMatches', () => {
    const candidates: ElementDescriptor[] = [
      { tagName: 'button', visibleText: 'Add to cart' },
      { tagName: 'button', visibleText: 'Remove from cart' },
      { tagName: 'button', visibleText: 'Checkout' }
    ]

    const fingerprint = buildElementFingerprintInContext(candidates[1], candidates)
    expect(fingerprint!.indexAmongMatches).toBeUndefined()
  })

  it('ambiguous: multiple matches and no indexAmongMatches → returns null', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      visibleText: 'Add to cart'
    })
    // No indexAmongMatches set
    expect(fingerprint!.indexAmongMatches).toBeUndefined()

    const candidates: ElementDescriptor[] = [
      { tagName: 'button', visibleText: 'Add to cart' },
      { tagName: 'button', visibleText: 'Add to cart' }
    ]
    expect(resolveElementFingerprint(fingerprint!, candidates)).toBeNull()
    expect(classifyMirrorFailure(fingerprint!, candidates)).toBe('ambiguous')
  })

  it('not-found: no layer matches any candidate → returns null', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      id: 'hamburger-btn',
      visibleText: '☰'
    })

    // Desktop pane has no hamburger button
    const candidates: ElementDescriptor[] = [
      { tagName: 'a', visibleText: 'Home' },
      { tagName: 'a', visibleText: 'About' }
    ]
    expect(resolveElementFingerprint(fingerprint!, candidates)).toBeNull()
    expect(classifyMirrorFailure(fingerprint!, candidates)).toBe('not-found')
  })

  it('classifies duplicate matches with indexAmongMatches as not-found instead of ambiguous', () => {
    const fingerprint = buildElementFingerprint({
      tagName: 'button',
      visibleText: 'Add to cart'
    })
    fingerprint!.indexAmongMatches = 1

    const candidates: ElementDescriptor[] = [
      { tagName: 'button', visibleText: 'Add to cart' },
      { tagName: 'button', visibleText: 'Add to cart' }
    ]

    expect(resolveElementFingerprint(fingerprint!, candidates)).toEqual({
      index: 1,
      layer: { type: 'text-tag', tagName: 'button', text: 'Add to cart' }
    })
    expect(classifyMirrorFailure(fingerprint!, candidates)).toBe('not-found')
  })

  // --- buildElementFingerprint returns null when no layers ---

  it('returns null for an element with no identifying information', () => {
    const fingerprint = buildElementFingerprint({ tagName: 'button' })
    expect(fingerprint).toBeNull()
  })

  // --- buildElementFingerprintInContext uses structural path for truly duplicate elements ---

  it('keeps using indexAmongMatches before structural-path when a higher layer is already disambiguated', () => {
    const candidates: ElementDescriptor[] = [
      {
        tagName: 'button',
        visibleText: 'Add to cart',
        structuralPath: 'div:nth-child(1) > button:nth-child(1)'
      },
      {
        tagName: 'button',
        visibleText: 'Add to cart',
        structuralPath: 'div:nth-child(2) > button:nth-child(1)'
      }
    ]

    // structural-path is unique per element, so after text-tag hits 2 matches,
    // structural-path would uniquely match — but indexAmongMatches is still set
    // on the text-tag layer match since it's the first multi-match layer found
    const fp = buildElementFingerprintInContext(candidates[0], candidates)
    expect(fp!.indexAmongMatches).toBe(0)

    const resolved = resolveElementFingerprint(fp!, candidates)
    expect(resolved).toEqual({
      index: 0,
      layer: { type: 'text-tag', tagName: 'button', text: 'Add to cart' }
    })
  })

  it('does not resolve a missing identified control by structural path alone', () => {
    const fingerprint: ElementFingerprint = {
      layers: [
        { type: 'id', id: 'country-select' },
        { type: 'testid', testId: 'country' },
        { type: 'text-tag', tagName: 'select', text: 'Brazil United States Japan' },
        { type: 'structural-path', path: 'form:nth-child(1) > select:nth-child(4)' }
      ]
    }
    const candidates: ElementDescriptor[] = [
      {
        tagName: 'select',
        id: 'index-fallback-select',
        testId: 'city',
        visibleText: 'Rio New York Tokyo',
        structuralPath: 'form:nth-child(1) > select:nth-child(4)'
      }
    ]

    expect(resolveElementFingerprint(fingerprint, candidates)).toBeNull()
    expect(classifyMirrorFailure(fingerprint, candidates)).toBe('not-found')
  })
})
