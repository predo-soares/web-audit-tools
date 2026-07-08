import {
  SIDEBAR_TRANSITION_MS,
  SIDEBAR_WIDTH_PX,
  TOOLBAR_HEIGHT_PX
} from '../../../shared/sidebar'
import type { Project } from '../../../shared/project'
import { ProjectRow } from '@renderer/components/project-row'
import { useSidebar, useSidebarInternals } from '@renderer/context/sidebar-context'
import { cn } from '@renderer/lib/utils'

interface SidebarProps {
  projects: Project[]
  committedUrl: string
  onProjectActivate: (project: Project) => void
}

export function Sidebar({
  projects,
  committedUrl,
  onProjectActivate
}: SidebarProps): React.JSX.Element {
  const { isOpen, isTransitioning } = useSidebar()
  const { sidebarRef } = useSidebarInternals()

  return (
    <aside
      id="sidebar"
      ref={sidebarRef}
      data-testid="sidebar"
      data-sidebar-open={isOpen ? 'true' : 'false'}
      data-sidebar-transitioning={isTransitioning ? 'true' : 'false'}
      aria-hidden={!isOpen}
      className={cn(
        'flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-card',
        isTransitioning && 'pointer-events-none',
        !isOpen && 'pointer-events-none'
      )}
      style={{
        width: isOpen ? SIDEBAR_WIDTH_PX : 0,
        paddingTop: TOOLBAR_HEIGHT_PX,
        transition: `width ${SIDEBAR_TRANSITION_MS}ms ease`
      }}
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ width: SIDEBAR_WIDTH_PX }}
      >
        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
          <section className="mb-6">
            <h2 className="mb-2 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Projects
            </h2>
            {projects.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">
                Save the current page to create a project.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {projects.map((project) => (
                  <li key={project.id}>
                    <ProjectRow
                      project={project}
                      onActivate={(entry) => {
                        if (entry.url === committedUrl) return
                        onProjectActivate(entry)
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="mb-2 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              History
            </h2>
            <p className="px-2 text-sm text-muted-foreground">
              Pages you visit will appear here.
            </p>
          </section>
        </nav>
      </div>
    </aside>
  )
}
