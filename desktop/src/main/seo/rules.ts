import type {
  AuditCategory,
  Finding,
  IndexingIntent,
  RenderedAuditSnapshot
} from '../../shared/seo-audit'

/**
 * Everything a rule may read when evaluating the audited page. Grows with the
 * evidence model (delivered evidence, referenced-resource results) as later
 * categories land; Issue 01 exposes only the rendered snapshot and intent.
 */
export interface RuleContext {
  rendered: RenderedAuditSnapshot
  indexingIntent: IndexingIntent
}

/**
 * One check in the Rule catalog. `evaluate` is pure over its context so rules
 * are exhaustively table-testable without a running pane.
 */
export interface Rule {
  id: string
  category: AuditCategory
  evaluate(context: RuleContext): Finding
}

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

/**
 * The Rule catalog for a Page SEO audit, in display order. Later slices append
 * category rules here.
 */
export const SEO_RULES: Rule[] = [titlePresenceRule]
