import { mkdir, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { basename, join } from 'path'
import { DEVICE_PRESETS } from '../../shared/device-presets'
import { isLocalhostUrl } from '../../shared/dev-context'
import { isConsoleProblem, isNetworkProblem } from '../../shared/runtime-evidence'
import type { DevContext } from '../../shared/dev-context'
import type { RuntimeEvidenceSnapshot } from '../../shared/runtime-evidence'
import type { PaneId } from '../../shared/types'
import type { SnapshotResult } from '../../shared/snapshot'
import { CATEGORY_LABEL, type AuditJobState, type AuditResult } from '../../shared/seo-audit'
import { sanitizeUrl } from '../../shared/seo-sanitize'

export type { SnapshotResult }

export interface SnapshotPort {
  isAnyPaneLoading(): boolean
  getActivePaneId(): PaneId | null
  getActivePaneUrl(): string | null
  getActivePaneTitle(): string
  getLastNavTimestamp(paneId: PaneId): number | null
  getRuntimeEvidenceSnapshot(): RuntimeEvidenceSnapshot
  captureActivePaneScreenshot(): Promise<Buffer>
  getDevContext(): DevContext | null
}

export interface SnapshotDeps {
  /** Returns current time as milliseconds since epoch. Used for both the capture timestamp and the soft-wait deadline. */
  nowMs?: () => number
  wait?: (ms: number) => Promise<void>
  writeClipboard?: (text: string) => void
  mkdirBundle?: (path: string) => Promise<void>
  writePng?: (path: string, data: Buffer) => Promise<void>
  writeMd?: (path: string, data: string) => Promise<void>
  writeJson?: (path: string, data: string) => Promise<void>
}
export interface SnapshotOptions {
  includeSeoAudit?: boolean
  seoAuditState?: AuditJobState
}

const CONSOLE_SNAPSHOT_CAP = 100
const SOFT_WAIT_CEILING_MS = 2000
const SOFT_WAIT_INTERVAL_MS = 100

const HTTP_STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout'
}

