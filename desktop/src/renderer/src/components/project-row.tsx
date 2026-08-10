import { Globe02Icon } from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'
import { useState } from 'react'
import type { Project } from '../../../shared/project'
import { cn } from '@renderer/lib/utils'

interface ProjectRowProps {
  project: Project
  isActive?: boolean
  onActivate: (project: Project) => void
}

export function ProjectRow({
  project,
  isActive = false,
  onActivate
}: ProjectRowProps): React.JSX.Element {
  const [faviconFailed, setFaviconFailed] = useState(false)

  return (
    <button
      type="button"
      data-testid={`project-row-${project.id}`}
      className={cn(
        'flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none',
        isActive && 'bg-white/10'
      )}
      onClick={() => onActivate(project)}
    >
      {project.faviconUrl && !faviconFailed ? (
        <img
          src={project.faviconUrl}
          alt=""
          aria-hidden="true"
          className="mt-0.5 size-3 shrink-0 rounded-sm"
          onError={() => setFaviconFailed(true)}
        />
      ) : (
        <Icon
          aria-hidden
          icon={Globe02Icon}
          className=" size-3 mt-0.5 shrink-0 text-muted-foreground"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center justify-between gap-1.5">
          <span className="truncate text-xs font-medium">{project.name}</span>
        </span>
        {/*<span className="block truncate text-xs text-muted-foreground">{project.url}</span>*/}
      </span>
    </button>
  )
}
