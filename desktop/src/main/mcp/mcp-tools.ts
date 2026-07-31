import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { PANE_IDS } from '../../shared/device-presets'
import type { PaneId } from '../../shared/types'
import { normalizeUrl } from '../../shared/url'
import type { DeviceInfo, McpToolPort } from './mcp-tool-port'

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
        'Load a URL across every device pane in Audit Screens, exactly like typing it in the URL bar. Drives all linked panes and the active pane identically to human navigation.',
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
}
