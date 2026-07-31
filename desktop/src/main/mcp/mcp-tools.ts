import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { normalizeUrl } from '../../shared/url'
import type { McpToolPort } from './mcp-tool-port'

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
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
}
