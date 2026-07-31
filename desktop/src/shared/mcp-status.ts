/**
 * Shared status contract for the local MCP server, surfaced to the renderer's
 * Settings view so the user can see whether an MCP-aware agent can reach the
 * live panes. The main process owns the source of truth and broadcasts changes.
 */

export interface McpToolSummary {
  /** The tool id an agent invokes. */
  name: string
  /** Human-readable purpose, shown in the Settings view. */
  title: string
}

export type McpServerStatus =
  | { state: 'starting' }
  | {
      state: 'listening'
      /** The loopback URL an MCP client connects to. */
      url: string
      host: string
      port: number
      path: string
      tools: McpToolSummary[]
    }
  | { state: 'error'; message: string }

/**
 * Display metadata for the tools registered in {@link registerMcpTools}. Kept
 * here (not derived from the SDK) so the renderer can list them without reaching
 * into the server. Keep in sync with the registrations in `main/mcp/mcp-tools.ts`.
 */
export const MCP_TOOL_SUMMARIES: McpToolSummary[] = [
  { name: 'navigate', title: 'Navigate all device panes' },
  { name: 'captureBundle', title: 'Capture an agent handoff bundle' },
  { name: 'list_devices', title: 'List available device panes' },
  { name: 'set_active_pane', title: 'Set the active device pane' },
  { name: 'set_devices', title: 'Choose which device panes are shown' },
  { name: 'screenshot', title: 'Screenshot a device pane' },
  { name: 'get_observed_context', title: 'Read observed page context' },
  { name: 'reload', title: 'Reload the device panes' },
  { name: 'run_audit', title: 'Run the SEO audit' },
  { name: 'get_audit', title: 'Read the latest SEO audit' },
  { name: 'run_lighthouse', title: 'Run a Lighthouse assessment' },
  { name: 'get_lighthouse_state', title: 'Read the latest Lighthouse state' }
]
