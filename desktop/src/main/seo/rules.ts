import type {
  AuditAccessContext,
  AuditCategory,
  DeliveredEvidence,
  Finding,
  IndexingIntent,
  IndexabilityResult,
  RenderedAuditSnapshot,
  SearchAppearanceResult,
  SocialSharingResult
} from '../../shared/seo-audit'
import { isLocalhostUrl } from '../../shared/dev-context'

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
  searchAppearance: SearchAppearanceResult
  indexability: IndexabilityResult
  socialSharing: SocialSharingResult
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

export const indexabilityStatusRule: Rule = {
  id: 'indexability/final-status',
  category: 'indexability',
  evaluate({ delivered }): Finding {
    if (!delivered.available || delivered.status === null) {
      return finding(
        this,
        'unable-to-verify',
        'Final response status is unavailable',
        'The audit cannot confirm that crawlers receive a successful document response.',
        null,
        `Delivered evidence is unavailable (${delivered.unavailableReason ?? 'unknown'}).`
      )
    }
    if (delivered.status < 200 || delivered.status >= 400) {
      return finding(
        this,
        'error',
        `Page responds with HTTP ${delivered.status}`,
        'Non-success document responses may prevent the page from being indexed as intended.',
        'Serve the intended document with a successful HTTP status.',
        `Final response: ${delivered.status} ${delivered.finalUrl ?? ''}`
      )
    }
    return finding(
      this,
      'passed',
      `Page responds with HTTP ${delivered.status}`,
      'The delivered document has a successful final response.',
      null,
      `Final response: ${delivered.status} ${delivered.finalUrl ?? ''}`
    )
  }
}

export const indexabilityRedirectRule: Rule = {
  id: 'indexability/redirect-chain',
  category: 'indexability',
  evaluate({ delivered }): Finding {
    if (!delivered.available && delivered.redirects.length === 0) {
      return finding(
        this,
        'unable-to-verify',
        'Redirect chain could not be verified',
        'The audit cannot confirm how crawlers reach the final document.',
        null,
        `Delivered evidence is unavailable (${delivered.unavailableReason ?? 'unknown'}).`
      )
    }
    if (delivered.redirects.length === 0) {
      return finding(
        this,
        'passed',
        'Page loads without redirects',
        'Crawlers can reach the requested document directly.',
        null,
        'No redirect hops observed.'
      )
    }
    return finding(
      this,
      'opportunity',
      `Page uses ${delivered.redirects.length} redirect ${delivered.redirects.length === 1 ? 'hop' : 'hops'}`,
      'Redirects are valid but extra hops can delay crawling and obscure the preferred URL.',
      delivered.redirects.length > 1 ? 'Link directly to the final URL where possible.' : null,
      delivered.redirects.map((hop) => `${hop.status} ${hop.from} → ${hop.to}`).join(' · ')
    )
  }
}

