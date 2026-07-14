import Store from 'electron-store'
import { randomUUID } from 'crypto'
import {
  addProject as addProjectToList,
  dedupeProjectsByUrl,
  findProjectsByUrl,
  sortProjectsNewestFirst,
  type NewProjectInput,
  type Project
} from '../../shared/project'

interface ProjectsSchema {
  projects: Project[]
}

export class ProjectStore {
  private projects: Project[]
  private readonly store: Store<ProjectsSchema>
  private onChange: ((projects: Project[]) => void) | null = null

  constructor() {
    this.store = new Store<ProjectsSchema>({ name: 'projects', defaults: { projects: [] } })
    this.projects = dedupeProjectsByUrl(this.store.get('projects'))
  }

  setOnChange(listener: (projects: Project[]) => void): void {
    this.onChange = listener
  }

  list(): Project[] {
    return sortProjectsNewestFirst(dedupeProjectsByUrl(this.projects))
  }

  toggle(input: NewProjectInput, pageTitle: string): Project[] {
    const deduped = dedupeProjectsByUrl(this.projects)
    const matches = findProjectsByUrl(deduped, input.url)

    this.projects =
      matches.length > 0
        ? deduped.filter((project) => !matches.some((match) => match.id === project.id))
        : addProjectToList(deduped, input, pageTitle, randomUUID(), Date.now())

    this.store.set('projects', this.projects)
    const next = this.list()
    this.onChange?.(next)
    return next
  }

  destroy(): void {
    // no-op: electron-store writes synchronously on every mutation
  }
}
