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
  const canonicals = Array.from(document.querySelectorAll('link[rel]'))
    .filter((el) => (el.getAttribute('rel') || '').toLowerCase().split(/\\s+/).includes('canonical'))
    .map((el) => el.getAttribute('href') ?? '');
  const favicons = Array.from(document.querySelectorAll('link[rel]'))
    .filter((el) => {
      const rel = (el.getAttribute('rel') || '').toLowerCase().split(/\\s+/);
      return rel.includes('icon') || rel.includes('shortcut') && rel.includes('icon');
    })
    .map((el) => el.getAttribute('href') ?? '');
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
    titleWidthPx: typeof value.titleWidthPx === 'number' ? value.titleWidthPx : null,
    descriptionWidthsPx: numberArray(value.descriptionWidthsPx)
  }
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
