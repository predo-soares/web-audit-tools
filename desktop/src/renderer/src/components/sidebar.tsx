import { useCallback, useRef, useState } from 'react'
import { SIDEBAR_TRANSITION_MS, SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../shared/sidebar'
import type { HistoryEntry } from '../../../shared/history'
import { resolveFocusIndexAfterRemoval } from '../../../shared/history'
import type { Project } from '../../../shared/project'
import { ClearHistoryDialog } from '@renderer/components/clear-history-dialog'
import { HistoryRow } from '@renderer/components/history-row'
import { ProjectRow } from '@renderer/components/project-row'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@renderer/components/ui/accordion'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { useSidebar, useSidebarInternals } from '@renderer/context/sidebar-context'
import { cn } from '@renderer/lib/utils'

const sidebarSectionTriggerClassName = cn(
  'mb-2 items-center rounded-none border-0 px-2 py-0 text-xs font-normal tracking-wide text-muted-foreground/50',
  'hover:bg-transparent hover:no-underline',
  'focus-visible:ring-2 focus-visible:ring-ring/50',
  'justify-start gap-2',
  '**:data-[slot=accordion-trigger-icon]:ml-0 **:data-[slot=accordion-trigger-icon]:h-3',
  '**:data-[slot=accordion-trigger-icon]:w-0 **:data-[slot=accordion-trigger-icon]:shrink-0',
  '**:data-[slot=accordion-trigger-icon]:self-center **:data-[slot=accordion-trigger-icon]:overflow-hidden',
  '**:data-[slot=accordion-trigger-icon]:opacity-0',
  '**:data-[slot=accordion-trigger-icon]:transition-[width,opacity] **:data-[slot=accordion-trigger-icon]:duration-150',
  '**:data-[slot=accordion-trigger-icon]:ease-out',
  '**:data-[slot=accordion-trigger-icon]:group-hover/accordion-trigger:w-3',
  '**:data-[slot=accordion-trigger-icon]:group-hover/accordion-trigger:opacity-100',
  '**:data-[slot=accordion-trigger-icon]:group-focus-visible/accordion-trigger:w-3',
  '**:data-[slot=accordion-trigger-icon]:group-focus-visible/accordion-trigger:opacity-100'
)

const sidebarListClassName = 'flex flex-col gap-0.5'

const sidebarSectionContentClassName = 'pb-0 [&>div]:pb-0'

interface SidebarProps {
  projects: Project[]
  history: HistoryEntry[]
  committedUrl: string
  onProjectActivate: (project: Project) => void
  onHistoryActivate: (entry: HistoryEntry) => void
  onHistoryDelete: (entry: HistoryEntry) => Promise<void>
  onHistoryClear: () => Promise<void>
}

export function Sidebar({
  projects,
  history,
  committedUrl,
  onProjectActivate,
  onHistoryActivate,
  onHistoryDelete,
  onHistoryClear
}: SidebarProps): React.JSX.Element {
  const { isOpen, isTransitioning } = useSidebar()
  const { sidebarRef } = useSidebarInternals()
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const historyHeadingRef = useRef<HTMLButtonElement>(null)
  const historyRowRefs = useRef<Array<HTMLButtonElement | null>>([])

  const focusHistoryHeading = useCallback(() => {
    historyHeadingRef.current?.focus()
  }, [])

  const focusHistoryRow = useCallback((index: number) => {
    historyRowRefs.current[index]?.focus()
  }, [])

  const handleHistoryDelete = useCallback(
    async (entry: HistoryEntry) => {
      const removedIndex = history.findIndex((item) => item.url === entry.url)
      if (removedIndex < 0) return

      await onHistoryDelete(entry)

      const nextCount = history.length - 1
      const nextFocusIndex = resolveFocusIndexAfterRemoval(removedIndex, nextCount)
      window.requestAnimationFrame(() => {
        if (nextFocusIndex === null) {
          focusHistoryHeading()
          return
        }
        focusHistoryRow(nextFocusIndex)
      })
    },
    [focusHistoryHeading, focusHistoryRow, history, onHistoryDelete]
  )

  const handleHistoryClear = useCallback(async () => {
    await onHistoryClear()
    window.requestAnimationFrame(() => {
      focusHistoryHeading()
    })
  }, [focusHistoryHeading, onHistoryClear])

  return (
    <aside
      id="sidebar"
      ref={sidebarRef}
      data-testid="sidebar"
      data-sidebar-open={isOpen ? 'true' : 'false'}
      data-sidebar-transitioning={isTransitioning ? 'true' : 'false'}
      aria-hidden={!isOpen}
      className={cn(
        'flex h-full shrink-0 flex-col overflow-hidden border-r border-white/10 bg-black/20 backdrop-blur-2xl',
        isTransitioning && 'pointer-events-none',
        !isOpen && 'pointer-events-none'
      )}
      style={{
        width: isOpen ? SIDEBAR_WIDTH_PX : 0,
        paddingTop: TOOLBAR_HEIGHT_PX,
        transition: `width ${SIDEBAR_TRANSITION_MS}ms ease`
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col" style={{ width: SIDEBAR_WIDTH_PX }}>
        <TooltipProvider>
          <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
            <Accordion multiple defaultValue={['projects', 'history']} className="gap-0">
              <AccordionItem value="projects" className="mb-6 border-0">
                <AccordionTrigger className={sidebarSectionTriggerClassName}>
                  Projects
                </AccordionTrigger>
                <AccordionContent className={sidebarSectionContentClassName}>
                  {projects.length === 0 ? (
                    <p className="px-2 text-sm text-muted-foreground">
                      Save the current page to create a project.
                    </p>
                  ) : (
                    <ul data-sidebar-list className={sidebarListClassName}>
                      {projects.map((project) => (
                        <li key={project.id}>
                          <ProjectRow
                            project={project}
                            isActive={project.url === committedUrl}
                            onActivate={(entry) => {
                              if (entry.url === committedUrl) return
                              onProjectActivate(entry)
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="history" className="border-0">
                <div className="mb-2 flex items-center justify-between gap-2 px-2">
                  <div className="min-w-0 flex-1">
                    <AccordionTrigger
                      ref={historyHeadingRef}
                      tabIndex={-1}
                      data-testid="history-heading"
                      className={cn(sidebarSectionTriggerClassName, 'mb-0 w-full px-0')}
                    >
                      History
                    </AccordionTrigger>
                  </div>
                  {history.length > 0 ? (
                    <button
                      type="button"
                      data-testid="history-clear-all"
                      className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      onClick={() => setClearDialogOpen(true)}
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>
                <AccordionContent className={sidebarSectionContentClassName}>
                  {history.length === 0 ? (
                    <p className="px-2 text-sm text-muted-foreground">
                      Pages you visit will appear here.
                    </p>
                  ) : (
                    <ul data-sidebar-list className={sidebarListClassName}>
                      {history.map((entry, index) => (
                        <li key={entry.url}>
                          <HistoryRow
                            entry={entry}
                            isActive={entry.url === committedUrl}
                            rowRef={(node) => {
                              historyRowRefs.current[index] = node
                            }}
                            onActivate={(item) => {
                              if (item.url === committedUrl) return
                              onHistoryActivate(item)
                            }}
                            onDelete={(item) => void handleHistoryDelete(item)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </nav>
        </TooltipProvider>
      </div>
      <ClearHistoryDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        onConfirm={() => void handleHistoryClear()}
      />
    </aside>
  )
}
