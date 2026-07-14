import Store from 'electron-store'
import {
  type HistoryEntry,
  clearHistory,
  recordVisit,
  refreshHistoryMetadata,
  removeHistoryEntry
} from '../../shared/history'

interface HistorySchema {
  entries: HistoryEntry[]
}

export class HistoryStore {
  private entries: HistoryEntry[]
  private readonly store: Store<HistorySchema>
  private onChange: ((entries: HistoryEntry[]) => void) | null = null

  constructor() {
    this.store = new Store<HistorySchema>({ name: 'history', defaults: { entries: [] } })
    this.entries = this.store.get('entries')
  }

  setOnChange(listener: (entries: HistoryEntry[]) => void): void {
    this.onChange = listener
  }

  list(): HistoryEntry[] {
    return [...this.entries]
  }

  logVisit(url: string, title: string, faviconUrl: string | null): void {
    console.debug('[favicon]', JSON.stringify({ action: 'history:logVisit', url, faviconUrl }))
    this.entries = recordVisit(this.entries, {
      url,
      title,
      faviconUrl,
      visitedAt: Date.now()
    })
    this.store.set('entries', this.entries)
    this.onChange?.(this.list())
  }

  refreshMetadata(url: string, title: string, faviconUrl: string | null): void {
    const next = refreshHistoryMetadata(this.entries, url, title, faviconUrl)
    if (next === this.entries) return

    console.debug('[favicon]', JSON.stringify({ action: 'history:refreshMetadata', url, faviconUrl }))
    this.entries = next
    this.store.set('entries', this.entries)
    this.onChange?.(this.list())
  }

  remove(url: string): void {
    const next = removeHistoryEntry(this.entries, url)
    if (next === this.entries) return

    this.entries = next
    this.store.set('entries', this.entries)
    this.onChange?.(this.list())
  }

  clear(): void {
    const next = clearHistory(this.entries)
    if (next === this.entries) return

    this.entries = next
    this.store.set('entries', this.entries)
    this.onChange?.(this.list())
  }

  destroy(): void {
    // no-op: electron-store writes synchronously on every mutation
  }
}
