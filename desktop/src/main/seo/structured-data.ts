import {
  SEARCH_ENHANCEMENT_PROFILE_VERSION,
  type RawStructuredSource,
  type SearchEnhancementAssessment,
  type StructuredDataProblem,
  type StructuredDataResult,
  type StructuredEntity
} from '../../shared/seo-audit'

const ENHANCEMENTS: Record<string, { required: string[]; recommended: string[] }> = {
  Product: { required: ['name'], recommended: ['image', 'description', 'offers'] },
  Article: { required: ['headline'], recommended: ['image', 'datePublished', 'author'] },
  BreadcrumbList: { required: ['itemListElement'], recommended: [] },
  FAQPage: { required: ['mainEntity'], recommended: [] },
  LocalBusiness: { required: ['name', 'address'], recommended: ['image', 'telephone'] },
  Event: { required: ['name', 'startDate', 'location'], recommended: ['image', 'offers'] },
  Recipe: { required: ['name', 'image'], recommended: ['recipeIngredient', 'recipeInstructions'] },
  VideoObject: {
    required: ['name', 'thumbnailUrl', 'uploadDate'],
    recommended: ['description', 'contentUrl']
  }
}

export function analyzeStructuredData(sources: RawStructuredSource[]): StructuredDataResult {
  const entities: StructuredEntity[] = []
  const problems: StructuredDataProblem[] = []
  for (const source of sources) {
    let parsed: unknown
    try {
      parsed = JSON.parse(source.raw)
    } catch (error) {
      problems.push({
        severity: 'error',
        sourceIndex: source.sourceIndex,
        path: '$',
        message: `Invalid ${source.format} syntax: ${error instanceof Error ? error.message : String(error)}`
      })
      continue
    }
    collect(parsed, source, '$', entities, problems)
  }
  validateRelationships(entities, problems)
  return { sources, entities, problems, enhancements: entities.flatMap(assessEntity) }
}

function collect(
  value: unknown,
  source: RawStructuredSource,
  path: string,
  entities: StructuredEntity[],
  problems: StructuredDataProblem[]
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collect(item, source, `${path}[${index}]`, entities, problems))
    return
  }
  if (!value || typeof value !== 'object') {
    problems.push({
      severity: 'error',
      sourceIndex: source.sourceIndex,
      path,
      message: 'Structured data root/entity must be an object or array.'
    })
    return
  }
  const object = value as Record<string, unknown>
  if (
    object['@context'] !== undefined &&
    typeof object['@context'] !== 'string' &&
    !Array.isArray(object['@context']) &&
    (typeof object['@context'] !== 'object' || object['@context'] === null)
  ) {
    problems.push({
      severity: 'error',
      sourceIndex: source.sourceIndex,
      path: `${path}.@context`,
      message: '@context must be a string, object, or array.'
    })
  }
  if (Array.isArray(object['@graph'])) {
    collect(object['@graph'], source, `${path}.@graph`, entities, problems)
  }
  const types = normalizeTypes(object['@type'])
  if (object['@type'] !== undefined && types.length === 0) {
    problems.push({
      severity: 'error',
      sourceIndex: source.sourceIndex,
      path: `${path}.@type`,
      message: '@type must be a string or an array of strings.'
    })
  }
  if (object['@id'] !== undefined && typeof object['@id'] !== 'string') {
    problems.push({
      severity: 'error',
      sourceIndex: source.sourceIndex,
      path: `${path}.@id`,
      message: '@id must be a string.'
    })
  }
  if (typeof object['@id'] === 'string' && !object['@id'].trim()) {
    problems.push({
      severity: 'error',
      sourceIndex: source.sourceIndex,
      path: `${path}.@id`,
      message: '@id must not be empty.'
    })
  }
  if (types.length || source.format !== 'json-ld') {
    const properties = (
      object.properties && typeof object.properties === 'object' ? object.properties : object
    ) as Record<string, unknown>
    entities.push({
      format: source.format,
      sourceIndex: source.sourceIndex,
      path,
      id: typeof object['@id'] === 'string' ? object['@id'] : null,
      types,
      properties
    })
  }
  for (const [key, nested] of Object.entries(object)) {
    if (key.startsWith('@') || key === 'properties') continue
    if (nested && typeof nested === 'object')
      collectNested(nested, source, `${path}.${key}`, entities, problems)
  }
}

