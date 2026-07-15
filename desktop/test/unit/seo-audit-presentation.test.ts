import { describe, expect, it } from 'vitest'
import { applySeoNavigation } from '../../src/renderer/src/hooks/use-seo-audit-presentation'

describe('Page SEO audit presentation navigation', () => {
  const current = {
    url: '',
    pageTitle: '',
    intent: 'indexable' as const
  }

  it('tracks the current URL and page title', () => {
    expect(
      applySeoNavigation(
        current,
        { barUrl: 'https://example.com/docs', pageTitle: 'Docs' },
        false
      )
    ).toMatchObject({ url: 'https://example.com/docs', pageTitle: 'Docs' })
  })

  it('infers local-private intent until the user chooses an intent', () => {
    expect(
      applySeoNavigation(
        current,
        { barUrl: 'http://localhost:3000', pageTitle: 'Local app' },
        false
      ).intent
    ).toBe('local-private')
  })

  it('preserves the chosen intent across later navigations', () => {
    expect(
      applySeoNavigation(
        { ...current, intent: 'non-indexable' },
        { barUrl: 'http://localhost:3000', pageTitle: 'Local app' },
        true
      ).intent
    ).toBe('non-indexable')
  })

  it('does not infer intent from an empty navigation', () => {
    expect(
      applySeoNavigation(
        { ...current, intent: 'non-indexable' },
        { barUrl: '', pageTitle: '' },
        false
      ).intent
    ).toBe('non-indexable')
  })
})
