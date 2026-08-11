/**
 * The Rule catalog for a Page SEO audit. Rules are grouped into one module per
 * audit category; `SEO_RULES` assembles them in display order. Later slices add
 * a rule to its category module and append it here.
 */
export type { Rule, RuleContext } from './rule-types'
export { finding } from './finding'

export {
  hreflangSyntaxRule,
  hreflangRelationshipsRule,
  hreflangReciprocalRule
} from './internationalization'
export {
  titlePresenceRule,
  titleHydrationRule,
  descriptionPresenceRule,
  canonicalRule,
  metadataDeclarationsRule,
  searchSnippetLengthRule
} from './metadata'
export {
  indexabilityStatusRule,
  indexabilityRedirectRule,
  indexabilityDirectivesRule,
  indexabilityCanonicalTargetRule,
  indexabilityRobotsTxtRule,
  indexabilitySitemapsRule
} from './indexability'
export { socialMetadataRule, socialDeclarationsRule, socialImagesRule } from './social'
export {
  structuredDataStandardsRule,
  structuredDataRelationshipsRule,
  searchEnhancementEligibilityRule
} from './structured-data'
export {
  documentLanguageRule,
  primaryHeadingRule,
  headingHierarchyRule,
  pageLandmarksRule,
  contentSignalsRule
} from './document-structure'
export { linkNamesRule, linkDestinationsRule, linkDirectivesRule, linkInventoryRule } from './links'
export {
  imageAlternativesRule,
  imageSourcesRule,
  imageDimensionsRule,
  responsiveMediaRule
} from './images-media'

import type { Rule } from './rule-types'
import {
  hreflangSyntaxRule,
  hreflangRelationshipsRule,
  hreflangReciprocalRule
} from './internationalization'
import {
  titlePresenceRule,
  titleHydrationRule,
  descriptionPresenceRule,
  canonicalRule,
  metadataDeclarationsRule,
  searchSnippetLengthRule
} from './metadata'
import {
  indexabilityStatusRule,
  indexabilityRedirectRule,
  indexabilityDirectivesRule,
  indexabilityCanonicalTargetRule,
  indexabilityRobotsTxtRule,
  indexabilitySitemapsRule
} from './indexability'
import { socialMetadataRule, socialDeclarationsRule, socialImagesRule } from './social'
import {
  structuredDataStandardsRule,
  structuredDataRelationshipsRule,
  searchEnhancementEligibilityRule
} from './structured-data'
import {
  documentLanguageRule,
  primaryHeadingRule,
  headingHierarchyRule,
  pageLandmarksRule,
  contentSignalsRule
} from './document-structure'
import { linkNamesRule, linkDestinationsRule, linkDirectivesRule, linkInventoryRule } from './links'
import {
  imageAlternativesRule,
  imageSourcesRule,
  imageDimensionsRule,
  responsiveMediaRule
} from './images-media'

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
  contentSignalsRule,
  linkNamesRule,
  linkDestinationsRule,
  linkDirectivesRule,
  linkInventoryRule,
  imageAlternativesRule,
  imageSourcesRule,
  imageDimensionsRule,
  responsiveMediaRule,
  hreflangSyntaxRule,
  hreflangRelationshipsRule,
  hreflangReciprocalRule
]