export const indexabilityDirectivesRule: Rule = {
  id: 'indexability/robots-directives',
  category: 'indexability',
  evaluate({ indexability, indexingIntent, accessContext }): Finding {
    const values = [
      ...indexability.metaRobots.map((item) => item.value),
      ...indexability.headerRobots
    ]
    const directives = values.flatMap((value) =>
      value
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean)
    )
    const noindex = directives.includes('noindex') || directives.includes('none')
    const index = directives.includes('index') || directives.includes('all')
    const conflict = noindex && index
    const auth = accessContext.authenticated
      ? ' Authenticated observation may differ from the public response.'
      : ''
    if (conflict) {
      return finding(
        this,
        'error',
        'Robots directives conflict',
        `The page declares both index and noindex, leaving indexing intent ambiguous.${auth}`,
        'Remove contradictory robots directives and keep one explicit policy.',
        values.join(' · ')
      )
    }
    if (indexingIntent === 'indexable' && noindex) {
      return finding(
        this,
        'error',
        'Page is marked noindex',
        `The observed directives prevent indexing even though this page should be indexable.${auth}`,
        'Remove noindex from meta and response-header directives.',
        values.join(' · ')
      )
    }
    if (indexingIntent === 'non-indexable') {
      return noindex
        ? finding(
            this,
            'passed',
            'Page is intentionally non-indexable',
            `The observed noindex directive matches the declared intent.${auth}`,
            null,
            values.join(' · ')
          )
        : finding(
            this,
            'warning',
            'Non-indexable intent is not enforced',
            `No noindex directive was observed for a page intended to stay out of search.${auth}`,
            'Add noindex in the delivered HTML or X-Robots-Tag response header.',
            values.join(' · ') || 'No robots directives found.'
          )
    }
    if (indexingIntent === 'local-private') {
      return finding(
        this,
        noindex ? 'passed' : 'opportunity',
        noindex
          ? 'Local/private page is marked noindex'
          : 'Local/private page has no noindex directive',
        `Public discoverability is contextual for a local/private environment.${auth}`,
        noindex ? null : 'Add noindex if this environment can be reached by crawlers.',
        values.join(' · ') || 'No robots directives found.'
      )
    }
    return finding(
      this,
      'passed',
      'Robots directives allow indexing',
      `No noindex directive conflicts with the declared indexing intent.${auth}`,
      null,
      values.join(' · ') || 'No restrictive robots directives found.'
    )
  }
}

export const indexabilityCanonicalTargetRule: Rule = {
  id: 'indexability/canonical-target',
  category: 'indexability',
  evaluate({ indexability }): Finding {
    const target = indexability.canonical
    if (!target) {
      return finding(
        this,
        'opportunity',
        'Canonical target is not declared',
        'The audit has no canonical target to verify.',
        'Declare a canonical when URL variants exist.',
        'No canonical target.'
      )
    }
    if (!target.available) {
      return finding(
        this,
        'unable-to-verify',
        'Canonical target could not be reached',
        'The preferred URL could not be verified within the request budget.',
        null,
        `${target.url} (${target.unavailableReason ?? 'unknown'})`
      )
    }
    if (target.status === null || target.status >= 400) {
      return finding(
        this,
        'error',
        `Canonical target responds with HTTP ${target.status ?? 'unknown'}`,
        'A broken canonical can send indexing signals to an unavailable URL.',
        'Point the canonical at a successful, indexable URL.',
        `${target.url} → ${target.status ?? 'unknown'}`
      )
    }
    const redirected = target.redirects.length > 0
    return finding(
      this,
      redirected ? 'warning' : 'passed',
      redirected ? 'Canonical target redirects' : 'Canonical target is reachable',
      redirected
        ? 'Canonical URLs should normally point directly at their final destination.'
        : 'The declared canonical target responds successfully.',
      redirected ? 'Update the canonical to its final URL.' : null,
      `${target.url} → ${target.finalUrl ?? target.url} (${target.status})`
    )
  }
}

export const indexabilityRobotsTxtRule: Rule = {
  id: 'indexability/robots-txt-access',
  category: 'indexability',
  evaluate({ indexability, indexingIntent, accessContext }): Finding {
    const robots = indexability.robotsTxt
    const auth = accessContext.authenticated
      ? ' This does not prove public crawler access because the page was observed with authentication.'
      : ''
    if (!robots.available || robots.allowed === null) {
      return finding(
        this,
        'unable-to-verify',
        'robots.txt access could not be verified',
        `The audit could not determine whether the selected user-agent may crawl this path.${auth}`,
        null,
        `${robots.url} (${robots.unavailableReason ?? `HTTP ${robots.status ?? 'unknown'}`})`
      )
    }
    if (robots.ambiguous) {
      return finding(
        this,
        'warning',
        'robots.txt rules are ambiguous',
        `Multiple equally specific rules disagree for this path.${auth}`,
        'Make the applicable user-agent rules unambiguous.',
        `Matched ${robots.matchedUserAgent ?? 'no group'}; allowed=${robots.allowed}`
      )
    }
    const shouldAllow = indexingIntent === 'indexable'
    const outcome =
      shouldAllow && !robots.allowed
        ? 'error'
        : !shouldAllow && !robots.allowed
          ? 'passed'
          : 'passed'
    return finding(
      this,
      outcome,
      robots.allowed ? 'robots.txt allows this path' : 'robots.txt blocks this path',
      `${robots.allowed ? 'The path is crawlable' : 'The path is not crawlable'} for the matched user-agent group.${auth}`,
      shouldAllow && !robots.allowed ? 'Allow this path for the intended crawler group.' : null,
      `Matched ${robots.matchedUserAgent ?? 'default'}; allowed=${robots.allowed}`
    )
  }
}

