import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  type HistoryEntry,
  clearHistory,
  recordVisit,
  refreshHistoryMetadata,
  removeHistoryEntry
} from '../../shared/history'

const WRITE_DEBOUNCE_MS = 250

interface HistoryFile {
  entries: HistoryEntry[]
}

export class HistoryStore {
  private entries: HistoryEntry[] = []
  private readonly filePath: string
  private writeTimer: ReturnType<typeof setTimeout> | null = null
  private onChange: ((entries: HistoryEntry[]) => void) | null = null

  constructor(userDataPath = app.getPath('userData')) {
    this.filePath = join(userDataPath, 'history.json')
    this.load()
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
    this.scheduleWrite()
    this.onChange?.(this.list())
  }

  refreshMetadata(url: string, title: string, faviconUrl: string | null): void {
    const next = refreshHistoryMetadata(this.entries, url, title, faviconUrl)
    if (next === this.entries) return

    console.debug('[favicon]', JSON.stringify({ action: 'history:refreshMetadata', url, faviconUrl }))
    this.entries = next
    this.scheduleWrite()
    this.onChange?.(this.list())
  }

  remove(url: string): void {
    const next = removeHistoryEntry(this.entries, url)
    if (next === this.entries) return

    this.entries = next
    this.scheduleWrite()
    this.onChange?.(this.list())
  }

  clear(): void {
    const next = clearHistory(this.entries)
    if (next === this.entries) return

    this.entries = next
    this.scheduleWrite()
    this.onChange?.(this.list())
  }

  destroy(): void {
    if (this.writeTimer !== null) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
      this.flushWrite()
    }
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      this.entries = []
      return
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as HistoryFile
      this.entries = Array.isArray(parsed.entries) ? parsed.entries : []
    } catch {
      this.entries = []
    }
  }

  private scheduleWrite(): void {
    if (this.writeTimer !== null) {
      clearTimeout(this.writeTimer)
    }
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null
      this.flushWrite()
    }, WRITE_DEBOUNCE_MS)
  }

  private flushWrite(): void {
    const dir = join(this.filePath, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const payload: HistoryFile = { entries: this.entries }
    writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8')
  }
}
