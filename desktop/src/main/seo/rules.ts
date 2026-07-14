import type {
  AuditAccessContext,
  AuditCategory,
  DeliveredEvidence,
  Finding,
  IndexingIntent,
  RenderedAuditSnapshot
} from '../../shared/seo-audit'

/**
 * Everything a rule may read when evaluating the audited page. Grows with the
 * evidence model as later categories land. A rule may cite either the rendered
 * or the delivered origin and may compare them to report a discrepancy.
 */
export interface RuleContext {
  rendered: RenderedAuditSnapshot
  delivered: DeliveredEvidence
  accessContext: AuditAccessContext
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

/**
 * The Rule catalog for a Page SEO audit, in display order. Later slices append
 * category rules here.
 */
export const SEO_RULES: Rule[] = [titlePresenceRule, titleHydrationRule]
