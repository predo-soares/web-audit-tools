import { afterEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { startMcpServer, type McpServerHandle } from '../../src/main/mcp/mcp-server'
import type { McpToolPort } from '../../src/main/mcp/mcp-tool-port'

function makePort(): McpToolPort & { navigateCalls: string[] } {
  const navigateCalls: string[] = []
  return {
    navigateCalls,
    navigateAll: async (url) => {
      navigateCalls.push(url)
    },
    captureBundle: async () => ({ ok: false, reason: 'no-url' }),
    listDevices: () => [],
    setActivePane: () => {},
    setVisibleDevices: () => ({ ok: true }),
    screenshot: async () => ({ ok: false, reason: 'no-url' })
  }
}

describe('startMcpServer (transport host smoke)', () => {
  let handle: McpServerHandle | null = null

  afterEach(async () => {
    await handle?.stop()
    handle = null
  })

  it('boots on loopback, lists tools, completes a round-trip, then stops', async () => {
    const port = makePort()
    // httpPort 0 = ephemeral, so the test never collides with a running app.
    handle = await startMcpServer({ port, httpPort: 0 })
    expect(handle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/)

    const client = new Client({ name: 'smoke-client', version: '0.0.0' })
    const transport = new StreamableHTTPClientTransport(new URL(handle.url))
    await client.connect(transport)

    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['navigate', 'captureBundle']))

    const result = (await client.callTool({
      name: 'navigate',
      arguments: { url: 'localhost:3000' }
    })) as CallToolResult
    expect(result.isError).toBeFalsy()
    expect(port.navigateCalls).toEqual(['http://localhost:3000/'])

    await client.close()
  })
})
