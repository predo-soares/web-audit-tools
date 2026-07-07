export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  const host = trimmed.split('/')[0] ?? ''
  const isLocalhost =
    host === 'localhost' ||
    host.startsWith('localhost:') ||
    host === '127.0.0.1' ||
    host.startsWith('127.0.0.1:')

  return `${isLocalhost ? 'http' : 'https'}://${trimmed}`
}
