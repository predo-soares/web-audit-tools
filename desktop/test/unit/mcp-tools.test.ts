import { describe, expect, it } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { registerMcpTools } from '../../src/main/mcp/mcp-tools'
import type { CaptureBundleResult, McpToolPort } from '../../src/main/mcp/mcp-tool-port'

interface FakePort extends McpToolPort {
  navigateCalls: string[]
  captureBundleCalls: number
}

function makePort(overrides?: Partial<McpToolPort>): FakePort {
  const navigateCalls: string[] = []
  let captureBundleCalls = 0
  const port: FakePort = {
    navigateCalls,
    get captureBundleCalls() {
      return captureBundleCalls
    },
    navigateAll: async (url) => {
      navigateCalls.push(url)
    },
    captureBundle: async (): Promise<CaptureBundleResult> => {
      captureBundleCalls++
      return {
        ok: true,
        pointer: '/home/user/.audit-screens/captures/x/context.md',
        warningCount: 0
      }
    },
    ...overrides
  }
  return port
}

/** Build a client connected to a server registered against the given fake port. */
async function connect(port: McpToolPort): Promise<Client> {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerMcpTools(server, port)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return client
}

function textOf(result: CallToolResult): string {
  return result.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

describe('registerMcpTools', () => {
  it('lists navigate and captureBundle with descriptions', async () => {
    const client = await connect(makePort())
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain('navigate')
    expect(names).toContain('captureBundle')
    for (const tool of tools) expect(tool.description).toBeTruthy()
  })

  describe('navigate', () => {
    it('delegates to navigateAll with a normalized URL and reports success', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'navigate',
        arguments: { url: 'localhost:3000' }
      })) as CallToolResult
      expect(port.navigateCalls).toEqual(['http://localhost:3000/'])
      expect(result.isError).toBeFalsy()
      expect(textOf(result)).toContain('http://localhost:3000/')
    })

    it('returns a structured error and does not navigate when the URL is empty', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'navigate',
        arguments: { url: '   ' }
      })) as CallToolResult
      expect(result.isError).toBe(true)
      expect(textOf(result)).toMatch(/no url/i)
      expect(port.navigateCalls).toEqual([])
    })
  })

  describe('captureBundle', () => {
    it('delegates to captureBundle and returns the bundle pointer', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'captureBundle',
        arguments: {}
      })) as CallToolResult
      expect(port.captureBundleCalls).toBe(1)
      expect(result.isError).toBeFalsy()
      expect(textOf(result)).toContain('/home/user/.audit-screens/captures/x/context.md')
    })

    it('surfaces a still-loading warning in the success text', async () => {
      const port = makePort({
        captureBundle: async () => ({
          ok: true,
          pointer: '/tmp/context.md',
          warningCount: 1
        })
      })
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'captureBundle',
        arguments: {}
      })) as CallToolResult
      expect(textOf(result)).toMatch(/still loading/i)
    })

    it('returns a structured error when no URL is loaded', async () => {
      const port = makePort({
        captureBundle: async () => ({ ok: false, reason: 'no-url' })
      })
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'captureBundle',
        arguments: {}
      })) as CallToolResult
      expect(result.isError).toBe(true)
      expect(textOf(result)).toMatch(/no url is loaded/i)
    })
  })
})
