import { useCallback, useEffect, useState } from 'react'
import type { Project } from '../../../shared/project'

export function useProjects(): {
  projects: Project[]
  toggleProject: (input: {
    name: string
    url: string
    faviconUrl: string | null
    pageTitle: string
  }) => Promise<Project[]>
} {
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    void window.api.listProjects().then(setProjects)
    const unsubscribe = window.api.onProjectsChanged(setProjects)
    return unsubscribe
  }, [])

  const toggleProject = useCallback(
    async (input: { name: string; url: string; faviconUrl: string | null; pageTitle: string }) => {
      const nextProjects = await window.api.toggleProject(input)
      setProjects(nextProjects)
      return nextProjects
    },
    []
  )

  return { projects, toggleProject }
}