function makeTimestampSlug(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

function makeDeviceSlug(paneId: PaneId): string {
  return DEVICE_PRESETS[paneId].name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatDeviceHeader(paneId: PaneId): string {
  const preset = DEVICE_PRESETS[paneId]
  const touch = preset.touch ? 'touch' : 'no touch'
  return `${preset.name} (${preset.width}x${preset.height} @${preset.deviceScaleFactor}x, ${touch})`
}

function buildContextMd(options: {
  capturedAt: Date
  paneId: PaneId
  url: string
  title: string
  lastNavTimestamp: number | null
  evidence: RuntimeEvidenceSnapshot
  devContext: DevContext | null
  isLocalhost: boolean
  slug: string
  seoAudit?: { result: AuditResult; stale: boolean; incomplete: boolean }
}): string {
  const {
    capturedAt,
    paneId,
    url,
    title,
    lastNavTimestamp,
    evidence,
    devContext,
    isLocalhost,
    slug,
    seoAudit
  } = options

  const consoleProblemEntries = evidence.console
    .filter((e) => isConsoleProblem(e.level))
    .slice(-CONSOLE_SNAPSHOT_CAP)

  const networkFailureEntries = evidence.network.filter((e) => isNetworkProblem(e))

  const lines: string[] = []

  lines.push('# Audit Web Tools Capture')
  lines.push(`Captured: ${capturedAt.toISOString()}`)
  lines.push('')
  lines.push('## Project Context')

  if (!isLocalhost || !devContext) {
    lines.push('Local project: not detected')
  } else {
    const name = basename(devContext.repoPath)
    lines.push(`Local project: ${name} (${devContext.repoPath})`)
    const branch = devContext.branch ?? '(detached)'
    const shortCommit = devContext.commit ? devContext.commit.slice(0, 7) : 'unknown'
    const dirty = devContext.dirty ? 'yes' : 'no'
    lines.push(`Branch: ${branch} | Commit: ${shortCommit} | Dirty: ${dirty}`)
  }

  lines.push('')
  lines.push(`## Active Pane: ${formatDeviceHeader(paneId)}`)
  lines.push(`URL: ${url}`)
  lines.push(`Title: ${title}`)
  lines.push(
    `Last navigation: ${lastNavTimestamp != null ? new Date(lastNavTimestamp).toISOString() : 'unknown'}`
  )
  lines.push(`Screenshot: ./${slug}.png`)
  lines.push('')
  lines.push(`### Console problems (${consoleProblemEntries.length})`)
  for (const entry of consoleProblemEntries) {
    lines.push(`[${entry.level.toUpperCase()}] ${entry.message}`)
    if (entry.sourceUrl) {
      const loc = entry.line != null ? `:${entry.line}` : ''
      lines.push(`    at ${entry.sourceUrl}${loc}`)
    }
  }
  lines.push('')
  lines.push(`### Network failures (${networkFailureEntries.length})`)
  for (const entry of networkFailureEntries) {
    if (entry.status != null) {
      const text = HTTP_STATUS_TEXT[entry.status] ?? ''
      lines.push(`${entry.method} ${entry.path} → ${entry.status}${text ? ` ${text}` : ''}`)
    } else {
      lines.push(`${entry.method} ${entry.path}`)
    }
  }
  if (seoAudit) {
    const actionable = seoAudit.result.findings.filter((item) => item.remediation)
    lines.push('', '## Page SEO Audit')
    lines.push(
      `State: completed${seoAudit.stale ? ', stale' : ''}${seoAudit.incomplete ? ', incomplete' : ''}`
    )
    lines.push(`Rule catalog: ${seoAudit.result.ruleCatalogVersion}`)
    lines.push(`Machine-readable result: ./seo-audit.json`)
    lines.push('Category counts:')
    for (const category of Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[])
      lines.push(
        `- ${CATEGORY_LABEL[category]}: ${seoAudit.result.findings.filter((item) => item.category === category).length}`
      )
    lines.push(`Actionable findings (${actionable.length}):`)
    for (const item of actionable)
      lines.push(`- [${item.outcome}] ${item.ruleId}: ${item.summary} — ${item.remediation}`)
  }

  return lines.join('\n')
}

export async function captureSnapshot(
  port: SnapshotPort,
  deps?: SnapshotDeps,
  options: SnapshotOptions = {}
): Promise<SnapshotResult> {
  const nowMs = deps?.nowMs ?? (() => Date.now())
  const wait = deps?.wait ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const writeClipboardText =
    deps?.writeClipboard ??
    ((text) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { clipboard } = require('electron') as typeof import('electron')
      clipboard.writeText(text)
    })
  const mkdirBundle =
    deps?.mkdirBundle ?? ((path) => mkdir(path, { recursive: true }).then(() => {}))
  const writePng = deps?.writePng ?? ((path, data) => writeFile(path, data))
  const writeMd = deps?.writeMd ?? ((path, data) => writeFile(path, data, 'utf-8').then(() => {}))
  const writeJson =
    deps?.writeJson ?? ((path, data) => writeFile(path, data, 'utf-8').then(() => {}))

  // Soft wait: poll until all panes settle or 2-second ceiling
  const deadline = nowMs() + SOFT_WAIT_CEILING_MS
  while (port.isAnyPaneLoading() && nowMs() < deadline) {
    await wait(SOFT_WAIT_INTERVAL_MS)
  }
  const warningCount = port.isAnyPaneLoading() ? 1 : 0

  // Guard: active pane must have a committed URL
  const url = port.getActivePaneUrl()
  if (!url || url === 'about:blank') {
    return { ok: false, reason: 'no-url' }
  }

  const paneId = port.getActivePaneId() ?? 'desktop'
  const capturedAt = new Date(nowMs())
  const isLocalhost = isLocalhostUrl(url)

  let png: Buffer
  try {
    png = await port.captureActivePaneScreenshot()
  } catch (error) {
    return { ok: false, reason: `screenshot-failed: ${String(error)}` }
  }

  const evidence = port.getRuntimeEvidenceSnapshot()
  const devContext = isLocalhost ? port.getDevContext() : null
  const title = port.getActivePaneTitle()
  const lastNavTimestamp = port.getLastNavTimestamp(paneId)
  const slug = makeDeviceSlug(paneId)
  const timestamp = makeTimestampSlug(capturedAt)
  const bundleDir = join(homedir(), '.audit-screens', 'captures', timestamp)

  const contextMd = buildContextMd({
    capturedAt,
    paneId,
    url: sanitizeUrl(url),
    title,
    lastNavTimestamp,
    evidence,
    devContext,
    isLocalhost,
    slug,
    seoAudit:
      options.includeSeoAudit && options.seoAuditState?.result
        ? {
            result: options.seoAuditState.result,
            stale: options.seoAuditState.stale,
            incomplete: options.seoAuditState.incomplete
          }
        : undefined
  })

  try {
    await mkdirBundle(bundleDir)
    await writeMd(join(bundleDir, 'context.md'), contextMd)
    await writePng(join(bundleDir, `${slug}.png`), png)
    if (options.includeSeoAudit && options.seoAuditState?.result)
      await writeJson(
        join(bundleDir, 'seo-audit.json'),
        serializeSeoAudit(options.seoAuditState.result)
      )
  } catch (error) {
    return { ok: false, reason: `write-failed: ${String(error)}` }
  }

  const clipboardText = `Read this Audit Web Tools capture and use it to diagnose the issue I am seeing:\n~/.audit-screens/captures/${timestamp}/context.md`
  writeClipboardText(clipboardText)

  return { ok: true, warningCount }
}

export function serializeSeoAudit(result: AuditResult): string {
  const blocked =
    /^(cookie|cookies|set-cookie|authorization|proxy-authorization|storage|requestBody|responseBody|body|html)$/i
  return JSON.stringify(
    result,
    (key, value) => {
      if (blocked.test(key)) return undefined
      if (typeof value === 'string' && /^https?:\/\//i.test(value)) return sanitizeUrl(value)
      return value
    },
    2
  )
}
