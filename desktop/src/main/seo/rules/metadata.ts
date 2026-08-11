import type { Finding, SearchAppearanceResult } from '../../../shared/seo-audit'
import type { Rule } from './rule-types'

// A page's title is its single most visible search-appearance signal and the
// default label for shared links, so a missing or empty one is an Error
// regardless of indexing intent — even an intentionally non-indexable page
// still presents a title in the browser tab and bookmarks.
export const titlePresenceRule: Rule = {
  id: 'search-appearance/title-present',
  category: 'search-appearance',
  evaluate({ rendered }): Finding {
    const raw = rendered.title
    const trimmed = raw?.trim() ?? ''

    if (raw === null) {
      return {
        ruleId: this.id,
        category: this.category,
        outcome: 'error',
        summary: 'Page has no title',
        impact:
          'Search engines and browsers fall back to the URL when a page has no <title>, making the page hard to recognize in results, tabs, and bookmarks.',
        remediation: 'Add a single <title> element in the document <head> describing the page.',
        evidence: { origin: 'rendered', detail: 'No <title> element was found in the document.' }
      }
    }

    if (trimmed === '') {
      return {
        ruleId: this.id,
        category: this.category,
        outcome: 'error',
        summary: 'Page title is empty',
        impact:
          'An empty <title> gives search engines and browsers nothing to display, so they fall back to the URL.',
        remediation: 'Give the <title> element descriptive text for this page.',
        evidence: {
          origin: 'rendered',
          detail:
            raw === ''
              ? 'The <title> element is present but empty.'
              : 'The <title> element contains only whitespace.'
        }
      }
    }

    return {
      ruleId: this.id,
      category: this.category,
      outcome: 'passed',
      summary: 'Page has a usable title',
      impact:
        'A descriptive title helps the page be recognized in search results, tabs, and bookmarks.',
      remediation: null,
      evidence: { origin: 'rendered', detail: `Title: “${trimmed}”` }
    }
  }
}

// A page whose delivered <title> differs from the one present after client-side
// rendering can appear one way to crawlers that do not execute scripts and
// another way to users. This is advisory, not an error: hydration legitimately
// changes titles. When delivered evidence is unavailable the check cannot run,
// so it reports Unable to verify rather than guessing.
export const titleHydrationRule: Rule = {
  id: 'search-appearance/title-delivered-vs-rendered',
  category: 'search-appearance',
  evaluate({ delivered, rendered, accessContext }): Finding {
    const renderedTitle = rendered.title?.trim() ?? ''

    if (!delivered.available) {
      return {
        ruleId: this.id,
        category: this.category,
        outcome: 'unable-to-verify',
        summary: 'Delivered title could not be compared',
        impact:
          'Without the pre-render response, the audit cannot tell whether crawlers see the same title as users.',
        remediation: null,
        evidence: {
          origin: 'delivered',
          detail: `Delivered evidence is unavailable (${delivered.unavailableReason ?? 'unknown'}).`
        }
      }
    }

    const deliveredTitle = delivered.documentTitle?.trim() ?? ''
    const authNote = accessContext.authenticated
      ? ' Observed through an authenticated session, which may differ from the public page.'
      : ''

    if (deliveredTitle && renderedTitle && deliveredTitle !== renderedTitle) {
      return {
        ruleId: this.id,
        category: this.category,
        outcome: 'warning',
        summary: 'Title differs before and after rendering',
        impact:
          'Crawlers that do not run scripts may index the delivered title while users see the rendered one.' +
          authNote,
        remediation:
          'Serve the final title in the delivered HTML so crawlers and users see the same value.',
        evidence: {
          origin: 'delivered',
          detail: `Delivered: “${deliveredTitle}” · Rendered: “${renderedTitle}”`
        }
      }
    }

    return {
      ruleId: this.id,
      category: this.category,
      outcome: 'passed',
      summary: 'Delivered and rendered titles agree',
      impact: 'Crawlers and users see a consistent title.',
      remediation: null,
      evidence: {
        origin: 'delivered',
        detail: deliveredTitle
          ? `Delivered title: “${deliveredTitle}”`
          : 'No delivered title to compare.'
      }
    }
  }
}

export const descriptionPresenceRule: Rule = {
  id: 'search-appearance/description-present',
  category: 'search-appearance',
  evaluate({ searchAppearance }): Finding {
    const description = searchAppearance.resolved.description
    if (!description.value) {
      return {
        ruleId: this.id,
        category: this.category,
        outcome: 'warning',
        summary: 'Page has no usable meta description',
        impact:
          'Search engines may generate a snippet from page content when no usable description is declared, reducing control over search appearance.',
        remediation:
          'Add one concise <meta name="description"> that accurately summarizes this page.',
        evidence: { origin: 'rendered', detail: description.reason }
      }
    }
    return {
      ruleId: this.id,
      category: this.category,
      outcome: 'passed',
      summary: 'Page has a usable meta description',
      impact: 'A description gives search engines a relevant candidate for the result snippet.',
      remediation: null,
      evidence: {
        origin: description.origin ?? 'rendered',
        detail: `Description: “${description.value}”`
      }
    }
  }
}

