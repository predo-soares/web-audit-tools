import {
  CATEGORY_LABEL,
  OUTCOME_LABEL,
  SEARCH_ENHANCEMENT_PROFILE_VERSION,
  type AuditCategory,
  type AuditResult,
  type Finding
} from './seo-audit'

export function auditMarkdown(
  result: AuditResult,
  options: { category?: AuditCategory; finding?: Finding } = {}
): string {
  const findings = options.finding
    ? [options.finding]
    : result.findings.filter((item) => !options.category || item.category === options.category)
  const scope = options.finding
    ? options.finding.ruleId
    : options.category
      ? CATEGORY_LABEL[options.category]
      : 'Complete result'
  const lines = [
    `# Page SEO audit — ${scope}`,
    '',
    `- URL: ${result.url}`,
    `- Rule catalog: ${result.ruleCatalogVersion}`,
    `- Indexing intent: ${result.indexingIntent}`,
    `- Completed: ${new Date(result.completedAt).toISOString()}`,
    `- Search enhancement profile: ${SEARCH_ENHANCEMENT_PROFILE_VERSION} (Google Search gallery compatibility model)`,
    '',
    '## Findings',
    ''
  ]
  for (const finding of findings)
    lines.push(
      `### ${finding.summary}`,
      '',
      `- Rule ID: \`${finding.ruleId}\``,
      `- Category: ${CATEGORY_LABEL[finding.category]}`,
      `- Outcome: ${OUTCOME_LABEL[finding.outcome]}`,
      `- Impact: ${finding.impact}`,
      `- Evidence (${finding.evidence.origin}): ${finding.evidence.detail}`,
      `- Remediation: ${finding.remediation ?? 'No action required.'}`,
      ''
    )
  if (!options.finding)
    lines.push(
      '## Declared metadata evidence',
      '',
      ...result.searchAppearance.declared.map(
        (item) => `- ${item.origin} ${item.kind} #${item.order + 1}: ${item.value || '(empty)'}`
      ),
      ''
    )
  return lines.join('\n')
}
