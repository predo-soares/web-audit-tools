import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import type { LighthouseAuditDetail } from '../../../../../shared/lighthouse'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@renderer/components/ui/accordion'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/lib/utils'
import { scoreTone, TONE_SHAPE } from '../lib/scoring'
import { CHEVRON, PRESSABLE_ROW } from '../lib/styles'

export function AuditRow({ audit }: { audit: LighthouseAuditDetail }): React.JSX.Element {
  const tone = scoreTone(audit.score)
  return (
    <AccordionItem
      value={audit.id}
      className="rounded-md transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/3"
    >
      <AccordionTrigger
        hideIcon
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-sm font-normal outline-none hover:no-underline',
          'focus-visible:ring-2 focus-visible:ring-sky-400/30',
          PRESSABLE_ROW
        )}
      >
        <span
          className={cn(
            'size-2.5 shrink-0',
            TONE_SHAPE[tone],
            tone === 'pass' && 'bg-[#0cce6b]',
            tone === 'average' && 'bg-[#ffa400]',
            tone === 'fail' && 'bg-[#ff4e42]',
            tone === 'none' && 'bg-white/25'
          )}
        />
        <span className="min-w-0 flex-1 text-left text-white/85">{audit.title}</span>
        {audit.displayValue ? (
          <span className="shrink-0 text-xs tabular-nums text-white/40">{audit.displayValue}</span>
        ) : null}
        <Icon icon={ArrowDown01Icon} size={14} className={cn('shrink-0 text-white/30', CHEVRON)} />
      </AccordionTrigger>
      <AccordionContent>
        <p className="pb-3 pl-5 pr-3 text-xs leading-relaxed text-white/45">
          {audit.description || 'No additional detail.'}
        </p>
      </AccordionContent>
    </AccordionItem>
  )
}
