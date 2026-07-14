import { describe, expect, it } from 'vitest'
import {
  contentSignalsRule,
  documentLanguageRule,
  headingHierarchyRule,
  pageLandmarksRule,
  primaryHeadingRule,
  type RuleContext
} from '../../src/main/seo/rules'
import type { DocumentStructureEvidence } from '../../src/shared/seo-audit'

function context(overrides: Partial<DocumentStructureEvidence> = {}): RuleContext {
  return {
    documentStructure: {
      language: { lang: 'en', xmlLang: null },
      headings: [{ level: 1, text: 'Page', accessibleName: 'Page', visible: true, sourceIndex: 0 }],
      landmarks: [
        { role: 'main', accessibleName: '', visible: true, textCharacters: 500, sourceIndex: 0 }
      ],
      visibleTextCharacters: 500,
      repeatedText: [],
      ...overrides
    }
  } as RuleContext
}

describe('document structure rules', () => {
  it('reports missing, conflicting, malformed, and valid document language', () => {
    expect(
      documentLanguageRule.evaluate(context({ language: { lang: null, xmlLang: null } })).outcome
    ).toBe('warning')
    expect(
      documentLanguageRule.evaluate(context({ language: { lang: 'en', xmlLang: 'pt' } })).outcome
    ).toBe('error')
    expect(
      documentLanguageRule.evaluate(context({ language: { lang: 'not_a_locale', xmlLang: null } }))
        .outcome
    ).toBe('warning')
    expect(documentLanguageRule.evaluate(context()).outcome).toBe('passed')
  })

  it('excludes hidden responsive headings when resolving the primary heading', () => {
    const ctx = context({
      headings: [
        { level: 1, text: 'Desktop', accessibleName: 'Desktop', visible: false, sourceIndex: 0 },
        { level: 1, text: 'Mobile', accessibleName: 'Mobile', visible: true, sourceIndex: 1 }
      ]
    })
    expect(primaryHeadingRule.evaluate(ctx)).toMatchObject({ outcome: 'passed' })
    expect(primaryHeadingRule.evaluate(ctx).evidence.detail).toContain('1 hidden')
  })

  it('distinguishes malformed, missing, and multiple primary headings', () => {
    expect(primaryHeadingRule.evaluate(context({ headings: [] })).outcome).toBe('warning')
    expect(
      primaryHeadingRule.evaluate(
        context({
          headings: [{ level: 1, text: '', accessibleName: '', visible: true, sourceIndex: 0 }]
        })
      ).outcome
    ).toBe('error')
    expect(
      primaryHeadingRule.evaluate(
        context({
          headings: [
            { level: 1, text: 'One', accessibleName: 'One', visible: true, sourceIndex: 0 },
            { level: 1, text: 'Two', accessibleName: 'Two', visible: true, sourceIndex: 1 }
          ]
        })
      ).outcome
    ).toBe('opportunity')
  })

  it('reports skipped levels across a rendered heading tree', () => {
    const result = headingHierarchyRule.evaluate(
      context({
        headings: [
          { level: 1, text: 'One', accessibleName: 'One', visible: true, sourceIndex: 0 },
          { level: 3, text: 'Three', accessibleName: 'Three', visible: true, sourceIndex: 1 }
        ]
      })
    )
    expect(result).toMatchObject({ outcome: 'warning' })
    expect(result.evidence.detail).toContain('h1 → h3')
  })

  it('reports absent, repeated, and empty main landmarks', () => {
    expect(pageLandmarksRule.evaluate(context({ landmarks: [] })).outcome).toBe('opportunity')
    expect(
      pageLandmarksRule.evaluate(
        context({
          landmarks: [
            {
              role: 'main',
              accessibleName: 'One',
              visible: true,
              textCharacters: 20,
              sourceIndex: 0
            },
            {
              role: 'main',
              accessibleName: 'Two',
              visible: true,
              textCharacters: 20,
              sourceIndex: 1
            }
          ]
        })
      ).outcome
    ).toBe('warning')
    expect(
      pageLandmarksRule.evaluate(
        context({
          landmarks: [
            { role: 'main', accessibleName: '', visible: true, textCharacters: 0, sourceIndex: 0 }
          ]
        })
      ).outcome
    ).toBe('warning')
  })

  it('keeps legitimate short pages and repetition advisory', () => {
    expect(contentSignalsRule.evaluate(context({ visibleTextCharacters: 30 })).outcome).toBe(
      'opportunity'
    )
    const repeated = contentSignalsRule.evaluate(
      context({ repeatedText: [{ text: 'A repeated descriptive passage', count: 2 }] })
    )
    expect(repeated.outcome).toBe('opportunity')
    expect(repeated.summary).not.toMatch(/keyword|quality/i)
  })
})
