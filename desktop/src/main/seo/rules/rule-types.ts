import type {
  AuditAccessContext,
  AuditCategory,
  DeliveredEvidence,
  DocumentStructureEvidence,
  Finding,
  IndexingIntent,
  IndexabilityResult,
  ImagesMediaEvidence,
  InternationalizationResult,
  LinkEvidence,
  RenderedAuditSnapshot,
  SearchAppearanceResult,
  SocialSharingResult,
  StructuredDataResult
} from '../../../shared/seo-audit'

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
  links: LinkEvidence[]
  imagesMedia: ImagesMediaEvidence
  internationalization: InternationalizationResult
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