function collectNested(
  value: unknown,
  source: RawStructuredSource,
  path: string,
  entities: StructuredEntity[],
  problems: StructuredDataProblem[]
): void {
  if (Array.isArray(value))
    value.forEach((item, index) =>
      collectNested(item, source, `${path}[${index}]`, entities, problems)
    )
  else if (value && typeof value === 'object' && ('@type' in value || '@graph' in value))
    collect(value, source, path, entities, problems)
}

function validateRelationships(
  entities: StructuredEntity[],
  problems: StructuredDataProblem[]
): void {
  const ids = new Map<string, StructuredEntity[]>()
  entities.forEach((entity) => {
    if (entity.id) ids.set(entity.id, [...(ids.get(entity.id) ?? []), entity])
  })
  for (const [id, duplicates] of ids) {
    if (
      duplicates.length > 1 &&
      new Set(duplicates.map((entity) => JSON.stringify([entity.types, entity.properties]))).size >
        1
    ) {
      problems.push({
        severity: 'warning',
        sourceIndex: duplicates[0].sourceIndex,
        path: duplicates[0].path,
        message: `Conflicting entities share @id ${id}.`
      })
    }
  }
  entities.forEach((entity) =>
    walkReferences(entity.properties, (id, path) => {
      if (!ids.has(id))
        problems.push({
          severity: 'warning',
          sourceIndex: entity.sourceIndex,
          path: `${entity.path}.${path}`,
          message: `Reference ${id} does not resolve to an entity in this page.`
        })
    })
  )
}

function walkReferences(
  value: unknown,
  report: (id: string, path: string) => void,
  path = ''
): void {
  if (Array.isArray(value))
    return value.forEach((item, index) => walkReferences(item, report, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return
  const object = value as Record<string, unknown>
  if (typeof object['@id'] === 'string' && Object.keys(object).length === 1)
    report(object['@id'], path || '@id')
  Object.entries(object).forEach(([key, nested]) => {
    if (key !== '@id') walkReferences(nested, report, path ? `${path}.${key}` : key)
  })
}

function assessEntity(entity: StructuredEntity): SearchEnhancementAssessment[] {
  return entity.types.map((type) => {
    const short = type.replace(/^https?:\/\/schema\.org\//, '')
    const profile = ENHANCEMENTS[short]
    if (!profile)
      return {
        entityPath: entity.path,
        type,
        profileVersion: SEARCH_ENHANCEMENT_PROFILE_VERSION,
        status: 'not-supported' as const,
        missingRequired: [],
        missingRecommended: [],
        note: 'Valid vocabulary may still have no supported search enhancement profile.'
      }
    const missingRequired = profile.required.filter(
      (property) => !hasValue(entity.properties[property])
    )
    const missingRecommended = profile.recommended.filter(
      (property) => !hasValue(entity.properties[property])
    )
    return {
      entityPath: entity.path,
      type,
      profileVersion: SEARCH_ENHANCEMENT_PROFILE_VERSION,
      status: missingRequired.length ? ('ineligible' as const) : ('eligible' as const),
      missingRequired,
      missingRecommended,
      note: 'Eligibility guidance is attributed and does not guarantee a rich result.'
    }
  })
}

function normalizeTypes(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  if (Array.isArray(value) && value.every((item) => typeof item === 'string'))
    return value.map((item) => item.trim()).filter(Boolean)
  return []
}
function hasValue(value: unknown): boolean {
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    (!Array.isArray(value) || value.length > 0)
  )
}