export const indexabilitySitemapsRule: Rule = {
  id: 'indexability/declared-sitemaps',
  category: 'indexability',
  evaluate({ indexability }): Finding {
    if (indexability.sitemaps.length === 0) {
      return finding(
        this,
        'opportunity',
        'No sitemap location is declared',
        'A declared sitemap can help crawlers discover the preferred URL set.',
        'Declare a sitemap in robots.txt or a sitemap link when the site uses one.',
        'No sitemap targets found.'
      )
    }
    const unknown = indexability.sitemaps.filter((item) => !item.available)
    const broken = indexability.sitemaps.filter(
      (item) => item.available && (item.status ?? 500) >= 400
    )
    if (unknown.length > 0) {
      return finding(
        this,
        'unable-to-verify',
        'Some declared sitemaps could not be verified',
        'The audit did not expand sitemap contents, but could not confirm every declared location.',
        null,
        unknown.map((item) => `${item.url} (${item.unavailableReason})`).join(' · ')
      )
    }
    if (broken.length > 0) {
      return finding(
        this,
        'warning',
        'Some declared sitemaps are unavailable',
        'Crawlers may not be able to retrieve the declared sitemap locations.',
        'Update or remove unavailable sitemap declarations.',
        broken.map((item) => `${item.url} (${item.status})`).join(' · ')
      )
    }
    return finding(
      this,
      'passed',
      `${indexability.sitemaps.length} declared sitemap ${indexability.sitemaps.length === 1 ? 'is' : 'are'} reachable`,
      'Declared sitemap locations respond successfully; their contents were not expanded.',
      null,
      indexability.sitemaps.map((item) => `${item.url} (${item.status})`).join(' · ')
    )
  }
}

export const socialMetadataRule: Rule = {
  id: 'social-sharing/metadata-complete',
  category: 'social-sharing',
  evaluate({ socialSharing }): Finding {
    const og = socialSharing.resolved.openGraph
    const missing = [
      !og.title.value && 'title',
      !og.description.value && 'description',
      !og.image.value && 'image'
    ].filter(Boolean)
    if (missing.length) {
      return finding(
        this,
        'warning',
        'Social sharing metadata is incomplete',
        'Platforms may generate inconsistent cards when core title, description, or image values are absent.',
        'Declare Open Graph title, description, and image values for predictable sharing.',
        `Missing: ${missing.join(', ')}`
      )
    }
    return finding(
      this,
      'passed',
      'Core social sharing metadata resolves',
      'Representative cards have a title, description, and image candidate.',
      null,
      `Open Graph title: “${og.title.value}” · X card: ${socialSharing.resolved.x.card.value}`
    )
  }
}

