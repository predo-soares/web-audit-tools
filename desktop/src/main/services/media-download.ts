import { dialog, session, type BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import { basename } from 'node:path'

export interface MediaDownloadResult {
  saved: boolean
  filePath?: string
}

// Minimal MIME → extension map for the asset types the audit surfaces. Anything
// unrecognised falls back to the URL's own extension, then `bin`.
const MIME_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/bmp': 'bmp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'weba'
}

function extensionFor(mime: string | null, url: string): string {
  if (mime && MIME_EXTENSION[mime.toLowerCase()]) return MIME_EXTENSION[mime.toLowerCase()]
  const match = /\.([a-z0-9]{1,5})(?:[?#].*)?$/i.exec(url)
  return match ? match[1].toLowerCase() : 'bin'
}

function ensureExtension(name: string, extension: string): string {
  return /\.[a-z0-9]{1,5}$/i.test(name) ? name : `${name}.${extension}`
}

/** Decode a `data:` URI into raw bytes plus its declared MIME type. */
function decodeDataUri(url: string): { buffer: Buffer; mime: string | null } {
  const comma = url.indexOf(',')
  if (comma === -1) throw new Error('Malformed data URI')
  const meta = url.slice(5, comma)
  const data = url.slice(comma + 1)
  const isBase64 = /;base64$/i.test(meta)
  const mime = meta.replace(/;base64$/i, '') || null
  const buffer = isBase64
    ? Buffer.from(data, 'base64')
    : Buffer.from(decodeURIComponent(data), 'utf-8')
  return { buffer, mime }
}

/**
 * Save a media asset (image/audio/video) referenced by a URL to disk. Fetches
 * through the shared preview session so the same cookies the page used apply,
 * decodes `data:` URIs locally, and prompts for a destination.
 */
export async function downloadMedia(
  parentWindow: BrowserWindow | null,
  url: string,
  previewSession: Electron.Session | null,
  suggestedName?: string
): Promise<MediaDownloadResult> {
  let buffer: Buffer
  let mime: string | null = null

  if (url.startsWith('data:')) {
    ;({ buffer, mime } = decodeDataUri(url))
  } else {
    const activeSession = previewSession ?? session.defaultSession
    const response = await activeSession.fetch(url)
    if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`)
    mime = response.headers.get('content-type')?.split(';')[0]?.trim() ?? null
    buffer = Buffer.from(await response.arrayBuffer())
  }

  const extension = extensionFor(mime, url)
  const baseName = suggestedName?.trim() || (url.startsWith('data:') ? 'media' : basename(url))
  const defaultName = ensureExtension(baseName.split(/[?#]/)[0] || 'media', extension)

  const options = {
    title: 'Save media',
    defaultPath: defaultName,
    filters: [{ name: 'Media', extensions: [extension] }]
  }
  const { canceled, filePath } = parentWindow
    ? await dialog.showSaveDialog(parentWindow, options)
    : await dialog.showSaveDialog(options)

  if (canceled || !filePath) return { saved: false }

  await writeFile(filePath, buffer)
  return { saved: true, filePath }
}
