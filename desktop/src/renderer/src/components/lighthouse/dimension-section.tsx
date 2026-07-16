import type {
  LighthouseAssessmentResult,
  LighthouseAuditDetail,
  LighthouseCategory
} from '../../../../shared/lighthouse'
import { AuditBucket } from './audits/audit-bucket'
import { MetricsGrid } from './audits/metrics-grid'
import { ScoreGauge } from './score/score-gauge'
import { ScoreLegend } from './score/score-legend'
import { classifyAudit, CORE_METRIC_SET, type AuditBucketId } from './lib/audits'

const CATEGORY_BLURB: Record<string, string> = {
  performance:
    'Values are estimated and may vary. The performance score is calculated directly from these metrics.',
  accessibility:
    'These checks highlight opportunities to improve the accessibility of your web app. Automatic detection can only detect a subset of issues and does not guarantee the accessibility of your web app.',
  'best-practices':
    'These checks highlight opportunities to improve best practices around security, standards, and user experience.',
  seo: 'These checks ensure that your page is following basic search engine optimization advice. Many additional factors affect your search ranking, including Google’s assessment of whether your site is trustworthy.'
}

export function DimensionSection({
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

  const blurb =
    CATEGORY_BLURB[category.id] ??
    `These checks highlight opportunities to improve ${category.title.toLowerCase()}.`

  return (
    <section
      id={`lighthouse-dimension-${category.id}`}
      data-testid={`lighthouse-dimension-${category.id}`}
      className="rounded-xl border border-white/10 bg-black/40 px-5 py-8 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <ScoreGauge category={category} size="lg" centered />
        <h2 className="mt-4 text-xl font-semibold text-white">{category.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/45">{blurb}</p>
        <div className="mt-4">
          <ScoreLegend />
        </div>
      </div>

      {category.id === 'performance' ? <MetricsGrid result={result} /> : null}

      <div className="mt-6">
        <AuditBucket bucket="failed" audits={buckets.failed} auditGroups={result.auditGroups} />
        <AuditBucket bucket="manual" audits={buckets.manual} auditGroups={result.auditGroups} />
        <AuditBucket bucket="passed" audits={buckets.passed} auditGroups={result.auditGroups} />
        <AuditBucket
          bucket="notApplicable"
          audits={buckets.notApplicable}
          auditGroups={result.auditGroups}
        />
      </div>
    </section>
  )
}