export const socialDeclarationsRule: Rule = {
  id: 'social-sharing/declarations-consistent',
  category: 'social-sharing',
  evaluate({ socialSharing }): Finding {
    const problems: string[] = []
    for (const property of new Set(socialSharing.declared.map((item) => item.property))) {
      for (const origin of ['delivered', 'rendered'] as const) {
        const items = socialSharing.declared.filter(
          (item) => item.property === property && item.origin === origin
        )
        if (items.length > 1 && new Set(items.map((item) => item.value.trim())).size > 1) {
          problems.push(`${origin} ${property} has ${items.length} conflicting values`)
        }
      }
    }
    return problems.length
      ? finding(
          this,
          'warning',
          'Social metadata declarations conflict',
          'Platforms may select different values when the same property conflicts.',
          'Keep intentional multi-image declarations, but remove contradictory scalar values.',
          problems.join(' · ')
        )
      : finding(
          this,
          'passed',
          'Social metadata declarations are consistent',
          'No conflicting values were found within either evidence origin.',
          null,
          `${socialSharing.declared.length} declarations inspected.`
        )
  }
}

export const socialImagesRule: Rule = {
  id: 'social-sharing/images-valid',
  category: 'social-sharing',
  evaluate({ socialSharing }): Finding {
    const selected =
      socialSharing.resolved.openGraph.image.value ?? socialSharing.resolved.x.image.value
    if (!selected) {
      return finding(
        this,
        'warning',
        'No social image is declared',
        'Cards without an image are less distinctive and may use platform-generated fallbacks.',
        'Declare an absolute Open Graph image with a supported image format.',
        'No image candidate resolved.'
      )
    }
    const image = socialSharing.images.find(
      (item) => item.url === selected || item.finalUrl === selected
    )
    if (!image || !image.available) {
      return finding(
        this,
        'error',
        'Social image could not be verified',
        'Platforms may be unable to render the selected image.',
        'Use a publicly reachable image URL that responds successfully.',
        `${selected} (${image?.unavailableReason ?? 'not inspected'})`
      )
    }
    const problems: string[] = []
    if ((image.status ?? 500) >= 400) problems.push(`HTTP ${image.status}`)
    if (!image.mediaType?.startsWith('image/'))
      problems.push(`unsupported media type ${image.mediaType ?? 'unknown'}`)
    if (image.truncated) problems.push('exceeded the image byte budget')
    if (!image.width || !image.height) problems.push('dimensions could not be read')
    if (image.width && image.height && (image.width < 200 || image.height < 200))
      problems.push(`small dimensions ${image.width}×${image.height}`)
    if (selected.startsWith('http://') && !isLocalhostUrl(selected)) {
      problems.push('insecure HTTP URL')
    }
    const detail = `${image.finalUrl ?? image.url} · ${image.mediaType ?? 'unknown type'} · ${image.byteSize ?? 'unknown'} bytes · ${image.width ?? '?'}×${image.height ?? '?'} · sha256 ${image.sha256 ?? 'unavailable'}`
    return problems.length
      ? finding(
          this,
          'warning',
          'Social image may be unsuitable',
          'One or more image properties may reduce compatibility or card quality.',
          'Use a secure, supported, sufficiently large image that fits the platform card.',
          `${detail} · ${problems.join(', ')}`
        )
      : finding(
          this,
          'passed',
          'Social image is reachable and inspectable',
          'The selected image has a supported response and usable dimensions.',
          null,
          detail
        )
  }
}

function finding(
  rule: Pick<Rule, 'id' | 'category'>,
  outcome: Finding['outcome'],
  summary: string,
  impact: string,
  remediation: string | null,
  detail: string
): Finding {
  return {
    ruleId: rule.id,
    category: rule.category,
    outcome,
    summary,
    impact,
    remediation,
    evidence: { origin: 'delivered', detail }
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

/**
 * The Rule catalog for a Page SEO audit, in display order. Later slices append
 * category rules here.
 */
export const SEO_RULES: Rule[] = [
  titlePresenceRule,
  titleHydrationRule,
  descriptionPresenceRule,
  canonicalRule,
  metadataDeclarationsRule,
  searchSnippetLengthRule,
  indexabilityStatusRule,
  indexabilityRedirectRule,
  indexabilityDirectivesRule,
  indexabilityCanonicalTargetRule,
  indexabilityRobotsTxtRule,
  indexabilitySitemapsRule,
  socialMetadataRule,
  socialDeclarationsRule,
  socialImagesRule
]
