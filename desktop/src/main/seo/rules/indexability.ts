import type { Finding } from '../../../shared/seo-audit'
import { finding } from './finding'
import type { Rule } from './rule-types'

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
