import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IDLE_AUDIT_STATE,
  inferIndexingIntent,
  isAuditableUrl,
  type AuditCategory,
  type AuditJobState,
  type AuditRunResult,
  type FindingOutcome,
  type IndexingIntent,
  type LighthouseAssessmentState,
  type LighthouseProfile
} from '../../../shared/seo-audit'
import type { PaneNavigationState } from '../../../shared/types'
import type { SnapshotResult } from '../../../shared/snapshot'

const IDLE_LIGHTHOUSE_STATE: LighthouseAssessmentState = {
  phase: 'idle',
  result: null,
  error: null
}

export interface SeoAuditPresentationAdapter {
  getNavigationState(): Promise<PaneNavigationState>
  onPaneNavigation(callback: (state: PaneNavigationState) => void): () => void
  getSeoAuditState(): Promise<AuditJobState>
  onSeoAuditState(callback: (state: AuditJobState) => void): () => void
  runSeoAudit(indexingIntent: IndexingIntent): Promise<AuditRunResult>
  cancelSeoAudit(): Promise<void>
  getLighthouseState(): Promise<LighthouseAssessmentState>
  onLighthouseState(callback: (state: LighthouseAssessmentState) => void): () => void
  runLighthouse(profile: LighthouseProfile, shareSession: boolean): Promise<unknown>
  cancelLighthouse(): Promise<unknown>
  takeSnapshot(includeSeoAudit?: boolean): Promise<SnapshotResult>
}

export interface SeoNavigationPresentation {
  url: string
  pageTitle: string
  intent: IndexingIntent
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

export function useSeoAuditPresentation(adapter: SeoAuditPresentationAdapter) {
  const [navigation, setNavigation] = useState<SeoNavigationPresentation>({
    url: '',
    pageTitle: '',
    intent: 'indexable'
  })
  const [linkFilter, setLinkFilter] = useState('')
  const [findingCategory, setFindingCategory] = useState<AuditCategory | null>(null)
  const [findingOutcome, setFindingOutcome] = useState<FindingOutcome | null>(null)
  const [copied, setCopied] = useState('')
  const [exportStatus, setExportStatus] = useState('')
  const [lighthouse, setLighthouse] =
    useState<LighthouseAssessmentState>(IDLE_LIGHTHOUSE_STATE)
  const [lighthouseProfile, setLighthouseProfile] = useState<LighthouseProfile>('mobile')
  const [shareSession, setShareSession] = useState(false)
  const [job, setJob] = useState<AuditJobState>(IDLE_AUDIT_STATE)
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
    void adapter.getLighthouseState().then(setLighthouse)
    return adapter.onLighthouseState(setLighthouse)
  }, [adapter])

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

  const runLighthouse = useCallback((): void => {
    void adapter.runLighthouse(lighthouseProfile, shareSession)
  }, [adapter, lighthouseProfile, shareSession])

  const cancelLighthouse = useCallback((): void => {
    void adapter.cancelLighthouse()
  }, [adapter])

  return {
    url: navigation.url,
    pageTitle: navigation.pageTitle,
    intent: navigation.intent,
    auditable: isAuditableUrl(navigation.url),
    job,
    result: job.result,
    running: job.phase === 'running',
    linkFilter,
    setLinkFilter,
    findingCategory,
    setFindingCategory,
    findingOutcome,
    setFindingOutcome,
    copied,
    exportStatus,
    lighthouse,
    lighthouseProfile,
    setLighthouseProfile,
    shareSession,
    setShareSession,
    handleIntentChange,
    handleRun,
    handleCancel,
    copyMarkdown,
    exportWithSnapshot,
    runLighthouse,
    cancelLighthouse
  }
}
