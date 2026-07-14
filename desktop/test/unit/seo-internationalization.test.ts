import { describe, expect, it } from 'vitest'
import { verifyInternationalization } from '../../src/main/seo/internationalization'
import {
  hreflangReciprocalRule,
  hreflangRelationshipsRule,
  hreflangSyntaxRule,
  type RuleContext
} from '../../src/main/seo/rules'
import type {
  DeliveredEvidence,
  InternationalizationResult,
  RenderedAuditSnapshot
} from '../../src/shared/seo-audit'

function context(internationalization: InternationalizationResult): RuleContext {
  return {
    internationalization,
    documentStructure: { language: { lang: 'en', xmlLang: null } },
    searchAppearance: { resolved: { canonical: { value: 'https://site.test/en' } } }
  } as RuleContext
}

describe('international targeting', () => {
  it('checks only direct relative and absolute targets and follows bounded redirects', async () => {
    const rendered: RenderedAuditSnapshot = {
      title: 'English',
      hreflang: [
        { hreflang: 'en', href: '/en', resolvedHref: 'https://site.test/en', sourceIndex: 0 },
        {
          hreflang: 'pt-BR',
          href: 'https://site.test/pt',
          resolvedHref: 'https://site.test/pt',
          sourceIndex: 1
        },
        { hreflang: 'x-default', href: '/en', resolvedHref: 'https://site.test/en', sourceIndex: 2 }
      ]
    }
    const calls: string[] = []
    const result = await verifyInternationalization(
      'https://site.test/en',
      rendered,
      async (url) => {
        calls.push(url)
        if (url.endsWith('/pt'))
          return {
            status: 302,
            headers: [],
            location: '/pt-final',
            readBody: async () => ({ text: '', truncated: false })
          }
        return {
          status: 200,
          headers: [],
          location: null,
          readBody: async () => ({
            text: `<html lang="${url.includes('pt') ? 'pt-BR' : 'en'}"><link rel="alternate" hreflang="en" href="/en"><link rel="canonical" href="${url}">`,
            truncated: false
          })
        }
      }
    )
    expect(calls).toEqual([
      'https://site.test/en',
      'https://site.test/pt',
      'https://site.test/pt-final'
    ])
    expect(result.targets.every((target) => target.reciprocal)).toBe(true)
  })

  it('reuses delivered evidence for the current URL instead of requesting it again', async () => {
    const rendered: RenderedAuditSnapshot = {
      title: 'English',
      hreflang: [
        { hreflang: 'en', href: '/en', resolvedHref: 'https://site.test/en', sourceIndex: 0 },
        {
          hreflang: 'pt-BR',
          href: '/pt',
          resolvedHref: 'https://site.test/pt',
          sourceIndex: 1
        }
      ]
    }
    const delivered: DeliveredEvidence = {
      available: true,
      unavailableReason: null,
      finalUrl: 'https://site.test/en',
      status: 200,
      redirects: [],
      headers: {},
      documentTitle: 'English',
      canonicals: ['https://site.test/en'],
      truncated: false
    }
    const calls: string[] = []
    const result = await verifyInternationalization(
      'https://site.test/en',
      rendered,
      async (url) => {
        calls.push(url)
        return {
          status: 200,
          headers: [],
          location: null,
          readBody: async () => ({
            text: '<html lang="pt-BR"><link rel="alternate" hreflang="en" href="/en">',
            truncated: false
          })
        }
      },
      {},
      delivered
    )

    expect(calls).toEqual(['https://site.test/pt'])
    expect(result.targets[0]).toMatchObject({
      url: 'https://site.test/en',
      status: 200,
      reciprocal: true,
      targetCanonical: 'https://site.test/en'
    })
  })

  it('reports invalid/duplicate codes, canonical self gaps, and unavailable checks', () => {
    const result: InternationalizationResult = {
      declarations: [
        {
          hreflang: 'bad_code',
          href: '/bad',
          resolvedHref: 'https://site.test/bad',
          sourceIndex: 0
        },
        {
          hreflang: 'bad_code',
          href: '/other',
          resolvedHref: 'https://site.test/other',
          sourceIndex: 1
        }
      ],
      localeMetadata: ['fr'],
      targets: [
        {
          url: 'https://site.test/bad',
          hreflang: 'bad_code',
          available: false,
          unavailableReason: 'timeout',
          status: null,
          finalUrl: null,
          redirects: [],
          truncated: false,
          reciprocal: null,
          targetLanguage: null,
          targetCanonical: null
        }
      ]
    }
    expect(hreflangSyntaxRule.evaluate(context(result)).outcome).toBe('error')
    expect(hreflangRelationshipsRule.evaluate(context(result)).outcome).toBe('warning')
    expect(hreflangReciprocalRule.evaluate(context(result)).outcome).toBe('unable-to-verify')
  })
})
