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
  return {
    title: titleEl ? (titleEl.textContent ?? '') : null
  };
})()`

/**
 * Narrow an untyped pane-evaluation result into a {@link RenderedAuditSnapshot},
 * tolerating a malformed payload (e.g. an evaluation that returned nothing).
 */
export function normalizeRenderedSnapshot(raw: unknown): RenderedAuditSnapshot {
  const value = (raw ?? {}) as Partial<RenderedAuditSnapshot>
  return {
    title: typeof value.title === 'string' ? value.title : null
  }
}
