import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { PANE_IDS } from '../../shared/device-presets'
import { isConsoleProblem, isNetworkProblem } from '../../shared/runtime-evidence'
import {
  CATEGORY_LABEL,
  INDEXING_INTENT_LABEL,
  type AuditResult,
  type IndexingIntent
} from '../../shared/seo-audit'
import { LIGHTHOUSE_PROFILES, type LighthouseAssessmentState } from '../../shared/lighthouse'
import type { PaneId } from '../../shared/pane-types'
import { normalizeUrl } from '../../shared/url'
import type { DeviceInfo, McpToolPort, ObservedContext } from './mcp-tool-port'

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

function isKnownDevice(device: string): device is PaneId {
  return (PANE_IDS as string[]).includes(device)
}

function unknownDeviceMessage(device: string): string {
  return `Unknown device "${device}". Known devices: ${PANE_IDS.join(', ')}.`
}

function formatDeviceLine(device: DeviceInfo): string {
  const flags = [device.active ? 'active' : null, device.visible ? 'visible' : 'hidden']
    .filter(Boolean)
    .join(', ')
  return `- ${device.id} — ${device.name} (${device.width}x${device.height} @${device.deviceScaleFactor}x, ${device.touch ? 'touch' : 'no touch'}) [${flags}]`
}

/**
 * A well-known, recoverable failure (no URL loaded, unknown device, …). Returned
 * as an error result the agent can read and act on, never thrown as an opaque
 * transport error.
 */
function errorResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

function captureBundleFailureMessage(reason: string): string {
  if (reason === 'no-url') {
    return 'Cannot capture a bundle: no URL is loaded in the active pane. Navigate to a URL first.'
  }
  return `Could not capture a bundle: ${reason}.`
}

function formatObservedContext(ctx: ObservedContext): string {
  const lines: string[] = []
  lines.push(`Active pane: ${ctx.device.name} (${ctx.device.id})`)
  lines.push(`URL: ${ctx.url ?? '(none loaded)'}`)
  lines.push(`Title: ${ctx.title || '(untitled)'}`)
  lines.push(
    `Last navigation: ${ctx.lastNavTimestamp != null ? new Date(ctx.lastNavTimestamp).toISOString() : 'unknown'}`
  )

  lines.push('', 'Project context:')
  if (!ctx.devContext) {
    lines.push('  (not a local project, or no pane on localhost)')
  } else {
    const branch = ctx.devContext.branch ?? '(detached)'
    const commit = ctx.devContext.commit ? ctx.devContext.commit.slice(0, 7) : 'unknown'
    lines.push(`  Repo: ${ctx.devContext.repoPath}`)
    lines.push(
      `  Branch: ${branch} | Commit: ${commit} | Dirty: ${ctx.devContext.dirty ? 'yes' : 'no'}`
    )
  }

  const consoleProblems = ctx.evidence.console.filter((entry) => isConsoleProblem(entry.level))
  lines.push('', `Console problems (${consoleProblems.length}):`)
  for (const entry of consoleProblems) {
    lines.push(`  [${entry.level.toUpperCase()}] ${entry.message}`)
    if (entry.sourceUrl)
      lines.push(`    at ${entry.sourceUrl}${entry.line != null ? `:${entry.line}` : ''}`)
  }

  const networkFailures = ctx.evidence.network.filter((entry) => isNetworkProblem(entry))
  lines.push('', `Network failures (${networkFailures.length}):`)
  for (const entry of networkFailures) {
    lines.push(`  ${entry.method} ${entry.path}${entry.status != null ? ` → ${entry.status}` : ''}`)
  }

  return lines.join('\n')
}

const KNOWN_INDEXING_INTENTS = Object.keys(INDEXING_INTENT_LABEL) as IndexingIntent[]

function isIndexingIntent(value: string): value is IndexingIntent {
  return (KNOWN_INDEXING_INTENTS as string[]).includes(value)
}

function auditFailureMessage(reason: string): string {
  switch (reason) {
    case 'no-url':
      return 'Cannot run an audit: no URL is loaded in the active pane. Navigate to a URL first.'
    case 'busy':
      return 'An audit is already running. Wait for it to finish, then read it with get_audit.'
    case 'cancelled':
      return 'The audit was cancelled (the pane navigated or reloaded before it completed).'
    default:
      return 'The audit could not be completed. Try again once the page has settled.'
  }
}

