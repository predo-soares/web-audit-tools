import type { Finding } from '../../../shared/seo-audit'
import { finding } from './finding'
import type { Rule } from './rule-types'

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
