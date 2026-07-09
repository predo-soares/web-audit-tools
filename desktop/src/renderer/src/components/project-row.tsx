import { Globe02Icon } from '@hugeicons/core-free-icons'
import { Icon } from '@renderer/components/ui/icon'
import { useState } from 'react'
import type { Project } from '../../../shared/project'
import { isLocalhostUrl } from '../../../shared/dev-context'
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
  const isDev = isLocalhostUrl(project.url)

  return (
    <button
      type="button"
      data-testid={`project-row-${project.id}`}
      className={cn(
        'flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none',
        isActive && 'bg-white/10'
      )}
      onClick={() => onActivate(project)}
    >
      {project.faviconUrl && !faviconFailed ? (
        <img
          src={project.faviconUrl}
          alt=""
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 rounded-sm"
          onError={() => setFaviconFailed(true)}
        />
      ) : (
        <Icon
          aria-hidden
          icon={Globe02Icon}
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center justify-between gap-1.5">
          <span className="truncate text-sm font-medium">{project.name}</span>
          {isDev && (
            <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold leading-none bg-emerald-500/20 text-emerald-400">
              DEV
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{project.url}</span>
      </span>
    </button>
  )
}
