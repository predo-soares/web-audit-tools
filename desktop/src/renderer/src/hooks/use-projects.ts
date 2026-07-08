import { useCallback, useEffect, useState } from 'react'
import type { Project } from '../../../shared/project'

export function useProjects(): {
  projects: Project[]
  addProject: (input: {
    name: string
    url: string
    faviconUrl: string | null
    pageTitle: string
  }) => Promise<Project>
} {
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    void window.api.listProjects().then(setProjects)
    const unsubscribe = window.api.onProjectsChanged(setProjects)
    return unsubscribe
  }, [])

  const addProject = useCallback(
    async (input: {
      name: string
      url: string
      faviconUrl: string | null
      pageTitle: string
    }) => {
      const project = await window.api.addProject(input)
      setProjects((current) => {
        const without = current.filter((entry) => entry.id !== project.id)
        return [project, ...without].sort((a, b) => b.createdAt - a.createdAt)
      })
      return project
    },
    []
  )

  return { projects, addProject }
}
