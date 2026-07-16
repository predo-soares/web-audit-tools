import type {
  LighthouseAuditDetail,
  LighthouseAuditGroupMeta
} from '../../../../../shared/lighthouse'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@renderer/components/ui/accordion'
import { cn } from '@renderer/lib/utils'
import { BUCKET_META, groupByAuditGroup, type AuditBucketId } from '../lib/audits'
import { PRESSABLE_ROW } from '../lib/styles'
import { AuditRow } from './audit-row'

export function AuditBucket({
  bucket,
  audits,
  auditGroups
}: {
  bucket: AuditBucketId
  audits: LighthouseAuditDetail[]
  auditGroups: Record<string, LighthouseAuditGroupMeta>
}): React.JSX.Element | null {
  if (audits.length === 0) return null
  const meta = BUCKET_META[bucket]
  const grouped = groupByAuditGroup(audits, auditGroups)

  if (bucket === 'failed') {
    return (
      <div className="border-t border-white/10 ">
        {grouped.map((group) => (
          <div key={group.id} className="border-b border-white/10 last:border-b-0">
            <div className="px-1 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">
                {group.meta.title}
              </h3>
              {group.meta.description ? (
                <p className="mt-1 text-xs text-white/35">{group.meta.description}</p>
              ) : null}
            </div>
            <Accordion multiple className="px-1">
              {group.audits.map((audit) => (
                <AuditRow key={audit.id} audit={audit} />
              ))}
            </Accordion>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Accordion className="" defaultValue={meta.defaultOpen ? [bucket] : []}>
      <AccordionItem value={bucket} className="border-0">
        <AccordionTrigger
          hideIcon
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-md px-3 py-4 font-normal outline-none hover:no-underline',
            '[@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.03]',
            'focus-visible:ring-2 focus-visible:ring-sky-400/30',
            PRESSABLE_ROW
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/55">
              {meta.label} ({audits.length})
            </p>
            {meta.hint ? <p className="mt-1 text-xs text-white/30">{meta.hint}</p> : null}
          </div>
          <span className="text-xs font-medium text-sky-300 group-aria-expanded/accordion-trigger:hidden">
            Show
          </span>
          <span className="hidden text-xs font-medium text-sky-300 group-aria-expanded/accordion-trigger:inline">
            Hide
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-2">
            {grouped.map((group) => (
              <div key={group.id} className="mb-2">
                {grouped.length > 1 ? (
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/30">
                    {group.meta.title}
                  </p>
                ) : null}
                <Accordion multiple>
                  {group.audits.map((audit) => (
                    <AuditRow key={audit.id} audit={audit} />
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
