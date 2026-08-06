# Audit Web Tools MCP server

Audit Web Tools exposes a local [Model Context Protocol](https://modelcontextprotocol.io)
server so an MCP-aware agent (Claude Code, Cursor, Windsurf, VS Code MCP
extensions) can drive the running app's live device panes and read the current
observed context — without the human copy-pasting capture bundles.

The server runs **inside the Electron main process** and hosts an MCP endpoint
over **Streamable HTTP** on a fixed loopback address, so the agent talks to the
already-running app instance that owns the live panes. It starts automatically
when the app launches and shuts down when it quits.

## Install (Claude Code)

A checked-in `.mcp.json` at the repo root already registers the server:

```json
{
  "mcpServers": {
    "audit-web-tools": {
      "type": "http",
      "url": "http://127.0.0.1:4319/mcp"
    }
  }
}
```

Launch Audit Web Tools, then start Claude Code in the repo — it picks up the
server from `.mcp.json`. For other clients, point them at
`http://127.0.0.1:4319/mcp` (`type: http`).

## Verifying with the MCP Inspector

```
npx @modelcontextprotocol/inspector
```

Connect to `http://127.0.0.1:4319/mcp` (Streamable HTTP), list tools, and call
one for a round-trip against the running app.

## Tools

| Tool                   | What it does                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `navigate`             | Load a URL across every device pane, exactly like the URL bar.                                                                           |
| `captureBundle`        | Produce a capture bundle (screenshot + runtime evidence + project context) for the active pane and return a pointer to its `context.md`. |
| `list_devices`         | List the device presets, which are visible, and which is the active pane.                                                                |
| `set_active_pane`      | Switch which device is the active pane (what observed-context / screenshot reads reflect).                                               |
| `set_devices`          | Set which device panes are visible (all panes, or a single soloed pane).                                                                 |
| `screenshot`           | Capture the active pane (or a named device) as an inline image.                                                                          |
| `get_observed_context` | Read the active pane's runtime evidence, metadata, and dev context as text.                                                              |
| `reload`               | Reload every pane to verify a change.                                                                                                    |
| `run_audit`            | Run a Page SEO audit on the active pane and return the findings.                                                                         |
| `get_audit`            | Read the most recent Page SEO audit without re-running (flags staleness).                                                                |
| `run_lighthouse`       | Run Lighthouse for the active pane and return the category scores.                                                                       |
| `get_lighthouse_state` | Read the current Lighthouse state without re-running.                                                                                    |

## Security

- **Loopback only.** The HTTP server binds to `127.0.0.1`, and every request is
  additionally gated to loopback remote addresses. Nothing outside the machine
  can drive the browser or read local pages.
- **No auth beyond loopback gating.** A shared-secret header is deferred unless a
  non-loopback surface is ever added.
- **Filesystem-exposing tools are loopback-gated.** `captureBundle` returns a
  host filesystem path; it is only reachable from a loopback caller.

## Architecture

- `mcp-tools.ts` — `registerMcpTools(server, port)` registers all tools against
  the SDK's `McpServer`, delegating to a narrow `McpToolPort`. Tool inputs use
  `zod`.
- `mcp-tool-port.ts` — the `McpToolPort` interface: the only thing the tools
  depend on.
- `compose-tool-port.ts` — composes the concrete `McpToolPort` from the existing
  managers/ports (`PaneManager`, `captureSnapshot`, …). Single source of truth
  shared with the app's IPC surface.
- `mcp-server.ts` — thin transport host: a loopback `node:http` server hosting
  `StreamableHTTPServerTransport`, returning a handle with the bound URL and
  `stop()`.
