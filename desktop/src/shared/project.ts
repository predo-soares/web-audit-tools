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
    url: input.url,
    faviconUrl: input.faviconUrl,
    createdAt
  }
  return sortProjectsNewestFirst([project, ...projects])
}

export function isCommittedPageUrl(url: string): boolean {
  const trimmed = url.trim()
  return trimmed.length > 0 && trimmed !== 'about:blank'
}
