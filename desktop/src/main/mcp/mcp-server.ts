import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { registerMcpTools } from './mcp-tools'
import type { McpToolPort } from './mcp-tool-port'

/**
 * Fixed loopback port the MCP endpoint binds to. It is fixed (not ephemeral) so
 * the checked-in `.mcp.json` can point at a stable URL. Overridable in tests.
 */
export const MCP_DEFAULT_PORT = 4319
export const MCP_PATH = '/mcp'
const LOOPBACK_HOST = '127.0.0.1'

export interface McpServerHandle {
  /** The bound loopback URL an MCP client connects to. */
  url: string
  /** Tear the HTTP server down cleanly. */
  stop(): Promise<void>
}

export interface StartMcpServerDeps {
  /** The composed tool port the tools delegate to. */
  port: McpToolPort
  /** Loopback port to bind. Defaults to {@link MCP_DEFAULT_PORT}; use 0 in tests for an ephemeral port. */
  httpPort?: number
  serverInfo?: { name: string; version: string }
}

function isLoopbackAddress(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('error', reject)
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8')
      if (!raw) {
        resolve(undefined)
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
  })
}

/**
 * Start a loopback-only Streamable HTTP MCP endpoint hosting Audit Web Tools
 * tools. Intentionally thin: it owns the transport lifecycle and a loopback gate,
 * and delegates all behaviour to the tool layer behind {@link McpToolPort}.
 *
 * Runs stateless — a fresh `McpServer` + transport is built per request — so
 * there is no session state to leak between agents.
 */
export function startMcpServer(deps: StartMcpServerDeps): Promise<McpServerHandle> {
  const toolPort = deps.port
  const httpPort = deps.httpPort ?? MCP_DEFAULT_PORT
  const serverInfo = deps.serverInfo ?? { name: 'audit-web-tools', version: '1.0.0' }

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Loopback gate — defence in depth on top of binding to 127.0.0.1. Every
    // tool (including captureBundle, which returns a host filesystem path) is
    // only reachable from a loopback caller, so a misconfigured remote client
    // can never drive the browser or read local paths.
    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      res.writeHead(403).end('Forbidden: loopback only')
      return
    }

    const url = new URL(req.url ?? '/', `http://${LOOPBACK_HOST}`)
    if (url.pathname !== MCP_PATH) {
      res.writeHead(404).end('Not found')
      return
    }
    if (req.method !== 'POST') {
      // Stateless server: no SSE GET stream and no session DELETE.
      res.writeHead(405, { Allow: 'POST' }).end('Method not allowed')
      return
    }

    const server = new McpServer(serverInfo)
    registerMcpTools(server, toolPort)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })

    try {
      const body = await readJsonBody(req)
      await server.connect(transport)
      await transport.handleRequest(req, res, body)
    } catch {
      if (!res.headersSent) res.writeHead(500).end('Internal error')
    }
  }

  const httpServer = http.createServer((req, res) => {
    void handle(req, res)
  })

  return new Promise<McpServerHandle>((resolve, reject) => {
    const onError = (error: Error): void => reject(error)
    httpServer.once('error', onError)
    httpServer.listen(httpPort, LOOPBACK_HOST, () => {
      httpServer.off('error', onError)
      const address = httpServer.address() as AddressInfo
      resolve({
        url: `http://${LOOPBACK_HOST}:${address.port}${MCP_PATH}`,
        stop: () =>
          new Promise<void>((resolveStop, rejectStop) => {
            httpServer.close((error) => (error ? rejectStop(error) : resolveStop()))
          })
      })
    })
  })
}
