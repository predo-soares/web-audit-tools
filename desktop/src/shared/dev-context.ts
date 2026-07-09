export interface DevContext {
  repoPath: string
  branch: string | null
  commit: string | null
}

export function isLocalhostUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}
