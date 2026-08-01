import type { LighthouseAssessmentResult, LighthouseCategory } from '../../../../shared/lighthouse'
import { DimensionAudits } from './audits/dimension-audits'
import { ScoreGauge } from './score/score-gauge'
import { ScoreLegend } from './score/score-legend'

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

      <div className="mt-6">
        <DimensionAudits category={category} result={result} />
      </div>
    </section>
  )
}
