import type { Finding, StructuredDataResult } from '../../../shared/seo-audit'
import { finding } from './finding'
import type { Rule } from './rule-types'

export const structuredDataStandardsRule: Rule = {
  id: 'structured-data/standards-valid',
  category: 'structured-data',
  evaluate({ structuredData }): Finding {
    if (structuredData.sources.length === 0) {
      return finding(
        this,
        'opportunity',
        'No structured data detected',
        'Structured data can make page entities machine-readable.',
        'Add relevant JSON-LD, Microdata, or RDFa when the page represents a supported entity.',
        'No structured-data sources were found in the rendered page.'
      )
    }
    const errors = structuredData.problems.filter((problem) => problem.severity === 'error')
    const warnings = structuredData.problems.filter((problem) => problem.severity === 'warning')
    if (errors.length)
      return finding(
        this,
        'error',
        'Structured data has standards errors',
        'Invalid syntax or value shapes can prevent consumers from reading affected entities.',
        'Fix the cited syntax and value-shape errors, then validate the rendered markup again.',
        describeProblems(errors)
      )
    if (warnings.length)
      return finding(
        this,
        'warning',
        'Structured data has relationship warnings',
        'Broken or conflicting identifiers can make entity relationships ambiguous.',
        'Resolve the cited identifiers and entity references.',
        describeProblems(warnings)
      )
    return finding(
      this,
      'passed',
      'Structured data is parseable',
      'The detected sources use inspectable syntax and entity shapes.',
      null,
      `${structuredData.sources.length} source(s) produced ${structuredData.entities.length} inspectable entity or entities.`
    )
  }
}

export const structuredDataRelationshipsRule: Rule = {
  id: 'structured-data/relationships-valid',
  category: 'structured-data',
  evaluate({ structuredData }): Finding {
    if (!structuredData.entities.length)
      return finding(
        this,
        'unable-to-verify',
        'Entity relationships could not be checked',
        'No parseable entities were available for relationship validation.',
        null,
        'Relationship validation requires at least one parseable entity.'
      )
    const relationshipProblems = structuredData.problems.filter((problem) =>
      /Reference|Conflicting/.test(problem.message)
    )
    return relationshipProblems.length
      ? finding(
          this,
          'warning',
          'Structured data relationships are ambiguous',
          'Unresolved or conflicting identifiers can split what should be one entity graph.',
          'Give repeated entities consistent data and make every local @id reference resolve.',
          describeProblems(relationshipProblems)
        )
      : finding(
          this,
          'passed',
          'Structured data relationships resolve',
          'No broken local references or conflicting repeated identifiers were detected.',
          null,
          `${structuredData.entities.length} entity or entities checked.`
        )
  }
}

export const searchEnhancementEligibilityRule: Rule = {
  id: 'structured-data/search-enhancement-eligibility',
  category: 'structured-data',
  evaluate({ structuredData }): Finding {
    const supported = structuredData.enhancements.filter((item) => item.status !== 'not-supported')
    if (!structuredData.entities.length)
      return finding(
        this,
        'unable-to-verify',
        'Search enhancement eligibility could not be assessed',
        'There are no parseable typed entities to compare with the attributed profile.',
        null,
        'No parseable typed entities were available.'
      )
    if (!supported.length)
      return finding(
        this,
        'opportunity',
        'No attributed search enhancement profile applies',
        'Valid custom or unsupported vocabulary can still describe the page without qualifying for a known enhancement.',
        null,
        'Detected entity types are inspectable but are not covered by the current profile. This is not a standards error.'
      )
    const ineligible = supported.filter((item) => item.status === 'ineligible')
    if (ineligible.length)
      return finding(
        this,
        'warning',
        'Some entities appear ineligible for a search enhancement',
        'Required fields are missing under the attributed, versioned eligibility profile.',
        'Add the missing required fields where they accurately describe the page.',
        ineligible
          .map(
            (item) =>
              `${item.type} at ${item.entityPath}: missing ${item.missingRequired.join(', ')}`
          )
          .join(' · ')
      )
    const recommended = supported.flatMap((item) =>
      item.missingRecommended.map((field) => `${item.type}.${field}`)
    )
    return finding(
      this,
      'passed',
      'Entities appear eligible for a search enhancement',
      'Eligibility is based on an attributed, versioned profile and does not guarantee that a rich result will appear.',
      recommended.length
        ? 'Consider adding accurate recommended fields to make the entity more complete.'
        : null,
      `Profile ${supported[0].profileVersion}; missing recommended: ${recommended.join(', ') || 'none'}. Eligibility does not guarantee a rich result.`
    )
  }
}

function describeProblems(problems: StructuredDataResult['problems']): string {
  return problems
    .slice(0, 5)
    .map((problem) => `source ${problem.sourceIndex} ${problem.path}: ${problem.message}`)
    .join(' · ')
}
