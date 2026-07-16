import type {
  LighthouseAuditDetail,
  LighthouseAuditGroupMeta
} from '../../../../../shared/lighthouse'
import { LIGHTHOUSE_CORE_METRIC_IDS } from '../../../../../shared/lighthouse'

export type AuditBucketId = 'failed' | 'manual' | 'passed' | 'notApplicable'

export const BUCKET_META: Record<
  AuditBucketId,
  { label: string; hint?: string; defaultOpen: boolean }
> = {
  failed: { label: 'To improve', defaultOpen: true },
  manual: {
    label: 'Additional items to manually check',
    hint: 'These items require human review and are not included in the score.',
    defaultOpen: false
  },
  passed: { label: 'Passed audits', defaultOpen: false },
  notApplicable: { label: 'Not applicable', defaultOpen: false }
}

// Core Web Vitals are surfaced in the metrics grid, so they are excluded from the
// performance audit buckets to avoid duplication.
export const CORE_METRIC_SET = new Set<string>(LIGHTHOUSE_CORE_METRIC_IDS)

export function classifyAudit(audit: LighthouseAuditDetail): AuditBucketId {
  const mode = audit.scoreDisplayMode
  if (mode === 'notApplicable') return 'notApplicable'
  if (mode === 'manual') return 'manual'
  if (audit.score == null) {
    return mode === 'informative' ? 'passed' : 'manual'
  }
  if (audit.score >= 1) return 'passed'
  return 'failed'
}

function humanizeGroupId(groupId: string): string {
  const parts = groupId.split('-')
  const meaningful = parts.length > 1 ? parts.slice(1) : parts
  return meaningful.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function resolveGroupMeta(
  groupId: string | null,
  auditGroups: Record<string, LighthouseAuditGroupMeta>
): LighthouseAuditGroupMeta {
  if (groupId && auditGroups[groupId]) return auditGroups[groupId]
  if (groupId) return { title: humanizeGroupId(groupId), description: '' }
  return { title: 'Audits', description: '' }
}

export interface AuditGroup {
  id: string
  meta: LighthouseAuditGroupMeta
  audits: LighthouseAuditDetail[]
}

export function groupByAuditGroup(
  audits: LighthouseAuditDetail[],
  auditGroups: Record<string, LighthouseAuditGroupMeta>
): AuditGroup[] {
  const order: string[] = []
  const map = new Map<string, LighthouseAuditDetail[]>()
  for (const audit of audits) {
    const key = audit.groupId ?? '_ungrouped'
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(audit)
  }
  return order.map((id) => ({
    id,
    meta: resolveGroupMeta(id === '_ungrouped' ? null : id, auditGroups),
    audits: map.get(id)!
  }))
}
