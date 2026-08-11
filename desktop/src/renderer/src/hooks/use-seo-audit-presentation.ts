import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  IDLE_AUDIT_STATE,
  inferIndexingIntent,
  isAuditableUrl,
  type AuditCategory,
  type AuditJobState,
  type AuditRunResult,
  type FindingOutcome,
  type IndexingIntent
} from '../../../shared/seo-audit'
import type { PaneNavigationState } from '../../../shared/pane-types'
import type { SnapshotResult } from '../../../shared/snapshot'
import type { HistoryEntry } from '../../../shared/history'

export interface SeoAuditPresentationAdapter {
  getNavigationState(): Promise<PaneNavigationState>
  onPaneNavigation(callback: (state: PaneNavigationState) => void): () => void
  getSeoAuditState(): Promise<AuditJobState>
  onSeoAuditState(callback: (state: AuditJobState) => void): () => void
  navigate(url: string): Promise<string>
  runSeoAudit(indexingIntent: IndexingIntent): Promise<AuditRunResult>
  cancelSeoAudit(): Promise<void>
  takeSnapshot(includeSeoAudit?: boolean): Promise<SnapshotResult>
  listHistory(): Promise<HistoryEntry[]>
  onHistoryUpdated(callback: (entries: HistoryEntry[]) => void): () => void
}

export interface SeoNavigationPresentation {
  url: string
  pageTitle: string
  intent: IndexingIntent
}

export interface SeoAuditPresentation {
  url: string
  pageTitle: string
  intent: IndexingIntent
  auditable: boolean
  history: HistoryEntry[]
  job: AuditJobState
  result: AuditJobState['result']
  running: boolean
  linkFilter: string
  setLinkFilter: Dispatch<SetStateAction<string>>
  findingCategories: AuditCategory[]
  setFindingCategories: Dispatch<SetStateAction<AuditCategory[]>>
  findingOutcomes: FindingOutcome[]
  setFindingOutcomes: Dispatch<SetStateAction<FindingOutcome[]>>
  copied: string
  exportStatus: string
  handleNavigate(url: string): void
  handleIntentChange(intent: IndexingIntent): void
  handleRun(): void
  handleCancel(): void
  copyMarkdown(markdown: string, label: string): void
  exportWithSnapshot(): void
}

export function applySeoNavigation(
  current: SeoNavigationPresentation,
  navigation: Pick<PaneNavigationState, 'barUrl' | 'pageTitle'>,
  intentTouched: boolean
): SeoNavigationPresentation {
  return {
    url: navigation.barUrl,
    pageTitle: navigation.pageTitle,
    intent:
      !intentTouched && isAuditableUrl(navigation.barUrl)
        ? inferIndexingIntent(navigation.barUrl)
        : current.intent
  }
}

export function useSeoAuditPresentation(
  adapter: SeoAuditPresentationAdapter
): SeoAuditPresentation {
  const [navigation, setNavigation] = useState<SeoNavigationPresentation>({
    url: '',
    pageTitle: '',
    intent: 'indexable'
  })
  const [linkFilter, setLinkFilter] = useState('')
  const [findingCategories, setFindingCategories] = useState<AuditCategory[]>([])
  const [findingOutcomes, setFindingOutcomes] = useState<FindingOutcome[]>([])
  const [copied, setCopied] = useState('')
  const [exportStatus, setExportStatus] = useState('')
  const [job, setJob] = useState<AuditJobState>(IDLE_AUDIT_STATE)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const intentTouchedRef = useRef(false)

  const applyNavigation = useCallback((state: PaneNavigationState): void => {
    setNavigation((current) => applySeoNavigation(current, state, intentTouchedRef.current))
  }, [])

  useEffect(() => {
    void adapter.getNavigationState().then(applyNavigation)
    return adapter.onPaneNavigation(applyNavigation)
  }, [adapter, applyNavigation])

  useEffect(() => {
    void adapter.getSeoAuditState().then(setJob)
    return adapter.onSeoAuditState(setJob)
  }, [adapter])

  useEffect(() => {
    void adapter.listHistory().then(setHistory)
    return adapter.onHistoryUpdated(setHistory)
  }, [adapter])

  const handleNavigate = useCallback(
    (url: string): void => {
      const trimmed = url.trim()
      if (!trimmed) return
      void adapter.navigate(trimmed)
    },
    [adapter]
  )

  const handleIntentChange = useCallback((intent: IndexingIntent): void => {
    intentTouchedRef.current = true
    setNavigation((current) => ({ ...current, intent }))
  }, [])

  const handleRun = useCallback((): void => {
    void adapter.runSeoAudit(navigation.intent)
  }, [adapter, navigation.intent])

  const handleCancel = useCallback((): void => {
    void adapter.cancelSeoAudit()
  }, [adapter])

  const copyMarkdown = useCallback((markdown: string, label: string): void => {
    void navigator.clipboard.writeText(markdown).then(() => setCopied(label))
  }, [])

  const exportWithSnapshot = useCallback((): void => {
    setExportStatus('Exporting…')
    void adapter
      .takeSnapshot(true)
      .then((value) =>
        setExportStatus(value.ok ? 'SEO Snapshot exported.' : `Export failed: ${value.reason}`)
      )
  }, [adapter])

  return {
    url: navigation.url,
    pageTitle: navigation.pageTitle,
    intent: navigation.intent,
    auditable: isAuditableUrl(navigation.url),
    history,
    job,
    result: job.result,
    running: job.phase === 'running',
    linkFilter,
    setLinkFilter,
    findingCategories,
    setFindingCategories,
    findingOutcomes,
    setFindingOutcomes,
    copied,
    exportStatus,
    handleNavigate,
    handleIntentChange,
    handleRun,
    handleCancel,
    copyMarkdown,
    exportWithSnapshot
  }
}
