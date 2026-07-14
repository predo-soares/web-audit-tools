import { describe, expect, it } from 'vitest'
import {
  linkDestinationsRule,
  linkDirectivesRule,
  linkInventoryRule,
  linkNamesRule,
  type RuleContext
} from '../../src/main/seo/rules'
import type { LinkEvidence } from '../../src/shared/seo-audit'

function link(overrides: Partial<LinkEvidence> = {}): LinkEvidence {
  return {
    sourceIndex: 0,
    rawHref: '/about',
    resolvedHref: 'https://site.test/about',
    text: 'About us',
    accessibleName: 'About us',
    target: null,
    rel: [],
    rawRel: '',
    visible: true,
    kind: 'internal',
    fragmentTargetExists: null,
    ...overrides
  }
}

function context(links: LinkEvidence[]): RuleContext {
  return { links, indexability: { canonical: null } } as RuleContext
}

describe('link discoverability rules', () => {
  it('accepts icon-only links with an accessible name and retains hidden links', () => {
    const result = linkNamesRule.evaluate(
      context([
        link({ text: '', accessibleName: 'Account' }),
        link({ sourceIndex: 1, text: '', accessibleName: '', visible: false })
      ])
    )
    expect(result).toMatchObject({ outcome: 'passed' })
    expect(result.evidence.detail).toContain('1 hidden')
  })

  it('reports unnamed and context-poor link text separately', () => {
    expect(linkNamesRule.evaluate(context([link({ text: '', accessibleName: '' })])).outcome).toBe(
      'warning'
    )
    expect(
      linkNamesRule.evaluate(context([link({ text: 'Click here', accessibleName: 'Click here' })]))
        .outcome
    ).toBe('opportunity')
  })

  it('rejects JavaScript URLs without exposing their code', () => {
    const result = linkDestinationsRule.evaluate(
      context([link({ rawHref: 'javascript:[redacted]', resolvedHref: null, kind: 'javascript' })])
    )
    expect(result).toMatchObject({ outcome: 'error' })
    expect(result.evidence.detail).not.toContain('alert')
  })

  it('classifies fragments, mail, telephone, downloads, and nofollow contextually', () => {
    const links = [
      link({
        kind: 'fragment',
        rawHref: '#details',
        resolvedHref: 'https://site.test/#details',
        fragmentTargetExists: true
      }),
      link({
        sourceIndex: 1,
        kind: 'email',
        rawHref: 'mailto:hi@site.test',
        resolvedHref: 'mailto:hi@site.test'
      }),
      link({ sourceIndex: 2, kind: 'telephone', rawHref: 'tel:+1000', resolvedHref: 'tel:+1000' }),
      link({
        sourceIndex: 3,
        kind: 'download',
        rawHref: '/guide.pdf',
        resolvedHref: 'https://site.test/guide.pdf'
      }),
      link({ sourceIndex: 4, rel: ['nofollow', 'sponsored'], rawRel: 'nofollow sponsored' })
    ]
    expect(linkDestinationsRule.evaluate(context(links)).outcome).toBe('passed')
    expect(linkDirectivesRule.evaluate(context(links))).toMatchObject({ outcome: 'passed' })
  })

  it('reports unresolved fragments and malformed or conflicting rel combinations', () => {
    expect(
      linkDestinationsRule.evaluate(
        context([link({ kind: 'fragment', rawHref: '#missing', fragmentTargetExists: false })])
      ).outcome
    ).toBe('warning')
    const result = linkDirectivesRule.evaluate(
      context([
        link({ rel: ['follow', 'nofollow'], rawRel: 'follow nofollow' }),
        link({ sourceIndex: 1, rel: ['ugc,sponsored'], rawRel: 'ugc,sponsored' })
      ])
    )
    expect(result).toMatchObject({ outcome: 'warning' })
  })

  it('reports duplicate destinations without fetching them', () => {
    const result = linkInventoryRule.evaluate(
      context([link(), link({ sourceIndex: 1, text: 'Company', accessibleName: 'Company' })])
    )
    expect(result).toMatchObject({ outcome: 'opportunity' })
    expect(result.evidence.detail).toContain('1 repeated')
  })
})
