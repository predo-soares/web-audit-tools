import type {
  LighthouseAssessmentResult,
  LighthouseAuditDetail,
  LighthouseCategory
} from '../../../../../shared/lighthouse'
import { AuditBucket } from './audit-bucket'
import { classifyAudit, CORE_METRIC_SET, type AuditBucketId } from '../lib/audits'

// The audit "insights" for a category: failed/manual/passed/not-applicable
// buckets. Shared by the dimension sections and the results summary.
export function DimensionAudits({
  category,
  result
}: {
  category: LighthouseCategory
  result: LighthouseAssessmentResult
}): React.JSX.Element {
  const audits = category.auditIds
    .map((id) => result.audits[id])
    .filter((audit): audit is LighthouseAuditDetail => {
      if (!audit) return false
      // Core metrics are surfaced separately (metrics grid / overview ring).
      if (category.id === 'performance' && CORE_METRIC_SET.has(audit.id)) return false
      return true
    })

  const buckets: Record<AuditBucketId, LighthouseAuditDetail[]> = {
    failed: [],
    manual: [],
    passed: [],
    notApplicable: []
  }
  for (const audit of audits) {
    buckets[classifyAudit(audit)].push(audit)
  }

  return (
    <div>
      <AuditBucket bucket="failed" audits={buckets.failed} auditGroups={result.auditGroups} />
      <AuditBucket bucket="manual" audits={buckets.manual} auditGroups={result.auditGroups} />
      <AuditBucket bucket="passed" audits={buckets.passed} auditGroups={result.auditGroups} />
      <AuditBucket
        bucket="notApplicable"
        audits={buckets.notApplicable}
        auditGroups={result.auditGroups}
      />
    </div>
  )
}
