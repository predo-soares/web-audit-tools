import { finding } from './finding'
import type { Rule } from './rule-types'

export const hreflangSyntaxRule: Rule = {
  id: 'internationalization/hreflang-syntax',
  category: 'internationalization',
  evaluate({ internationalization }) {
    const invalid = internationalization.declarations.filter(
      (item) => item.hreflang.toLowerCase() !== 'x-default' && !validLocale(item.hreflang)
    )
    const duplicates = internationalization.declarations.filter(
      (item, index, all) =>
        all.findIndex((other) => other.hreflang.toLowerCase() === item.hreflang.toLowerCase()) !==
        index
    )
    if (invalid.length || duplicates.length)
      return finding(
        this,
        'error',
        'Alternate locale declarations are invalid or duplicated',
        'Invalid or conflicting locale identifiers make alternate targeting ambiguous.',
        'Use unique BCP 47 hreflang values, plus at most one x-default.',
        `Invalid: ${invalid.map((item) => item.hreflang).join(', ') || 'none'} · duplicate: ${duplicates.map((item) => item.hreflang).join(', ') || 'none'}.`
      )
    return finding(
      this,
      'passed',
      'Alternate locale declarations are syntactically valid',
      'Declared locales and x-default are unique and recognizable.',
      null,
      `${internationalization.declarations.length} local declaration(s) checked.`
    )
  }
}
export const hreflangRelationshipsRule: Rule = {
  id: 'internationalization/hreflang-relationships',
  category: 'internationalization',
  evaluate({ internationalization, documentStructure, searchAppearance }) {
    if (!internationalization.declarations.length)
      return finding(
        this,
        'opportunity',
        'No alternate locales are declared',
        'Alternates are only needed when equivalent localized pages exist.',
        null,
        'No rendered hreflang declarations.'
      )
    const current = searchAppearance.resolved.canonical.value
    const self = internationalization.declarations.some((item) => item.resolvedHref === current)
    const lang = documentStructure.language.lang?.toLowerCase()
    const matched =
      !lang ||
      internationalization.declarations.some(
        (item) =>
          item.hreflang.toLowerCase() === lang || item.hreflang.toLowerCase().startsWith(`${lang}-`)
      )
    if (!self || !matched)
      return finding(
        this,
        'warning',
        'Alternate set conflicts with local page signals',
        'A localized alternate set should identify the current canonical page and align with its document language.',
        'Add a self-referencing alternate and align the page language with a declared locale.',
        `Self reference: ${self}; document language ${lang ?? 'missing'} represented: ${matched}.`
      )
    return finding(
      this,
      'passed',
      'Alternate set aligns with local page signals',
      'The current canonical and document language are represented locally.',
      null,
      `${internationalization.localeMetadata.length} locale metadata value(s); canonical ${current}.`
    )
  }
}
export const hreflangReciprocalRule: Rule = {
  id: 'internationalization/reciprocal-targets',
  category: 'internationalization',
  evaluate({ internationalization }) {
    const unavailable = internationalization.targets.filter((item) => !item.available)
    if (unavailable.length)
      return finding(
        this,
        'unable-to-verify',
        'Some alternate returns could not be verified',
        'Blocked or timed-out direct targets leave reciprocal relationships unknown.',
        null,
        unavailable.map((item) => `${item.hreflang}: ${item.unavailableReason}`).join(' · ')
      )
    const missing = internationalization.targets.filter((item) => !item.reciprocal)
    if (missing.length)
      return finding(
        this,
        'warning',
        'Some alternates do not return to this page',
        'Missing reciprocal declarations can prevent search systems from accepting the locale relationship.',
        'Add a matching alternate link back to this page on each directly declared target.',
        missing.map((item) => `${item.hreflang} ${item.finalUrl ?? item.url}`).join(' · ')
      )
    return finding(
      this,
      'passed',
      'Direct alternate targets return reciprocally',
      'Each available directly declared target links back to the audited page.',
      null,
      `${internationalization.targets.length} bounded one-hop target check(s); no alternates traversed.`
    )
  }
}

function validLocale(value: string): boolean {
  try {
    new Intl.Locale(value)
    return /^[a-z]{2,3}(?:-[A-Za-z]{2}|-[A-Za-z]{4})?(?:-[A-Za-z]{2}|-\d{3})?$/.test(value)
  } catch {
    return false
  }
}
