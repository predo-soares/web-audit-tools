import type { Finding, LinkEvidence } from '../../../shared/seo-audit'
import { finding } from './finding'
import type { Rule } from './rule-types'

export const linkNamesRule: Rule = {
  id: 'links/names-descriptive',
  category: 'links',
  evaluate({ links }): Finding {
    const visible = links.filter((link) => link.visible)
    const unnamed = visible.filter((link) => !link.accessibleName)
    if (unnamed.length)
      return finding(
        this,
        'warning',
        'Some visible links have no accessible name',
        'Unnamed anchors do not communicate their destination or purpose.',
        'Add concise visible text, an accurate image alt, or an accessible name to each cited anchor.',
        linkSources(unnamed)
      )
    const generic = visible.filter((link) =>
      /^(click here|here|read more|learn more|more)$/i.test(link.accessibleName)
    )
    if (generic.length)
      return finding(
        this,
        'opportunity',
        'Some link names lack destination context',
        'Generic text can be ambiguous when links are read outside the surrounding paragraph.',
        'Use link text that describes the destination when the surrounding context does not already make it clear.',
        `${linkSources(generic)} Names: ${generic.map((link) => `“${link.accessibleName}”`).join(', ')}.`
      )
    return finding(
      this,
      'passed',
      'Visible links have usable names',
      'Each visible anchor exposes text or an accessible name.',
      null,
      `${visible.length} visible anchor(s) checked; ${links.length - visible.length} hidden responsive anchor(s) retained in the inventory.`
    )
  }
}

export const linkDestinationsRule: Rule = {
  id: 'links/destinations-valid',
  category: 'links',
  evaluate({ links }): Finding {
    const unsafe = links.filter((link) => link.kind === 'javascript')
    if (unsafe.length)
      return finding(
        this,
        'error',
        'JavaScript pseudo-links are not crawlable',
        'javascript: destinations do not expose an ordinary discoverable URL and can execute page code.',
        'Use a real anchor destination for navigation and a button for page actions.',
        linkSources(unsafe)
      )
    const missing = links.filter((link) => link.kind === 'missing-destination')
    const brokenFragments = links.filter(
      (link) => link.kind === 'fragment' && link.fragmentTargetExists === false
    )
    const other = links.filter((link) => link.kind === 'other-scheme')
    if (missing.length || brokenFragments.length || other.length)
      return finding(
        this,
        'warning',
        'Some link destinations are not ordinarily discoverable',
        'Missing, unsupported, or unresolved destinations cannot be followed as ordinary document links.',
        'Give navigational anchors valid destinations; keep script-driven actions as buttons and repair unresolved fragments.',
        `${missing.length} missing/script-driven · ${brokenFragments.length} unresolved fragments · ${other.length} other schemes. ${linkSources([...missing, ...brokenFragments, ...other])}`
      )
    return finding(
      this,
      'passed',
      'Link destinations are classifiable',
      'Every anchor has a contextual destination classification without crawling it.',
      null,
      linkKindCounts(links)
    )
  }
}

export const linkDirectivesRule: Rule = {
  id: 'links/directives-consistent',
  category: 'links',
  evaluate({ links }): Finding {
    const malformed = links.filter(
      (link) => /[,;]/.test(link.rawRel) || link.rel.some((token) => !/^[a-z0-9-]+$/.test(token))
    )
    const conflicting = links.filter(
      (link) => link.rel.includes('follow') && link.rel.includes('nofollow')
    )
    if (malformed.length || conflicting.length)
      return finding(
        this,
        'warning',
        'Some link relationship directives are malformed or conflicting',
        'Ambiguous rel tokens can prevent consumers from interpreting the intended relationship.',
        'Use space-separated rel tokens and remove contradictory follow/nofollow declarations.',
        `${malformed.length} malformed · ${conflicting.length} conflicting. ${linkSources([...malformed, ...conflicting])}`
      )
    const intentionallyNotFollowed = links.filter((link) => link.rel.includes('nofollow'))
    return finding(
      this,
      'passed',
      'Link relationship directives are consistent',
      'Intentional nofollow, sponsored, and ugc relationships are preserved as context rather than treated as generic failures.',
      null,
      `${intentionallyNotFollowed.length} intentionally non-followed link(s); ${links.filter((link) => link.rel.includes('sponsored')).length} sponsored; ${links.filter((link) => link.rel.includes('ugc')).length} ugc.`
    )
  }
}

export const linkInventoryRule: Rule = {
  id: 'links/inventory',
  category: 'links',
  evaluate({ links, indexability }): Finding {
    const destinations = links
      .map((link) => link.resolvedHref)
      .filter((value): value is string => Boolean(value))
    const duplicates = destinations.length - new Set(destinations).size
    const canonicalReference = indexability.canonical
      ? ` Existing canonical verification: ${indexability.canonical.status ?? indexability.canonical.unavailableReason ?? 'unknown'}; no duplicate request was made.`
      : ''
    return finding(
      this,
      duplicates ? 'opportunity' : 'passed',
      duplicates
        ? 'Rendered page repeats some link destinations'
        : 'Rendered link inventory is available',
      duplicates
        ? 'Repeated destinations can be intentional navigation or redundant links depending on context.'
        : 'The inventory describes discoverability without crawling ordinary internal or external targets.',
      duplicates ? 'Review repeated links only where they add no navigational value.' : null,
      `${links.length} anchors · ${duplicates} repeated destination occurrence(s). ${linkKindCounts(links)}${canonicalReference}`
    )
  }
}

function linkSources(links: LinkEvidence[]): string {
  return `Anchor source(s): ${[...new Set(links.map((link) => link.sourceIndex))].slice(0, 12).join(', ') || 'none'}.`
}

function linkKindCounts(links: LinkEvidence[]): string {
  const counts = new Map<string, number>()
  links.forEach((link) => counts.set(link.kind, (counts.get(link.kind) ?? 0) + 1))
  return [...counts].map(([kind, count]) => `${kind}: ${count}`).join(' · ') || 'No anchors found.'
}
