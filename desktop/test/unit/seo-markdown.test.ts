import { describe, expect, it } from 'vitest'
import { auditMarkdown } from '../../src/shared/seo-markdown'
import type { AuditResult, Finding } from '../../src/shared/seo-audit'

const error: Finding = {
  ruleId: 'search-appearance/title-present',
  category: 'search-appearance',
  outcome: 'error',
  summary: 'Page has no title',
  impact: 'The page is hard to identify.',
  remediation: 'Add a descriptive title.',
  evidence: { origin: 'rendered', detail: 'No title element.' }
}
const passed: Finding = {
  ruleId: 'links/inventory',
  category: 'links',
  outcome: 'passed',
  summary: 'Links available',
  impact: 'Links are inspectable.',
  remediation: null,
  evidence: { origin: 'rendered', detail: 'Two anchors.' }
}
const result = {
  url: 'https://site.test/page?token=%5BREDACTED%5D',
  ruleCatalogVersion: 'test.1',
  indexingIntent: 'indexable',
  completedAt: 1,
  findings: [error, passed],
  searchAppearance: {
    declared: [{ origin: 'rendered', kind: 'title', order: 0, value: 'Page', source: '<title>' }]
  }
} as AuditResult

describe('agent-ready audit Markdown', () => {
  it('exports the complete result with stable fields, attribution, and declared evidence', () => {
    const markdown = auditMarkdown(result)
    expect(markdown).toContain('Rule ID: `search-appearance/title-present`')
    expect(markdown).toContain('Google Search gallery compatibility model')
    expect(markdown).toContain('rendered title #1: Page')
    expect(markdown).toContain('%5BREDACTED%5D')
  })

  it('scopes exports to one category or finding', () => {
    expect(auditMarkdown(result, { category: 'links' })).toContain('`links/inventory`')
    expect(auditMarkdown(result, { category: 'links' })).not.toContain('title-present')
    const single = auditMarkdown(result, { finding: error })
    expect(single).toContain('Add a descriptive title.')
    expect(single).not.toContain('Declared metadata evidence')
  })
})
