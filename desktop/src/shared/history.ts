export const HISTORY_CAP = 200

export interface HistoryEntry {
  url: string
  title: string
  faviconUrl: string | null
  visitedAt: number
}

export interface HistoryVisit {
  url: string
  title: string
  faviconUrl: string | null
  visitedAt: number
}

export function recordVisit(entries: HistoryEntry[], visit: HistoryVisit): HistoryEntry[] {
  const existingIndex = entries.findIndex((entry) => entry.url === visit.url)
  if (existingIndex >= 0) {
    const bumped: HistoryEntry = {
      url: visit.url,
      title: visit.title,
      faviconUrl: visit.faviconUrl,
      visitedAt: visit.visitedAt
    }
    const rest = entries.filter((_, index) => index !== existingIndex)
    return [bumped, ...rest].slice(0, HISTORY_CAP)
  }

  const created: HistoryEntry = {
    url: visit.url,
    title: visit.title,
    faviconUrl: visit.faviconUrl,
    visitedAt: visit.visitedAt
  }
  return [created, ...entries].slice(0, HISTORY_CAP)
}

export function refreshHistoryMetadata(
  entries: HistoryEntry[],
  url: string,
  title: string,
  faviconUrl: string | null
): HistoryEntry[] {
  const index = entries.findIndex((entry) => entry.url === url)
  if (index < 0) return entries

  const existing = entries[index]
  if (existing.title === title && existing.faviconUrl === faviconUrl) {
    return entries
  }

  const next = [...entries]
  next[index] = {
    ...existing,
    title,
    faviconUrl
  }
  return next
}

export function removeHistoryEntry(entries: HistoryEntry[], url: string): HistoryEntry[] {
  if (!entries.some((entry) => entry.url === url)) return entries
  return entries.filter((entry) => entry.url !== url)
}

export function clearHistory(entries: HistoryEntry[]): HistoryEntry[] {
  if (entries.length === 0) return entries
  return []
}

export function resolveFocusIndexAfterRemoval(
  removedIndex: number,
  remainingCount: number
): number | null {
  if (remainingCount <= 0) return null
  return Math.min(removedIndex, remainingCount - 1)
}
