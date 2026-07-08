import { useCallback, useEffect, useState } from 'react'
import type { HistoryEntry } from '../../../shared/history'

export function useHistory(): {
  history: HistoryEntry[]
  deleteHistoryEntry: (url: string) => Promise<void>
  clearHistory: () => Promise<void>
} {
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    void window.api.listHistory().then(setHistory)
    const unsubscribe = window.api.onHistoryUpdated(setHistory)
    return unsubscribe
  }, [])

  const deleteHistoryEntry = useCallback(async (url: string) => {
    await window.api.deleteHistoryEntry(url)
    setHistory((current) => current.filter((entry) => entry.url !== url))
  }, [])

  const clearHistory = useCallback(async () => {
    await window.api.clearHistory()
    setHistory([])
  }, [])

  return { history, deleteHistoryEntry, clearHistory }
}
