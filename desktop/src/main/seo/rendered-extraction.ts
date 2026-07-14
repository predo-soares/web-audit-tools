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
  const isVisible = (el) => {
    const style = window.getComputedStyle(el);
    return !el.hidden && el.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
  };
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((el, sourceIndex) => ({
    level: Number(el.tagName.slice(1)),
    text: (el.textContent || '').trim(),
    accessibleName: (el.getAttribute('aria-label') || el.textContent || '').trim(),
    visible: isVisible(el),
    sourceIndex
  }));
  const landmarks = Array.from(document.querySelectorAll('main, nav, header, footer, aside, [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]')).map((el, sourceIndex) => ({
    role: el.getAttribute('role') || ({ MAIN: 'main', NAV: 'navigation', HEADER: 'banner', FOOTER: 'contentinfo', ASIDE: 'complementary' }[el.tagName] || el.tagName.toLowerCase()),
    accessibleName: (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') ? document.getElementById(el.getAttribute('aria-labelledby'))?.textContent : '') || '').trim(),
    visible: isVisible(el),
    textCharacters: (el.textContent || '').replace(/\\s+/g, ' ').trim().length,
    sourceIndex
  }));
  const visibleText = (document.body?.innerText || '').replace(/\\s+/g, ' ').trim();
  const repeated = {};
  visibleText.split(/[.!?]+/).map((text) => text.trim()).filter((text) => text.length >= 20).forEach((text) => { repeated[text] = (repeated[text] || 0) + 1; });
  const documentStructure = {
    language: { lang: document.documentElement.getAttribute('lang'), xmlLang: document.documentElement.getAttribute('xml:lang') },
    headings,
    landmarks,
    visibleTextCharacters: visibleText.length,
    repeatedText: Object.entries(repeated).filter(([, count]) => count > 1).map(([text, count]) => ({ text, count })).slice(0, 10)
  };
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
    documentStructure,
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
    documentStructure: documentStructureValue(value.documentStructure),
    titleWidthPx: typeof value.titleWidthPx === 'number' ? value.titleWidthPx : null,
    descriptionWidthsPx: numberArray(value.descriptionWidthsPx)
  }
}

function documentStructureValue(value: unknown): RenderedAuditSnapshot['documentStructure'] {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<NonNullable<RenderedAuditSnapshot['documentStructure']>>
  const language = (
    candidate.language && typeof candidate.language === 'object' ? candidate.language : {}
  ) as { lang?: unknown; xmlLang?: unknown }
  return {
    language: {
      lang: typeof language.lang === 'string' ? language.lang : null,
      xmlLang: typeof language.xmlLang === 'string' ? language.xmlLang : null
    },
    headings: Array.isArray(candidate.headings)
      ? candidate.headings.filter(
          (item) =>
            item &&
            typeof item.level === 'number' &&
            typeof item.text === 'string' &&
            typeof item.accessibleName === 'string' &&
            typeof item.visible === 'boolean' &&
            typeof item.sourceIndex === 'number'
        )
      : [],
    landmarks: Array.isArray(candidate.landmarks)
      ? candidate.landmarks.filter(
          (item) =>
            item &&
            typeof item.role === 'string' &&
            typeof item.accessibleName === 'string' &&
            typeof item.visible === 'boolean' &&
            typeof item.textCharacters === 'number' &&
            typeof item.sourceIndex === 'number'
        )
      : [],
    visibleTextCharacters:
      typeof candidate.visibleTextCharacters === 'number' ? candidate.visibleTextCharacters : 0,
    repeatedText: Array.isArray(candidate.repeatedText)
      ? candidate.repeatedText.filter(
          (item) => item && typeof item.text === 'string' && typeof item.count === 'number'
        )
      : []
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
