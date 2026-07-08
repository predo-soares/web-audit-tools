import { describe, expect, it } from 'vitest'
import {
  addProject,
  isCommittedPageUrl,
  resolveProjectName,
  sortProjectsNewestFirst,
  suggestProjectName,
  type Project
} from '../../src/shared/project'

describe('suggestProjectName', () => {
  it('prefers page title when present', () => {
    expect(suggestProjectName('Example Site', 'https://example.com')).toBe('Example Site')
  })

  it('falls back to hostname when title is empty', () => {
    expect(suggestProjectName('', 'https://example.com/path')).toBe('example.com')
  })

  it('falls back to full url when hostname is unavailable', () => {
    expect(suggestProjectName('', 'not-a-valid-url')).toBe('not-a-valid-url')
  })
})

describe('resolveProjectName', () => {
  it('uses edited name when non-empty', () => {
    expect(resolveProjectName('Custom', 'Title', 'https://example.com')).toBe('Custom')
  })

  it('falls back to suggestion when edited name is blank', () => {
    expect(resolveProjectName('   ', 'Title', 'https://example.com')).toBe('Title')
    expect(resolveProjectName('', '', 'https://example.com')).toBe('example.com')
  })
})

describe('sortProjectsNewestFirst', () => {
  it('orders projects by createdAt descending', () => {
    const projects: Project[] = [
      {
        id: 'older',
        name: 'Older',
        url: 'https://older.test',
        faviconUrl: null,
        createdAt: 1
      },
      {
        id: 'newer',
        name: 'Newer',
        url: 'https://newer.test',
        faviconUrl: null,
        createdAt: 2
      }
    ]

    expect(sortProjectsNewestFirst(projects).map((project) => project.id)).toEqual([
      'newer',
      'older'
    ])
  })
})

describe('addProject', () => {
  it('prepends newest project and never saves blank names', () => {
    const existing: Project[] = [
      {
        id: 'old',
        name: 'Old',
        url: 'https://old.test',
        faviconUrl: null,
        createdAt: 1
      }
    ]

    const next = addProject(
      existing,
      { name: '   ', url: 'https://new.test', faviconUrl: 'https://new.test/f.ico' },
      'New Title',
      'new',
      2
    )

    expect(next).toHaveLength(2)
    expect(next[0]).toMatchObject({
      id: 'new',
      name: 'New Title',
      url: 'https://new.test',
      faviconUrl: 'https://new.test/f.ico'
    })
    expect(sortProjectsNewestFirst(next)[0].id).toBe('new')
  })

  it('allows duplicate URLs and duplicate names', () => {
    const existing: Project[] = [
      {
        id: 'first',
        name: 'Shared name',
        url: 'https://example.com',
        faviconUrl: null,
        createdAt: 1
      }
    ]

    const next = addProject(
      existing,
      { name: 'Shared name', url: 'https://example.com', faviconUrl: null },
      'Ignored title',
      'second',
      2
    )

    expect(next).toHaveLength(2)
    expect(next.map((project) => project.url)).toEqual([
      'https://example.com',
      'https://example.com'
    ])
    expect(next.map((project) => project.name)).toEqual(['Shared name', 'Shared name'])
    expect(next.map((project) => project.id)).toEqual(['second', 'first'])
  })
})

describe('isCommittedPageUrl', () => {
  it('accepts real urls and rejects blanks', () => {
    expect(isCommittedPageUrl('https://example.com')).toBe(true)
    expect(isCommittedPageUrl('about:blank')).toBe(false)
    expect(isCommittedPageUrl('')).toBe(false)
  })
})
