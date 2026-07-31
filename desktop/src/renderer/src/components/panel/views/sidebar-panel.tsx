import { useCallback, useEffect, useRef, useState } from 'react'
import type { HistoryEntry } from '../../../../../shared/history'
import { resolveFocusIndexAfterRemoval } from '../../../../../shared/history'
import { isCommittedPageUrl } from '../../../../../shared/project'
import type { Project } from '../../../../../shared/project'
import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../../../shared/sidebar'
import { ClearHistoryDialog } from '@renderer/components/clear-history-dialog'
import { HistoryRow } from '@renderer/components/history-row'
import { ProjectRow } from '@renderer/components/project-row'
import type { PanelAction } from '../../../../../shared/panel-types'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@renderer/components/ui/accordion'
import { cn } from '@renderer/lib/utils'
import {
  BrowserIcon,
  GaugeIcon,
  InformationCircleIcon,
  LaptopPhoneSyncIcon,
  SearchVisualIcon,
  Settings01Icon
} from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'

const sidebarSectionTriggerClassName = cn(

  'mb-2 items-center rounded-none  border-0 px-4 py-0 text-xs font-medium tracking-wide text-muted-foreground/50',
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
const sidebarSectionContentClassName = 'pb-0 px-2 [&>div]:pb-0'

export function SidebarPanel({
  onAction
}: {
  onAction: (action: PanelAction) => void
}): React.JSX.Element {
  const rootRef = useRef<HTMLElement>(null)
  const shortcutsTriggerRef = useRef<HTMLButtonElement>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [committedUrl, setCommittedUrl] = useState('')
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<
    'preview' | 'seo' | 'lighthouse' | 'devices' | 'settings'
  >('preview')
  const HISTORY_PAGE_SIZE = 10
  const historyHeadingRef = useRef<HTMLButtonElement>(null)
  const historyRowRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    void window.panelApi.listProjects().then(setProjects)
    void window.panelApi.listHistory().then(setHistory)
    void window.panelApi.getNavigationState().then((state) => {
      if (isCommittedPageUrl(state.barUrl)) {
        setCommittedUrl(state.barUrl)
      }
    })

    const unsubscribeProjects = window.panelApi.onProjectsChanged(setProjects)
    const unsubscribeHistory = window.panelApi.onHistoryUpdated(setHistory)
    const unsubscribeNavigation = window.panelApi.onPaneNavigation((state) => {
      if (isCommittedPageUrl(state.barUrl)) {
        setCommittedUrl(state.barUrl)
      }
    })
    const unsubscribeHide = window.panelApi.onHide(() => {
      if (rootRef.current?.contains(document.activeElement)) {
        window.panelApi.reportFocusOnClose()
      }
    })
    const unsubscribeClosed = window.panelApi.onPanelClosed((panelId) => {
      if (panelId === 'shortcuts') {
        shortcutsTriggerRef.current?.focus()
      }
    })

    return () => {
      unsubscribeProjects()
      unsubscribeHistory()
      unsubscribeNavigation()
      unsubscribeHide()
      unsubscribeClosed()
    }
  }, [])

  const focusHistoryHeading = useCallback(() => {
    historyHeadingRef.current?.focus()
  }, [])

  const focusHistoryRow = useCallback((index: number) => {
    historyRowRefs.current[index]?.focus()
  }, [])

  const handleProjectActivate = useCallback(
    (project: Project) => {
      if (project.url === committedUrl) return
      onAction({ type: 'navigate', url: project.url })
    },
    [committedUrl, onAction]
  )

  const handleHistoryActivate = useCallback(
    (entry: HistoryEntry) => {
      if (entry.url === committedUrl) return
      onAction({ type: 'navigate', url: entry.url })
    },
    [committedUrl, onAction]
  )

  const handleHistoryDelete = useCallback(
    async (entry: HistoryEntry) => {
      const removedIndex = history.findIndex((item) => item.url === entry.url)
      if (removedIndex < 0) return

      await window.panelApi.deleteHistoryEntry(entry.url)

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
    [focusHistoryHeading, focusHistoryRow, history]
  )

  const handleHistoryClear = useCallback(async () => {
    await window.panelApi.clearHistory()
    window.requestAnimationFrame(() => {
      focusHistoryHeading()
    })
  }, [focusHistoryHeading])

  return (
    <aside
      id="sidebar"
      ref={rootRef}
      data-testid="sidebar"
      data-sidebar-open="true"
      data-sidebar-transitioning="false"
      className={cn(
        ' bg-background box-border flex h-screen min-h-screen shrink-0 flex-col overflow-hidden border-r border-white/10 text-foreground'
      )}
      style={{ width: SIDEBAR_WIDTH_PX }}
    >
      <div
        className="relative z-[1] flex min-h-0 flex-1 flex-col"
        style={{ width: SIDEBAR_WIDTH_PX }}
      >
        <nav
            className="flex min-h-0 flex-1 flex-col overflow-y-auto  py-4 gap-4"
            style={{ paddingTop: TOOLBAR_HEIGHT_PX }}
        >
          <div className="px-4 flex gap-1 ">
            <span className='font-semibold tracking-tight'>Audit Web</span>
            <span className='font-light tracking-tight text-muted-foreground'>Tools</span>
          </div>

          <div className="mb-3 px-2 flex flex-col gap-0.5">
            <button
              type="button"
              data-testid="sidebar-preview-view"
              className={cn(
                'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                activeTab === 'preview'
                  ? 'bg-white/10 text-foreground'
                  : 'text-foreground/70 hover:bg-white/5 hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
              )}
              onClick={() => {
                setActiveTab('preview')
                onAction({ type: 'enter-preview-view' })
              }}
            >
              <Icon icon={BrowserIcon} size={16} />
              <span className="text-foreground">Preview</span>
            </button>
            <button
              type="button"
              data-testid="sidebar-seo-view"
              className={cn(
                'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                activeTab === 'seo'
                  ? 'bg-white/10 text-foreground'
                  : 'text-foreground/70 hover:bg-white/5 hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
              )}
              onClick={() => {
                setActiveTab('seo')
                onAction({ type: 'enter-seo-view' })
              }}
            >
              <Icon icon={SearchVisualIcon} size={16} />
              <span className="text-foreground">SEO</span>
            </button>
            <button
              type="button"
              data-testid="sidebar-lighthouse-view"
              className={cn(
                'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                activeTab === 'lighthouse'
                  ? 'bg-white/10 text-foreground'
                  : 'text-foreground/70 hover:bg-white/5 hover:text-foreground'
              )}
              onClick={() => {
                setActiveTab('lighthouse')
                onAction({ type: 'enter-lighthouse-view' })
              }}
            >
              <Icon icon={GaugeIcon} size={16} />
              <span className="text-foreground">Lighthouse</span>
            </button>
            <button
              type="button"
              data-testid="sidebar-devices-view"
              className={cn(
                'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                activeTab === 'devices'
                  ? 'bg-white/10 text-foreground'
                  : 'text-foreground/70 hover:bg-white/5 hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
              )}
              onClick={() => {
                setActiveTab('devices')
                onAction({ type: 'enter-devices-view' })
              }}
            >
              <Icon icon={LaptopPhoneSyncIcon} size={16} />
              <span className="text-foreground">Devices</span>
            </button>
          </div>

            <Accordion multiple defaultValue={['projects', 'history']} className="gap-0  ">
              <AccordionItem value="projects" className="mb-6 border-0">
                <AccordionTrigger className={sidebarSectionTriggerClassName} >
                  Projects
                </AccordionTrigger>
                <AccordionContent className={sidebarSectionContentClassName}>
                  {projects.length === 0 ? (
                    <p className="px-1 text-xs font-medium text-muted-foreground">
                      Save the current page to create a project.
                    </p>
                  ) : (
                    <ul data-sidebar-list className={sidebarListClassName}>
                      {projects.map((project) => (
                        <li key={project.id}>
                          <ProjectRow
                            project={project}
                            isActive={project.url === committedUrl}
                            onActivate={handleProjectActivate}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="history" className="border-0">
                <div className="mb-2 flex items-center justify-between gap-2 px-4">
                  <div className="min-w-0 flex-1">
                    <AccordionTrigger
                      ref={historyHeadingRef}
                      tabIndex={-1}
                      data-testid="history-heading"
                      className={cn(sidebarSectionTriggerClassName, 'mb-0 w-full px-0 font-medium')}
                    >
                      History
                    </AccordionTrigger>
                  </div>
                  {history.length > 0 ? (
                    <button
                      type="button"
                      data-testid="history-clear-all"
                      className="shrink-0 text-xs text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      onClick={() => setClearDialogOpen(true)}
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>
                <AccordionContent className={sidebarSectionContentClassName}>
                  {history.length === 0 ? (
                    <p className="px-1 text-xs font-medium text-muted-foreground">
                      Pages you visit will appear here.
                    </p>
                  ) : (
                    <>
                      <ul data-sidebar-list className={sidebarListClassName}>
                        {(historyExpanded ? history : history.slice(0, HISTORY_PAGE_SIZE)).map((entry, index) => (
                          <li key={entry.url}>
                            <HistoryRow
                              entry={entry}
                              isActive={entry.url === committedUrl}
                              rowRef={(node) => {
                                historyRowRefs.current[index] = node
                              }}
                              onActivate={handleHistoryActivate}
                              onDelete={(item) => void handleHistoryDelete(item)}
                            />
                          </li>
                        ))}
                      </ul>
                      {history.length > HISTORY_PAGE_SIZE && (
                        <button
                          type="button"
                          className="mt-1 w-full pl-8 pr-2 py-1 text-left text-xs text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                          onClick={() => setHistoryExpanded((v) => !v)}
                        >
                          {historyExpanded ? 'Show less' : `Show ${history.length - HISTORY_PAGE_SIZE} more`}
                        </button>
                      )}
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
        </nav>
      </div>
      <footer className="shrink-0 border-t border-white/10 p-2 flex items-center gap-1">
        <button
          type="button"
          data-testid="sidebar-settings-view"
          className={cn(
            'flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
            activeTab === 'settings'
              ? 'bg-white/10 text-foreground'
              : 'text-foreground/70 hover:bg-white/5 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
          )}
          onClick={() => {
            setActiveTab('settings')
            onAction({ type: 'enter-settings-view' })
          }}
        >
          <Icon icon={Settings01Icon} size={16} />
          <span>Settings</span>
        </button>
        <button
          ref={shortcutsTriggerRef}
          type="button"
          data-testid="shortcuts-trigger"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
          className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-foreground/70 transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={() => {
            void window.panelApi.openPanel({
              panelId: 'shortcuts',
              mode: 'modal'
            })
          }}
        >
          <Icon icon={InformationCircleIcon} size={16} />
        </button>
      </footer>
      <ClearHistoryDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        onConfirm={() => void handleHistoryClear()}
      />
    </aside>
  )
}