function formatAuditResult(
  result: AuditResult,
  meta?: { stale?: boolean; incomplete?: boolean }
): string {
  const lines: string[] = []
  const flags = [meta?.stale ? 'stale' : null, meta?.incomplete ? 'incomplete' : null]
    .filter(Boolean)
    .join(', ')
  lines.push(`Page SEO audit for ${result.url}${flags ? ` (${flags})` : ''}`)
  lines.push(
    `Indexing intent: ${result.indexingIntent} | Rule catalog: ${result.ruleCatalogVersion}`
  )

  lines.push('', 'Findings by category:')
  for (const category of Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]) {
    const count = result.findings.filter((finding) => finding.category === category).length
    lines.push(`  ${CATEGORY_LABEL[category]}: ${count}`)
  }

  const actionable = result.findings.filter((finding) => finding.remediation)
  lines.push('', `Actionable findings (${actionable.length}):`)
  for (const finding of actionable) {
    lines.push(`  [${finding.outcome}] ${finding.ruleId}: ${finding.summary}`)
    lines.push(`    Impact: ${finding.impact}`)
    if (finding.remediation) lines.push(`    Fix: ${finding.remediation}`)
  }

  return lines.join('\n')
}

function formatScore(score: number | null): string {
  return score == null ? 'n/a' : `${Math.round(score * 100)}`
}

function formatLighthouseState(state: LighthouseAssessmentState): string {
  const lines: string[] = [`Lighthouse state: ${state.phase}`]
  if (state.phase === 'failed') lines.push(`Error: ${state.error}`)

  let anyResult = false
  for (const profile of LIGHTHOUSE_PROFILES) {
    const result = state.results[profile]
    if (!result) continue
    anyResult = true
    lines.push('', `${profile}${result.stale ? ' (stale)' : ''}:`)
    for (const category of result.categories) {
      lines.push(`  ${category.title}: ${formatScore(category.score)}`)
    }
  }
  if (!anyResult) lines.push('', 'No Lighthouse results yet.')

  return lines.join('\n')
}

/**
 * Register every MCP tool against the given server, delegating to the narrow
 * `McpToolPort`. Each tool has a descriptive name and description so its purpose
 * is legible in the agent's tool list and logs.
 */
