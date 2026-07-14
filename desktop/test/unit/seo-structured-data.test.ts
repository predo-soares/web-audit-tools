import { describe, expect, it } from 'vitest'
import { analyzeStructuredData } from '../../src/main/seo/structured-data'
import {
  searchEnhancementEligibilityRule,
  structuredDataRelationshipsRule,
  structuredDataStandardsRule,
  type RuleContext
} from '../../src/main/seo/rules'
import type { RawStructuredSource } from '../../src/shared/seo-audit'

function source(
  format: RawStructuredSource['format'],
  raw: unknown,
  sourceIndex = 0
): RawStructuredSource {
  return { format, sourceIndex, raw: typeof raw === 'string' ? raw : JSON.stringify(raw) }
}

function context(structuredData: ReturnType<typeof analyzeStructuredData>): RuleContext {
  return { structuredData } as RuleContext
}

describe('structured data analysis', () => {
  it('reports malformed JSON-LD and invalid value shapes', () => {
    const malformed = analyzeStructuredData([source('json-ld', '{"@type":')])
    expect(malformed.problems[0].message).toContain('Invalid json-ld syntax')
    expect(structuredDataStandardsRule.evaluate(context(malformed)).outcome).toBe('error')

    const shapes = analyzeStructuredData([
      source('json-ld', { '@context': 42, '@type': 42, '@id': '' })
    ])
    expect(shapes.problems.map((problem) => problem.path)).toEqual(
      expect.arrayContaining(['$.@context', '$.@type', '$.@id'])
    )
  })

  it('preserves graphs, nested entities, schema types, and custom vocabulary', () => {
    const result = analyzeStructuredData([
      source('json-ld', {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Product', name: 'Desk', brand: { '@type': 'Organization', name: 'Acme' } },
          { '@type': 'https://example.test/vocab/CustomThing', custom: true }
        ]
      })
    ])
    expect(result.entities.flatMap((entity) => entity.types)).toEqual(
      expect.arrayContaining(['Product', 'Organization', 'https://example.test/vocab/CustomThing'])
    )
    expect(result.problems).toHaveLength(0)
    expect(result.enhancements.find((item) => item.type.includes('CustomThing'))?.status).toBe(
      'not-supported'
    )
  })

  it('normalizes extracted Microdata and RDFa sources as inspectable entities', () => {
    const result = analyzeStructuredData([
      source('microdata', { '@type': 'Product', properties: { name: ['Desk'] } }),
      source('rdfa', { '@type': 'Article', properties: { headline: ['News'] } }, 1)
    ])
    expect(result.entities.map((entity) => entity.format)).toEqual(['microdata', 'rdfa'])
    expect(result.enhancements.map((item) => item.status)).toEqual(['eligible', 'eligible'])
  })

  it('distinguishes required and recommended enhancement fields', () => {
    const result = analyzeStructuredData([
      source('json-ld', [{ '@type': 'Product', name: 'Desk' }, { '@type': 'Article' }])
    ])
    expect(result.enhancements[0]).toMatchObject({
      status: 'eligible',
      missingRecommended: ['image', 'description', 'offers']
    })
    expect(result.enhancements[1]).toMatchObject({
      status: 'ineligible',
      missingRequired: ['headline']
    })
    expect(searchEnhancementEligibilityRule.evaluate(context(result)).outcome).toBe('warning')
  })

  it('reports conflicting entities and broken references', () => {
    const result = analyzeStructuredData([
      source('json-ld', {
        '@graph': [
          { '@id': '#thing', '@type': 'Product', name: 'One', brand: { '@id': '#missing' } },
          { '@id': '#thing', '@type': 'Product', name: 'Two' }
        ]
      })
    ])
    expect(result.problems.map((problem) => problem.message).join(' ')).toMatch(
      /Conflicting.*Reference/
    )
    expect(structuredDataRelationshipsRule.evaluate(context(result)).outcome).toBe('warning')
  })
})
