function canonicalizeHostname(hostname: string): string {
  if (hostname === 'youtube-nocookie.com') {
    return 'www.youtube-nocookie.com'
  }

  return hostname
}

function usesHttpByDefault(host: string): boolean {
  return (
    host === 'localhost' ||
    host.startsWith('localhost:') ||
    host === '127.0.0.1' ||
    host.startsWith('127.0.0.1:')
  )
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${usesHttpByDefault(trimmed.split('/')[0] ?? '') ? 'http' : 'https'}://${trimmed}`

  try {
    const url = new URL(withScheme)
    url.hostname = canonicalizeHostname(url.hostname)
    return url.toString()
  } catch {
    return withScheme
  }
}
