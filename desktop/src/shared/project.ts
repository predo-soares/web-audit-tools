import { normalizeUrl } from './url'

export interface Project {
  id: string
  name: string
  url: string
  faviconUrl: string | null
  createdAt: number
}

export interface NewProjectInput {
  name: string
  url: string
  faviconUrl: string | null
}

export function suggestProjectName(
  pageTitle: string,
  url: string
): string {
  const trimmedTitle = pageTitle.trim()
  if (trimmedTitle) return trimmedTitle

  try {
    const parsed = new URL(url)
    if (parsed.hostname) return parsed.hostname
  } catch {
    // Fall through to full URL.
  }

  return url.trim()
}

export function resolveProjectName(
  editedName: string,
  pageTitle: string,
  url: string
): string {
  const trimmed = editedName.trim()
  if (trimmed) return trimmed
  return suggestProjectName(pageTitle, url)
}

export function sortProjectsNewestFirst(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => b.createdAt - a.createdAt)
}

export function normalizeProjectUrl(url: string): string {
  const normalized = normalizeUrl(url).trim()
  if (!normalized) return normalized

  try {
    const parsed = new URL(normalized)
    if (parsed.pathname === '/') {
      parsed.pathname = ''
    } else if (parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.toString()
  } catch {
    return normalized
  }
}

export function getProjectUrlKey(project: Pick<Project, 'url'>): string {
  return normalizeProjectUrl(project.url)
}

export function findProjectsByUrl(projects: Project[], url: string): Project[] {
  const target = normalizeProjectUrl(url)
  if (!target) return []
  return projects.filter((project) => getProjectUrlKey(project) === target)
}

export function addProject(
  projects: Project[],
  input: NewProjectInput,
  pageTitle: string,
  id: string,
  createdAt: number
): Project[] {
  const project: Project = {
    id,
    name: resolveProjectName(input.name, pageTitle, input.url),
    url: normalizeProjectUrl(input.url),
    faviconUrl: input.faviconUrl,
    createdAt
  }
  return sortProjectsNewestFirst([project, ...projects])
}

export function isCommittedPageUrl(url: string): boolean {
  const trimmed = url.trim()
  return trimmed.length > 0 && trimmed !== 'about:blank'
}

export function hasProjectForUrl(projects: Project[], url: string): boolean {
  return findProjectsByUrl(projects, url).length > 0
}

export function dedupeProjectsByUrl(projects: Project[]): Project[] {
  const sorted = sortProjectsNewestFirst(projects)
  const seen = new Set<string>()

  return sorted.filter((project) => {
    const key = getProjectUrlKey(project)
    if (!key || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
