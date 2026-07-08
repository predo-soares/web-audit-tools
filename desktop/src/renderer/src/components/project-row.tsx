import { Globe } from 'lucide-react'
import { useState } from 'react'
import type { Project } from '../../../shared/project'
import { cn } from '@renderer/lib/utils'

interface ProjectRowProps {
  project: Project
  onActivate: (project: Project) => void
}

export function ProjectRow({ project, onActivate }: ProjectRowProps): React.JSX.Element {
  const [faviconFailed, setFaviconFailed] = useState(false)

  return (
    <button
      type="button"
      data-testid={`project-row-${project.id}`}
      className={cn(
        'flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none'
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
        <Globe aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{project.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{project.url}</span>
      </span>
    </button>
  )
}
