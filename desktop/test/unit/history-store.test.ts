import { describe, expect, it } from 'vitest'
import {
  HISTORY_CAP,
  type HistoryEntry,
  clearHistory,
  recordVisit,
  refreshHistoryMetadata,
  removeHistoryEntry,
  resolveFocusIndexAfterRemoval
} from '../../src/shared/history'

function entry(
  url: string,
  title = '',
  faviconUrl: string | null = null,
  visitedAt = 1
): HistoryEntry {
  return { url, title, faviconUrl, visitedAt }
}

describe('recordVisit', () => {
  it('prepends new visits newest-first', () => {
    const result = recordVisit([entry('https://b.com', 'B', null, 2)], {
      url: 'https://a.com',
      title: 'A',
      faviconUrl: null,
      visitedAt: 3
    })

    expect(result.map((item) => item.url)).toEqual(['https://a.com', 'https://b.com'])
  })

  it('bumps an existing exact URL match instead of duplicating', () => {
    const initial = [
      entry('https://old.com', 'Old', null, 1),
      entry('https://example.com', 'Example', null, 2)
    ]
    const result = recordVisit(initial, {
      url: 'https://example.com',
      title: 'Example Updated',
      faviconUrl: 'https://example.com/favicon.ico',
      visitedAt: 9
    })

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      url: 'https://example.com',
      title: 'Example Updated',
      faviconUrl: 'https://example.com/favicon.ico',
      visitedAt: 9
    })
    expect(result[1]?.url).toBe('https://old.com')
  })

  it('deduplicates by exact URL string only', () => {
    const initial = [entry('https://example.com/')]
    const result = recordVisit(initial, {
      url: 'https://example.com',
      title: 'No slash',
      faviconUrl: null,
      visitedAt: 5
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.url).toBe('https://example.com')
    expect(result[1]?.url).toBe('https://example.com/')
  })

  it('caps the list at HISTORY_CAP entries', () => {
    const initial = Array.from({ length: HISTORY_CAP }, (_, index) =>
      entry(`https://site-${index}.com`, `Site ${index}`, null, index)
    )
    const result = recordVisit(initial, {
      url: 'https://newest.com',
      title: 'Newest',
      faviconUrl: null,
      visitedAt: HISTORY_CAP + 1
    })

    expect(result).toHaveLength(HISTORY_CAP)
    expect(result[0]?.url).toBe('https://newest.com')
    expect(result[HISTORY_CAP - 1]?.url).toBe('https://site-198.com')
    expect(result.some((item) => item.url === 'https://site-199.com')).toBe(false)
  })
})

describe('refreshHistoryMetadata', () => {
  it('updates title and favicon in place without reordering or bumping visitedAt', () => {
    const initial = [
      entry('https://newest.com', 'Newest', null, 10),
      entry('https://example.com', 'Old title', null, 5)
    ]
    const result = refreshHistoryMetadata(
      initial,
      'https://example.com',
      'Fresh title',
      'https://example.com/icon.png'
    )

    expect(result.map((item) => item.url)).toEqual(['https://newest.com', 'https://example.com'])
    expect(result[1]).toEqual({
      url: 'https://example.com',
      title: 'Fresh title',
      faviconUrl: 'https://example.com/icon.png',
      visitedAt: 5
    })
  })

  it('returns the same array reference when metadata is unchanged', () => {
    const initial = [entry('https://example.com', 'Title', 'https://example.com/icon.png', 3)]
    const result = refreshHistoryMetadata(
      initial,
      'https://example.com',
      'Title',
      'https://example.com/icon.png'
    )

    expect(result).toBe(initial)
  })

  it('does nothing when the URL is not in history', () => {
    const initial = [entry('https://example.com')]
    const result = refreshHistoryMetadata(initial, 'https://missing.com', 'Missing', null)

    expect(result).toBe(initial)
  })
})

describe('removeHistoryEntry', () => {
  it('removes the matching entry and leaves others intact', () => {
    const initial = [entry('https://a.com'), entry('https://b.com')]
    const result = removeHistoryEntry(initial, 'https://a.com')

    expect(result).toEqual([entry('https://b.com')])
  })

  it('returns the same array reference when the URL is missing', () => {
    const initial = [entry('https://example.com')]
    const result = removeHistoryEntry(initial, 'https://missing.com')

    expect(result).toBe(initial)
  })
})

describe('clearHistory', () => {
  it('empties the list', () => {
    const initial = [entry('https://a.com'), entry('https://b.com')]
    expect(clearHistory(initial)).toEqual([])
  })

  it('returns the same array reference when already empty', () => {
    const initial: HistoryEntry[] = []
    expect(clearHistory(initial)).toBe(initial)
  })
})

describe('resolveFocusIndexAfterRemoval', () => {
  it('focuses the next row when deleting from the start', () => {
    expect(resolveFocusIndexAfterRemoval(0, 2)).toBe(0)
  })

  it('focuses the previous row when deleting the last entry', () => {
    expect(resolveFocusIndexAfterRemoval(2, 2)).toBe(1)
  })

  it('returns null when no rows remain', () => {
    expect(resolveFocusIndexAfterRemoval(0, 0)).toBeNull()
  })
})
