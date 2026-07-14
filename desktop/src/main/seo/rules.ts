import type {
  AuditAccessContext,
  AuditCategory,
  DeliveredEvidence,
  DocumentStructureEvidence,
  Finding,
  IndexingIntent,
  IndexabilityResult,
  RenderedAuditSnapshot,
  SearchAppearanceResult,
  SocialSharingResult,
  StructuredDataResult
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
  structuredData: StructuredDataResult
  documentStructure: DocumentStructureEvidence
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

export const structuredDataStandardsRule: Rule = {
  id: 'structured-data/standards-valid',
  category: 'structured-data',
  evaluate({ structuredData }): Finding {
    if (structuredData.sources.length === 0) {
      return finding(
        this,
        'opportunity',
        'No structured data detected',
        'Structured data can make page entities machine-readable.',
        'Add relevant JSON-LD, Microdata, or RDFa when the page represents a supported entity.',
        'No structured-data sources were found in the rendered page.'
      )
    }
    const errors = structuredData.problems.filter((problem) => problem.severity === 'error')
    const warnings = structuredData.problems.filter((problem) => problem.severity === 'warning')
    if (errors.length)
      return finding(
        this,
        'error',
        'Structured data has standards errors',
        'Invalid syntax or value shapes can prevent consumers from reading affected entities.',
        'Fix the cited syntax and value-shape errors, then validate the rendered markup again.',
        describeProblems(errors)
      )
    if (warnings.length)
      return finding(
        this,
        'warning',
        'Structured data has relationship warnings',
        'Broken or conflicting identifiers can make entity relationships ambiguous.',
        'Resolve the cited identifiers and entity references.',
        describeProblems(warnings)
      )
    return finding(
      this,
      'passed',
      'Structured data is parseable',
      'The detected sources use inspectable syntax and entity shapes.',
      null,
      `${structuredData.sources.length} source(s) produced ${structuredData.entities.length} inspectable entity or entities.`
    )
  }
}

export const structuredDataRelationshipsRule: Rule = {
  id: 'structured-data/relationships-valid',
  category: 'structured-data',
  evaluate({ structuredData }): Finding {
    if (!structuredData.entities.length)
      return finding(
        this,
        'unable-to-verify',
        'Entity relationships could not be checked',
        'No parseable entities were available for relationship validation.',
        null,
        'Relationship validation requires at least one parseable entity.'
      )
    const relationshipProblems = structuredData.problems.filter((problem) =>
      /Reference|Conflicting/.test(problem.message)
    )
    return relationshipProblems.length
      ? finding(
          this,
          'warning',
          'Structured data relationships are ambiguous',
          'Unresolved or conflicting identifiers can split what should be one entity graph.',
          'Give repeated entities consistent data and make every local @id reference resolve.',
          describeProblems(relationshipProblems)
        )
      : finding(
          this,
          'passed',
          'Structured data relationships resolve',
          'No broken local references or conflicting repeated identifiers were detected.',
          null,
          `${structuredData.entities.length} entity or entities checked.`
        )
  }
}

export const searchEnhancementEligibilityRule: Rule = {
  id: 'structured-data/search-enhancement-eligibility',
  category: 'structured-data',
  evaluate({ structuredData }): Finding {
    const supported = structuredData.enhancements.filter((item) => item.status !== 'not-supported')
    if (!structuredData.entities.length)
      return finding(
        this,
        'unable-to-verify',
        'Search enhancement eligibility could not be assessed',
        'There are no parseable typed entities to compare with the attributed profile.',
        null,
        'No parseable typed entities were available.'
      )
    if (!supported.length)
      return finding(
        this,
        'opportunity',
        'No attributed search enhancement profile applies',
        'Valid custom or unsupported vocabulary can still describe the page without qualifying for a known enhancement.',
        null,
        'Detected entity types are inspectable but are not covered by the current profile. This is not a standards error.'
      )
    const ineligible = supported.filter((item) => item.status === 'ineligible')
    if (ineligible.length)
      return finding(
        this,
        'warning',
        'Some entities appear ineligible for a search enhancement',
        'Required fields are missing under the attributed, versioned eligibility profile.',
        'Add the missing required fields where they accurately describe the page.',
        ineligible
          .map(
            (item) =>
              `${item.type} at ${item.entityPath}: missing ${item.missingRequired.join(', ')}`
          )
          .join(' · ')
      )
    const recommended = supported.flatMap((item) =>
      item.missingRecommended.map((field) => `${item.type}.${field}`)
    )
    return finding(
      this,
      'passed',
      'Entities appear eligible for a search enhancement',
      'Eligibility is based on an attributed, versioned profile and does not guarantee that a rich result will appear.',
      recommended.length
        ? 'Consider adding accurate recommended fields to make the entity more complete.'
        : null,
      `Profile ${supported[0].profileVersion}; missing recommended: ${recommended.join(', ') || 'none'}. Eligibility does not guarantee a rich result.`
    )
  }
}

function describeProblems(problems: StructuredDataResult['problems']): string {
  return problems
    .slice(0, 5)
    .map((problem) => `source ${problem.sourceIndex} ${problem.path}: ${problem.message}`)
    .join(' · ')
}

export const documentLanguageRule: Rule = {
  id: 'document-structure/language',
  category: 'document-structure',
  evaluate({ documentStructure }): Finding {
    const { lang, xmlLang } = documentStructure.language
    if (!lang?.trim() && !xmlLang?.trim())
      return finding(
        this,
        'warning',
        'Document language is missing',
        'Language metadata helps search systems and assistive technology interpret the page text.',
        'Add a valid BCP 47 language tag to the root html element.',
        'Neither html lang nor xml:lang is declared in the rendered document.'
      )
    if (
      lang?.trim() &&
      xmlLang?.trim() &&
      lang.trim().toLowerCase() !== xmlLang.trim().toLowerCase()
    )
      return finding(
        this,
        'error',
        'Document language declarations conflict',
        'Conflicting root language declarations make the document language ambiguous.',
        'Make html lang and xml:lang agree, or remove the unnecessary duplicate.',
        `html lang="${lang}" conflicts with xml:lang="${xmlLang}".`
      )
    const value = (lang || xmlLang || '').trim()
    try {
      new Intl.Locale(value)
    } catch {
      return finding(
        this,
        'warning',
        'Document language tag is malformed',
        'Consumers may not recognize a malformed language identifier.',
        'Use a valid BCP 47 language tag such as en, en-US, or pt-BR.',
        `Rendered language declaration: "${value}".`
      )
    }
    return finding(
      this,
      'passed',
      'Document language is declared',
      'A consistent language declaration describes the rendered document.',
      null,
      `Rendered document language: ${value}.`
    )
  }
}

export const primaryHeadingRule: Rule = {
  id: 'document-structure/primary-heading',
  category: 'document-structure',
  evaluate({ documentStructure }): Finding {
    const visible = documentStructure.headings.filter((heading) => heading.visible)
    const primary = visible.filter((heading) => heading.level === 1)
    const empty = primary.filter((heading) => !heading.accessibleName)
    if (empty.length)
      return finding(
        this,
        'error',
        'Primary heading has no accessible name',
        'An empty primary heading does not communicate the page topic.',
        'Give the visible h1 concise text or an accurate accessible name.',
        `Empty visible h1 at heading source ${empty[0].sourceIndex}.`
      )
    if (!primary.length)
      return finding(
        this,
        'warning',
        'Visible primary heading is missing',
        'A clear primary heading helps communicate the page topic and organize its content.',
        'Add one visible h1 that describes the page topic.',
        `${visible.length} visible heading(s), but no visible h1. ${documentStructure.headings.length - visible.length} hidden heading(s) were excluded.`
      )
    if (primary.length > 1)
      return finding(
        this,
        'opportunity',
        'Page has multiple visible primary headings',
        'Multiple h1 elements can be legitimate, but their relationship depends on the page composition.',
        'Confirm each h1 introduces a distinct top-level region; otherwise use one page-level h1 and nested headings.',
        `${primary.length} visible h1 elements: ${primary.map((heading) => `“${heading.accessibleName}”`).join(', ')}.`
      )
    return finding(
      this,
      'passed',
      'Page has a named primary heading',
      'The rendered page exposes one visible primary heading.',
      null,
      `h1: “${primary[0].accessibleName}”; ${visible.length} visible and ${documentStructure.headings.length - visible.length} hidden heading(s).`
    )
  }
}

export const headingHierarchyRule: Rule = {
  id: 'document-structure/heading-hierarchy',
  category: 'document-structure',
  evaluate({ documentStructure }): Finding {
    const headings = documentStructure.headings.filter((heading) => heading.visible)
    const empty = headings.filter((heading) => !heading.accessibleName)
    if (empty.length)
      return finding(
        this,
        'warning',
        'Some visible headings are unnamed',
        'Unnamed headings create structure without communicating a section topic.',
        'Give each visible heading descriptive text or an accurate accessible name.',
        `Unnamed heading sources: ${empty.map((heading) => heading.sourceIndex).join(', ')}.`
      )
    const skips = headings
      .slice(1)
      .flatMap((heading, index) =>
        heading.level > headings[index].level + 1
          ? [`h${headings[index].level} → h${heading.level} at source ${heading.sourceIndex}`]
          : []
      )
    if (skips.length)
      return finding(
        this,
        'warning',
        'Heading hierarchy skips levels',
        'Skipped levels can make the relationship between sections unclear.',
        'Use heading levels that reflect the nesting of rendered sections.',
        skips.join(' · ')
      )
    return finding(
      this,
      'passed',
      'Visible heading hierarchy is sequential',
      'No skipped levels or unnamed visible headings were detected.',
      null,
      headings.length
        ? headings.map((heading) => `h${heading.level} “${heading.accessibleName}”`).join(' · ')
        : 'No visible headings to sequence.'
    )
  }
}

export const pageLandmarksRule: Rule = {
  id: 'document-structure/page-landmarks',
  category: 'document-structure',
  evaluate({ documentStructure }): Finding {
    const visible = documentStructure.landmarks.filter((landmark) => landmark.visible)
    const mains = visible.filter((landmark) => landmark.role === 'main')
    if (!mains.length)
      return finding(
        this,
        'opportunity',
        'Page has no visible main landmark',
        'A main landmark explicitly identifies the page-specific content region.',
        'Wrap the primary page content in one visible main element or role="main" region.',
        `${visible.length} visible page-meaning landmark(s): ${visible.map((item) => item.role).join(', ') || 'none'}.`
      )
    if (mains.length > 1)
      return finding(
        this,
        'warning',
        'Page has multiple visible main landmarks',
        'Multiple main regions are ambiguous unless their purpose is clearly distinguished.',
        'Keep one main region, or give distinct main regions accurate accessible names when the composition requires them.',
        `${mains.length} visible main landmarks; names: ${mains.map((item) => item.accessibleName || '(unnamed)').join(', ')}.`
      )
    if (mains[0].textCharacters === 0)
      return finding(
        this,
        'warning',
        'Main landmark is empty',
        'An empty main region does not identify meaningful page content.',
        'Place the page-specific rendered content inside the main landmark.',
        `Main landmark source ${mains[0].sourceIndex} contains no text.`
      )
    return finding(
      this,
      'passed',
      'Page meaning is identified by landmarks',
      'One visible main landmark identifies the page-specific content.',
      null,
      `Main landmark source ${mains[0].sourceIndex} contains ${mains[0].textCharacters} text characters; ${visible.length} visible landmarks total.`
    )
  }
}

export const contentSignalsRule: Rule = {
  id: 'document-structure/content-signals',
  category: 'document-structure',
  evaluate({ documentStructure }): Finding {
    const detail = `${documentStructure.visibleTextCharacters} visible text characters · ${documentStructure.headings.filter((item) => item.visible).length} visible headings · ${documentStructure.repeatedText.length} repeated passage(s).`
    if (documentStructure.repeatedText.length)
      return finding(
        this,
        'opportunity',
        'Rendered content contains repeated passages',
        'Repetition is contextual: it may be intentional interface copy or may obscure the page-specific content.',
        'Review the cited repeated passages and remove duplication only when it does not serve the page.',
        `${detail} ${documentStructure.repeatedText.map((item) => `${item.count}× “${item.text}”`).join(' · ')}`
      )
    if (documentStructure.visibleTextCharacters < 200)
      return finding(
        this,
        'opportunity',
        'Rendered page has little visible text',
        'Short pages can be entirely legitimate; this measurement only highlights limited descriptive context.',
        'Confirm the visible content is sufficient for this page’s purpose; no universal minimum is required.',
        detail
      )
    return finding(
      this,
      'passed',
      'Rendered content measurements are available',
      'Descriptive measurements provide context without scoring keywords or prose quality.',
      null,
      detail
    )
  }
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
  socialImagesRule,
  structuredDataStandardsRule,
  structuredDataRelationshipsRule,
  searchEnhancementEligibilityRule,
  documentLanguageRule,
  primaryHeadingRule,
  headingHierarchyRule,
  pageLandmarksRule,
  contentSignalsRule
]