export const canonicalRule: Rule = {
  id: 'search-appearance/canonical-valid',
  category: 'search-appearance',
  evaluate({ searchAppearance }): Finding {
    const canonical = searchAppearance.resolved.canonical
    if (!canonical.value) {
      return {
        ruleId: this.id,
        category: this.category,
        outcome: 'opportunity',
        summary: 'Page has no canonical declaration',
        impact: 'A canonical can clarify the preferred URL when substantially similar URLs exist.',
        remediation:
          'Add one absolute canonical URL when this page can be reached through variants.',
        evidence: { origin: 'rendered', detail: canonical.reason }
      }
    }
    try {
      const url = new URL(canonical.value)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol')
    } catch {
      return {
        ruleId: this.id,
        category: this.category,
        outcome: 'error',
        summary: 'Canonical URL is malformed',
        impact: 'Search engines cannot reliably interpret a malformed canonical target.',
        remediation: 'Use one valid absolute HTTP(S) URL in the canonical link.',
        evidence: {
          origin: canonical.origin ?? 'rendered',
          detail: `Canonical: “${canonical.value}”`
        }
      }
    }
    return {
      ruleId: this.id,
      category: this.category,
      outcome: 'passed',
      summary: 'Canonical URL is usable',
      impact: 'The page declares an unambiguous preferred URL candidate.',
      remediation: null,
      evidence: { origin: canonical.origin ?? 'rendered', detail: `Canonical: ${canonical.value}` }
    }
  }
}

export const metadataDeclarationsRule: Rule = {
  id: 'search-appearance/declarations-consistent',
  category: 'search-appearance',
  evaluate({ searchAppearance }): Finding {
    const kinds = ['title', 'description', 'canonical', 'favicon'] as const
    const problems: string[] = []
    for (const kind of kinds) {
      for (const origin of ['delivered', 'rendered'] as const) {
        const declarations = searchAppearance.declared.filter(
          (item) => item.kind === kind && item.origin === origin
        )
        if (declarations.length > 1) {
          const distinct = new Set(declarations.map((item) => item.value.trim()))
          problems.push(
            `${origin} ${kind}: ${declarations.length} declarations${distinct.size > 1 ? ' conflict' : ' repeat'}`
          )
        }
      }
      const delivered = firstValue(searchAppearance, kind, 'delivered')
      const rendered = firstValue(searchAppearance, kind, 'rendered')
      if (delivered && rendered && delivered !== rendered) {
        problems.push(`${kind} differs between delivered and rendered evidence`)
      }
    }
    if (problems.length === 0) {
      return {
        ruleId: this.id,
        category: this.category,
        outcome: 'passed',
        summary: 'Search metadata declarations are consistent',
        impact: 'Each search-appearance signal has an unambiguous declaration.',
        remediation: null,
        evidence: { origin: 'rendered', detail: 'No duplicate or conflicting declarations found.' }
      }
    }
    return {
      ruleId: this.id,
      category: this.category,
      outcome: 'warning',
      summary: 'Search metadata has duplicate or conflicting declarations',
      impact: 'Consumers may select different values when declarations repeat or disagree.',
      remediation: 'Keep one authoritative declaration for each signal in the delivered document.',
      evidence: { origin: 'rendered', detail: problems.join(' · ') }
    }
  }
}

export const searchSnippetLengthRule: Rule = {
  id: 'search-appearance/snippet-likely-truncation',
  category: 'search-appearance',
  evaluate({ searchAppearance }): Finding {
    const { measurements } = searchAppearance
    const likely: string[] = []
    if (measurements.titleWidthPx !== null && measurements.titleWidthPx > 600) {
      likely.push(
        `title ${measurements.titleCharacters} characters / ${measurements.titleWidthPx}px`
      )
    }
    if (measurements.descriptionWidthPx !== null && measurements.descriptionWidthPx > 920) {
      likely.push(
        `description ${measurements.descriptionCharacters} characters / ${measurements.descriptionWidthPx}px`
      )
    }
    const detail = `Title: ${measurements.titleCharacters} characters${width(measurements.titleWidthPx)} · Description: ${measurements.descriptionCharacters} characters${width(measurements.descriptionWidthPx)}`
    if (likely.length === 0) {
      return {
        ruleId: this.id,
        category: this.category,
        outcome: 'passed',
        summary: 'Snippet text fits the representative preview',
        impact: 'The current values are not likely to truncate in this representative layout.',
        remediation: null,
        evidence: { origin: 'rendered', detail }
      }
    }
    return {
      ruleId: this.id,
      category: this.category,
      outcome: 'opportunity',
      summary: 'Snippet text may be truncated',
      impact: 'Search layouts vary, but the representative preview may shorten these values.',
      remediation: 'Review the preview and put the most distinctive information earlier if needed.',
      evidence: {
        origin: 'rendered',
        detail: `${detail} · Likely truncation: ${likely.join(', ')}`
      }
    }
  }
}

function firstValue(
  searchAppearance: SearchAppearanceResult,
  kind: 'title' | 'description' | 'canonical' | 'favicon',
  origin: 'delivered' | 'rendered'
): string | null {
  return (
    searchAppearance.declared
      .find((item) => item.kind === kind && item.origin === origin && item.value.trim())
      ?.value.trim() ?? null
  )
}

function width(value: number | null): string {
  return value === null ? ' / width unavailable' : ` / ${value}px`
}