export function registerMcpTools(server: McpServer, port: McpToolPort): void {
  server.registerTool(
    'navigate',
    {
      title: 'Navigate all device panes',
      description:
        'Load a URL across every device pane in Audit Web Tools, exactly like typing it in the URL bar. Drives all linked panes and the active pane identically to human navigation.',
      inputSchema: {
        url: z
          .string()
          .describe('The URL to load. A bare host (e.g. "localhost:3000") is normalized.')
      }
    },
    async ({ url }) => {
      const normalized = normalizeUrl(url ?? '')
      if (!normalized || normalized === 'about:blank') {
        return errorResult('No URL provided. Pass a non-empty URL to navigate to.')
      }
      await port.navigateAll(normalized)
      return textResult(`Navigated all device panes to ${normalized}.`)
    }
  )

  server.registerTool(
    'captureBundle',
    {
      title: 'Capture an agent handoff bundle',
      description:
        'Produce a capture bundle (screenshot + runtime evidence + project context) for the active pane via the existing Share-with-agent pipeline, and return a pointer to the written context.md.',
      inputSchema: {}
    },
    async () => {
      const result = await port.captureBundle()
      if (!result.ok) {
        return errorResult(captureBundleFailureMessage(result.reason))
      }
      const warning =
        result.warningCount > 0 ? ' Note: at least one pane was still loading when captured.' : ''
      return textResult(`Capture bundle written.${warning}\nRead it here: ${result.pointer}`)
    }
  )

  server.registerTool(
    'list_devices',
    {
      title: 'List device presets',
      description:
        'List the available device presets, which are currently visible on the canvas, and which is the active pane.',
      inputSchema: {}
    },
    async () => {
      const devices = port.listDevices()
      return textResult(['Device presets:', ...devices.map(formatDeviceLine)].join('\n'))
    }
  )

  server.registerTool(
    'set_active_pane',
    {
      title: 'Set the active device pane',
      description:
        'Switch which device is the active pane — the one the toolbar, URL bar, and observed-context / screenshot reads reflect.',
      inputSchema: {
        device: z.string().describe(`The device preset id (${PANE_IDS.join(', ')}).`)
      }
    },
    async ({ device }) => {
      if (!isKnownDevice(device)) return errorResult(unknownDeviceMessage(device))
      port.setActivePane(device)
      return textResult(`Active pane is now ${device}.`)
    }
  )

  server.registerTool(
    'set_devices',
    {
      title: 'Set visible device panes',
      description:
        'Set which device panes are visible on the canvas. Pass every device to show all panes, or a single device to solo it.',
      inputSchema: {
        devices: z
          .array(z.string())
          .min(1)
          .describe(`Device preset ids to show (${PANE_IDS.join(', ')}).`)
      }
    },
    async ({ devices }) => {
      const unknown = devices.find((device) => !isKnownDevice(device))
      if (unknown) return errorResult(unknownDeviceMessage(unknown))
      const result = port.setVisibleDevices(devices as PaneId[])
      if (!result.ok) {
        return errorResult(
          'Showing an arbitrary subset of panes is not supported. Pass every device to show all, or a single device to solo it.'
        )
      }
      return textResult(`Visible device panes: ${[...new Set(devices)].join(', ')}.`)
    }
  )

  server.registerTool(
    'screenshot',
    {
      title: 'Screenshot a device pane',
      description:
        'Capture the active pane (or a named device) as an image so you can reason about the rendered page visually.',
      inputSchema: {
        device: z
          .string()
          .optional()
          .describe(
            `Optional device preset id (${PANE_IDS.join(', ')}). Defaults to the active pane.`
          )
      }
    },
    async ({ device }) => {
      if (device !== undefined && !isKnownDevice(device))
        return errorResult(unknownDeviceMessage(device))
      const result = await port.screenshot(device ?? null)
      if (!result.ok) {
        const target = device ? `the ${device} pane` : 'the active pane'
        return errorResult(`Cannot capture a screenshot: no URL is loaded in ${target}.`)
      }
      return {
        content: [{ type: 'image', data: result.png.toString('base64'), mimeType: 'image/png' }]
      }
    }
  )

  server.registerTool(
    'get_observed_context',
    {
      title: 'Read the active pane observed context',
      description:
        "Read the active pane's runtime evidence (console problems and network failures), pane metadata (device, URL, title), and dev context (repo, branch, commit) when a pane is on localhost. This is the same evidence the diagnostics drawer shows.",
      inputSchema: {}
    },
    async () => {
      return textResult(formatObservedContext(port.getObservedContext()))
    }
  )

  server.registerTool(
    'reload',
    {
      title: 'Reload all device panes',
      description:
        'Reload every pane so you can verify a code change and then re-read observed context or re-run an audit.',
      inputSchema: {}
    },
    async () => {
      await port.reload()
      return textResult('Reloaded all device panes.')
    }
  )

  server.registerTool(
    'run_audit',
    {
      title: 'Run a Page SEO audit',
      description:
        'Run a Page SEO audit on the active pane, await completion, and return the findings (outcome, impact, and remediation) grouped by category.',
      inputSchema: {
        indexingIntent: z
          .string()
          .optional()
          .describe(
            `How the page is meant to be indexed (${KNOWN_INDEXING_INTENTS.join(', ')}). Defaults to "indexable".`
          )
      }
    },
    async ({ indexingIntent }) => {
      const intent = indexingIntent ?? 'indexable'
      if (!isIndexingIntent(intent)) {
        return errorResult(
          `Unknown indexing intent "${intent}". Use one of: ${KNOWN_INDEXING_INTENTS.join(', ')}.`
        )
      }
      const result = await port.runAudit(intent)
      if (!result.ok) return errorResult(auditFailureMessage(result.reason))
      return textResult(formatAuditResult(result.result))
    }
  )

  server.registerTool(
    'get_audit',
    {
      title: 'Read the latest Page SEO audit',
      description:
        'Return the most recent Page SEO audit result without re-running it, noting when it is stale (the pane has navigated or reloaded since).',
      inputSchema: {}
    },
    async () => {
      const state = port.getAudit()
      if (!state.result) {
        if (state.phase === 'running') {
          return textResult('An audit is currently running. Read it again once it completes.')
        }
        return textResult('No audit has been run yet. Use run_audit to run one.')
      }
      return textResult(
        formatAuditResult(state.result, { stale: state.stale, incomplete: state.incomplete })
      )
    }
  )

  server.registerTool(
    'run_lighthouse',
    {
      title: 'Run Lighthouse',
      description:
        'Run Lighthouse (mobile + desktop) for the active pane, await completion, and return the category scores so you can verify a performance change.',
      inputSchema: {}
    },
    async () => {
      const result = await port.runLighthouse()
      if (!result.ok) {
        return errorResult(
          'Cannot run Lighthouse: no URL is loaded in the active pane. Navigate to a URL first.'
        )
      }
      return textResult(formatLighthouseState(result.state))
    }
  )

  server.registerTool(
    'get_lighthouse_state',
    {
      title: 'Read the current Lighthouse state',
      description: 'Return the current Lighthouse scores/state without re-running.',
      inputSchema: {}
    },
    async () => {
      return textResult(formatLighthouseState(port.getLighthouseState()))
    }
  )
}
