import type { RenderedAuditSnapshot } from '../../shared/seo-audit'

/**
 * JavaScript evaluated inside the active pane to collect rendered evidence
 * without mutating or reloading the page (ADR 0008). It must be a
 * self-contained expression — no closures over main-process scope — because it
 * is serialized and executed in the page context. It returns a
 * {@link RenderedAuditSnapshot}; keep the shape in sync with that contract.
 *
 * Title semantics: `null` when there is no `<title>` element at all, the raw
 * text (which may be empty or whitespace) otherwise. `document.title` alone
 * cannot distinguish "no element" from "empty element", so read the element.
 */
export const RENDERED_EXTRACTION_EXPRESSION = `(() => {
  const titleEl = document.querySelector('head > title, title');
  const descriptions = Array.from(document.querySelectorAll('meta[name]'))
    .filter((el) => (el.getAttribute('name') || '').toLowerCase() === 'description')
    .map((el) => el.getAttribute('content') ?? '');
  const robots = Array.from(document.querySelectorAll('meta[name]'))
    .filter((el) => ['robots', 'googlebot'].includes((el.getAttribute('name') || '').toLowerCase()))
    .map((el) => el.getAttribute('content') ?? '');
  const canonicals = Array.from(document.querySelectorAll('link[rel]'))
    .filter((el) => (el.getAttribute('rel') || '').toLowerCase().split(/\\s+/).includes('canonical'))
    .map((el) => el.getAttribute('href') ?? '');
  const favicons = Array.from(document.querySelectorAll('link[rel]'))
    .filter((el) => {
      const rel = (el.getAttribute('rel') || '').toLowerCase().split(/\\s+/);
      return rel.includes('icon') || rel.includes('shortcut') && rel.includes('icon');
    })
    .map((el) => el.getAttribute('href') ?? '');
  const sitemapLinks = Array.from(document.querySelectorAll('link[rel]'))
    .filter((el) => (el.getAttribute('rel') || '').toLowerCase().split(/\\s+/).includes('sitemap'))
    .map((el) => el.getAttribute('href') ?? '');
  const social = Array.from(document.querySelectorAll('meta[property], meta[name]'))
    .map((el) => ({
      property: (el.getAttribute('property') || el.getAttribute('name') || '').toLowerCase(),
      value: el.getAttribute('content') ?? ''
    }))
    .filter((item) => item.property.startsWith('og:') || item.property.startsWith('twitter:'));
  const structuredSources = [];
  Array.from(document.querySelectorAll('script[type="application/ld+json"]')).forEach((el, sourceIndex) => {
    structuredSources.push({ format: 'json-ld', sourceIndex, raw: el.textContent ?? '' });
  });
  Array.from(document.querySelectorAll('[itemscope]')).forEach((root, sourceIndex) => {
    const properties = {};
    Array.from(root.querySelectorAll('[itemprop]')).forEach((el) => {
      if (el.closest('[itemscope]') !== root) return;
      const name = el.getAttribute('itemprop') || '';
      const value = el.getAttribute('content') || el.getAttribute('href') || el.getAttribute('src') || (el.textContent || '').trim();
      if (!properties[name]) properties[name] = [];
      properties[name].push(value);
    });
    const entity = { '@type': (root.getAttribute('itemtype') || '').split(/\\s+/).filter(Boolean), properties };
    if (root.hasAttribute('itemid')) entity['@id'] = root.getAttribute('itemid');
    structuredSources.push({ format: 'microdata', sourceIndex, raw: JSON.stringify(entity) });
  });
  Array.from(document.querySelectorAll('[typeof]')).forEach((root, sourceIndex) => {
    const properties = {};
    Array.from(root.querySelectorAll('[property]')).forEach((el) => {
      if (el.closest('[typeof]') !== root) return;
      const name = el.getAttribute('property') || '';
      const value = el.getAttribute('content') || el.getAttribute('resource') || el.getAttribute('href') || (el.textContent || '').trim();
      if (!properties[name]) properties[name] = [];
      properties[name].push(value);
    });
    const entity = { '@type': (root.getAttribute('typeof') || '').split(/\\s+/).filter(Boolean), properties };
    const id = root.getAttribute('resource') || root.getAttribute('about');
    if (id !== null) entity['@id'] = id;
    structuredSources.push({ format: 'rdfa', sourceIndex, raw: JSON.stringify(entity) });
  });
  const measure = (text, font) => {
    if (!text) return 0;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.font = font;
    return Math.round(context.measureText(text).width);
  };
  const title = titleEl ? (titleEl.textContent ?? '') : null;
  return {
    title,
    descriptions,
    canonicals,
    favicons,
    robots,
    sitemapLinks,
    social,
    structuredSources,
    titleWidthPx: title === null ? null : measure(title.trim(), '20px Arial'),
    descriptionWidthsPx: descriptions.map((value) => measure(value.trim(), '14px Arial') ?? 0)
  };
})()`

/**
 * Narrow an untyped pane-evaluation result into a {@link RenderedAuditSnapshot},
 * tolerating a malformed payload (e.g. an evaluation that returned nothing).
 */
export function normalizeRenderedSnapshot(raw: unknown): RenderedAuditSnapshot {
  const value = (raw ?? {}) as Partial<RenderedAuditSnapshot>
  return {
    title: typeof value.title === 'string' ? value.title : null,
    descriptions: stringArray(value.descriptions),
    canonicals: stringArray(value.canonicals),
    favicons: stringArray(value.favicons),
    robots: stringArray(value.robots),
    sitemapLinks: stringArray(value.sitemapLinks),
    social: socialArray(value.social),
    structuredSources: structuredSourceArray(value.structuredSources),
    titleWidthPx: typeof value.titleWidthPx === 'number' ? value.titleWidthPx : null,
    descriptionWidthsPx: numberArray(value.descriptionWidthsPx)
  }
}

function structuredSourceArray(value: unknown): RenderedAuditSnapshot['structuredSources'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as { format?: unknown; sourceIndex?: unknown; raw?: unknown }
    if (
      !['json-ld', 'microdata', 'rdfa'].includes(String(candidate.format)) ||
      typeof candidate.sourceIndex !== 'number' ||
      typeof candidate.raw !== 'string'
    )
      return []
    return [
      {
        format: candidate.format as 'json-ld' | 'microdata' | 'rdfa',
        sourceIndex: candidate.sourceIndex,
        raw: candidate.raw
      }
    ]
  })
}

function socialArray(value: unknown): { property: string; value: string }[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const property = (item as { property?: unknown }).property
    const content = (item as { value?: unknown }).value
    return typeof property === 'string' && typeof content === 'string'
      ? [{ property, value: content }]
      : []
  })
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number')
    : []
}
