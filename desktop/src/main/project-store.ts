import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import {
  addProject as addProjectToList,
  sortProjectsNewestFirst,
  type NewProjectInput,
  type Project
} from '../shared/project'

const WRITE_DEBOUNCE_MS = 250

interface ProjectsFile {
  projects: Project[]
}

export class ProjectStore {
  private projects: Project[] = []
  private readonly filePath: string
  private writeTimer: ReturnType<typeof setTimeout> | null = null
  private onChange: ((projects: Project[]) => void) | null = null

  constructor(userDataPath = app.getPath('userData')) {
    this.filePath = join(userDataPath, 'projects.json')
    this.load()
  }

  setOnChange(listener: (projects: Project[]) => void): void {
    this.onChange = listener
  }

  list(): Project[] {
    return sortProjectsNewestFirst(this.projects)
  }

  add(input: NewProjectInput, pageTitle: string): Project {
    const id = randomUUID()
    const createdAt = Date.now()
    const before = this.projects
    this.projects = addProjectToList(before, input, pageTitle, id, createdAt)
    const project = this.projects.find((entry) => entry.id === id)
    if (!project) {
      throw new Error('Failed to create project')
    }
    this.scheduleWrite()
    this.onChange?.(this.list())
    return project
  }

  destroy(): void {
    if (this.writeTimer !== null) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
      this.flushWrite()
    }
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      this.projects = []
      return
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as ProjectsFile
      this.projects = Array.isArray(parsed.projects) ? parsed.projects : []
    } catch {
      this.projects = []
    }
  }

  private scheduleWrite(): void {
    if (this.writeTimer !== null) {
      clearTimeout(this.writeTimer)
    }
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null
      this.flushWrite()
    }, WRITE_DEBOUNCE_MS)
  }

  private flushWrite(): void {
    const dir = join(this.filePath, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const payload: ProjectsFile = { projects: this.projects }
    writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8')
  }
}
