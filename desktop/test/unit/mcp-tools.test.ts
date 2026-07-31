import { describe, expect, it } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { registerMcpTools } from '../../src/main/mcp/mcp-tools'
import type {
  CaptureBundleResult,
  DeviceInfo,
  McpToolPort,
  ObservedContext
} from '../../src/main/mcp/mcp-tool-port'
import type { PaneId } from '../../src/shared/types'
import { IDLE_AUDIT_STATE, type AuditResult, type IndexingIntent } from '../../src/shared/seo-audit'
import {
  EMPTY_LIGHTHOUSE_RESULTS,
  type LighthouseAssessmentState
} from '../../src/shared/lighthouse'

interface FakePort extends McpToolPort {
  navigateCalls: string[]
  captureBundleCalls: number
  setActivePaneCalls: PaneId[]
  setVisibleDevicesCalls: PaneId[][]
  screenshotCalls: (PaneId | null)[]
  reloadCalls: number
  runAuditCalls: IndexingIntent[]
  runLighthouseCalls: number
}

const IDLE_LIGHTHOUSE_STATE: LighthouseAssessmentState = {
  phase: 'idle',
  results: { ...EMPTY_LIGHTHOUSE_RESULTS },
  error: null,
  progress: null
}

const AUDIT_RESULT = {
  id: 'audit-1',
  url: 'http://localhost:3000/',
  ruleCatalogVersion: 'test.1',
  indexingIntent: 'indexable',
  findings: [
    {
      ruleId: 'search-appearance/title-present',
      category: 'search-appearance',
      outcome: 'error',
      summary: 'Missing title',
      impact: 'Hard to identify in search.',
      remediation: 'Add a <title>.',
      evidence: { origin: 'rendered', detail: 'No title.' }
    },
    {
      ruleId: 'search-appearance/title-ok',
      category: 'search-appearance',
      outcome: 'passed',
      summary: 'Nothing to do',
      impact: 'n/a',
      remediation: null,
      evidence: { origin: 'rendered', detail: 'ok' }
    }
  ]
} as unknown as AuditResult

const FIXED_PNG = Buffer.from('fake-png-bytes')

const DEFAULT_CONTEXT: ObservedContext = {
  device: { id: 'iphone', name: 'iPhone 16 Pro' },
  url: 'http://localhost:3000/',
  title: 'My App',
  lastNavTimestamp: null,
  evidence: { paneId: 'iphone', console: [], network: [], problemCount: 0 },
  devContext: null
}

const DEFAULT_DEVICES: DeviceInfo[] = [
  {
    id: 'iphone',
    name: 'iPhone 16 Pro',
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    touch: true,
    visible: true,
    active: true
  },
  {
    id: 'desktop',
    name: 'Desktop',
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
    touch: false,
    visible: false,
    active: false
  }
]

function makePort(overrides?: Partial<McpToolPort>): FakePort {
  const navigateCalls: string[] = []
  const setActivePaneCalls: PaneId[] = []
  const setVisibleDevicesCalls: PaneId[][] = []
  const screenshotCalls: (PaneId | null)[] = []
  const runAuditCalls: IndexingIntent[] = []
  let captureBundleCalls = 0
  let reloadCalls = 0
  let runLighthouseCalls = 0
  const port: FakePort = {
    navigateCalls,
    setActivePaneCalls,
    setVisibleDevicesCalls,
    screenshotCalls,
    runAuditCalls,
    get reloadCalls() {
      return reloadCalls
    },
    get runLighthouseCalls() {
      return runLighthouseCalls
    },
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
    listDevices: () => DEFAULT_DEVICES,
    setActivePane: (device) => {
      setActivePaneCalls.push(device)
    },
    setVisibleDevices: (devices) => {
      setVisibleDevicesCalls.push(devices)
      return { ok: true }
    },
    screenshot: async (device) => {
      screenshotCalls.push(device)
      return { ok: true, png: FIXED_PNG }
    },
    getObservedContext: () => DEFAULT_CONTEXT,
    reload: async () => {
      reloadCalls++
    },
    runAudit: async (indexingIntent) => {
      runAuditCalls.push(indexingIntent)
      return { ok: true, result: AUDIT_RESULT }
    },
    getAudit: () => IDLE_AUDIT_STATE,
    runLighthouse: async () => {
      runLighthouseCalls++
      return { ok: true, state: IDLE_LIGHTHOUSE_STATE }
    },
    getLighthouseState: () => IDLE_LIGHTHOUSE_STATE,
    ...overrides
  }
  return port
}

function imageOf(result: CallToolResult): { data: string; mimeType: string } | undefined {
  return result.content.find(
    (c): c is { type: 'image'; data: string; mimeType: string } => c.type === 'image'
  )
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

  describe('list_devices', () => {
    it('lists presets with their visibility and active markers', async () => {
      const client = await connect(makePort())
      const result = (await client.callTool({
        name: 'list_devices',
        arguments: {}
      })) as CallToolResult
      const text = textOf(result)
      expect(text).toContain('iphone — iPhone 16 Pro (393x852 @3x, touch) [active, visible]')
      expect(text).toContain('desktop — Desktop (1440x900 @2x, no touch) [hidden]')
    })
  })

  describe('set_active_pane', () => {
    it('delegates to setActivePane for a known device', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'set_active_pane',
        arguments: { device: 'desktop' }
      })) as CallToolResult
      expect(result.isError).toBeFalsy()
      expect(port.setActivePaneCalls).toEqual(['desktop'])
    })

    it('returns a structured error for an unknown device', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'set_active_pane',
        arguments: { device: 'watch' }
      })) as CallToolResult
      expect(result.isError).toBe(true)
      expect(textOf(result)).toMatch(/unknown device/i)
      expect(port.setActivePaneCalls).toEqual([])
    })
  })

  describe('set_devices', () => {
    it('delegates to setVisibleDevices for known devices', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'set_devices',
        arguments: { devices: ['iphone'] }
      })) as CallToolResult
      expect(result.isError).toBeFalsy()
      expect(port.setVisibleDevicesCalls).toEqual([['iphone']])
    })

    it('returns a structured error for an unknown device and does not delegate', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'set_devices',
        arguments: { devices: ['iphone', 'watch'] }
      })) as CallToolResult
      expect(result.isError).toBe(true)
      expect(textOf(result)).toMatch(/unknown device/i)
      expect(port.setVisibleDevicesCalls).toEqual([])
    })

    it('reports an unsupported partial subset as a structured error', async () => {
      const port = makePort({
        setVisibleDevices: () => ({ ok: false, reason: 'unsupported-subset' })
      })
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'set_devices',
        arguments: { devices: ['iphone', 'desktop'] }
      })) as CallToolResult
      expect(result.isError).toBe(true)
      expect(textOf(result)).toMatch(/subset/i)
    })
  })

  describe('screenshot', () => {
    it('captures the active pane by default and returns image content', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'screenshot',
        arguments: {}
      })) as CallToolResult
      expect(port.screenshotCalls).toEqual([null])
      const image = imageOf(result)
      expect(image?.mimeType).toBe('image/png')
      expect(image?.data).toBe(FIXED_PNG.toString('base64'))
    })

    it('captures a named device when specified', async () => {
      const port = makePort()
      const client = await connect(port)
      await client.callTool({ name: 'screenshot', arguments: { device: 'desktop' } })
      expect(port.screenshotCalls).toEqual(['desktop'])
    })

    it('returns a structured error for an unknown device', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'screenshot',
        arguments: { device: 'watch' }
      })) as CallToolResult
      expect(result.isError).toBe(true)
      expect(textOf(result)).toMatch(/unknown device/i)
      expect(port.screenshotCalls).toEqual([])
    })

    it('returns a structured error when no URL is loaded', async () => {
      const port = makePort({
        screenshot: async () => ({ ok: false, reason: 'no-url' })
      })
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'screenshot',
        arguments: {}
      })) as CallToolResult
      expect(result.isError).toBe(true)
      expect(textOf(result)).toMatch(/no url is loaded/i)
    })
  })

  describe('get_observed_context', () => {
    it('formats pane metadata, evidence counts, and no local project by default', async () => {
      const client = await connect(makePort())
      const result = (await client.callTool({
        name: 'get_observed_context',
        arguments: {}
      })) as CallToolResult
      const text = textOf(result)
      expect(text).toContain('Active pane: iPhone 16 Pro (iphone)')
      expect(text).toContain('URL: http://localhost:3000/')
      expect(text).toContain('Title: My App')
      expect(text).toContain('Console problems (0)')
      expect(text).toContain('Network failures (0)')
      expect(text).toMatch(/no pane on localhost/i)
    })

    it('renders dev context, console problems, and network failures when present', async () => {
      const port = makePort({
        getObservedContext: () => ({
          device: { id: 'desktop', name: 'Desktop' },
          url: 'http://localhost:3000/',
          title: 'App',
          lastNavTimestamp: null,
          evidence: {
            paneId: 'desktop',
            console: [
              { id: '1', timestamp: 1, level: 'log', message: 'noise' },
              { id: '2', timestamp: 2, level: 'error', message: 'boom' }
            ],
            network: [
              {
                id: '3',
                timestamp: 3,
                method: 'GET',
                url: 'http://localhost:3000/missing',
                path: '/missing',
                status: 404,
                failed: true
              }
            ],
            problemCount: 2
          },
          devContext: {
            repoPath: '/Users/me/project',
            branch: 'feature/x',
            commit: 'deadbeefcafe',
            dirty: true
          }
        })
      })
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'get_observed_context',
        arguments: {}
      })) as CallToolResult
      const text = textOf(result)
      expect(text).toContain('Repo: /Users/me/project')
      expect(text).toContain('Branch: feature/x | Commit: deadbee | Dirty: yes')
      expect(text).toContain('Console problems (1)')
      expect(text).toContain('[ERROR] boom')
      expect(text).not.toContain('noise')
      expect(text).toContain('Network failures (1)')
      expect(text).toContain('GET /missing → 404')
    })
  })

  describe('reload', () => {
    it('delegates to reload', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'reload',
        arguments: {}
      })) as CallToolResult
      expect(result.isError).toBeFalsy()
      expect(port.reloadCalls).toBe(1)
    })
  })

  describe('run_audit', () => {
    it('defaults the indexing intent to indexable and returns actionable findings', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'run_audit',
        arguments: {}
      })) as CallToolResult
      expect(port.runAuditCalls).toEqual(['indexable'])
      const text = textOf(result)
      expect(text).toContain('Page SEO audit for http://localhost:3000/')
      expect(text).toContain('Actionable findings (1)')
      expect(text).toContain('search-appearance/title-present')
      expect(text).toContain('Fix: Add a <title>.')
    })

    it('passes a provided indexing intent through', async () => {
      const port = makePort()
      const client = await connect(port)
      await client.callTool({ name: 'run_audit', arguments: { indexingIntent: 'local-private' } })
      expect(port.runAuditCalls).toEqual(['local-private'])
    })

    it('returns a structured error for an unknown indexing intent', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'run_audit',
        arguments: { indexingIntent: 'sometimes' }
      })) as CallToolResult
      expect(result.isError).toBe(true)
      expect(textOf(result)).toMatch(/unknown indexing intent/i)
      expect(port.runAuditCalls).toEqual([])
    })

    it('maps a busy run to a structured error', async () => {
      const port = makePort({ runAudit: async () => ({ ok: false, reason: 'busy' }) })
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'run_audit',
        arguments: {}
      })) as CallToolResult
      expect(result.isError).toBe(true)
      expect(textOf(result)).toMatch(/already running/i)
    })

    it('maps a no-url failure to a structured error', async () => {
      const port = makePort({ runAudit: async () => ({ ok: false, reason: 'no-url' }) })
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'run_audit',
        arguments: {}
      })) as CallToolResult
      expect(result.isError).toBe(true)
      expect(textOf(result)).toMatch(/no url is loaded/i)
    })
  })

  describe('get_audit', () => {
    it('reports when no audit has run yet', async () => {
      const client = await connect(makePort())
      const result = (await client.callTool({
        name: 'get_audit',
        arguments: {}
      })) as CallToolResult
      expect(textOf(result)).toMatch(/no audit has been run/i)
    })

    it('returns the latest result and flags staleness', async () => {
      const port = makePort({
        getAudit: () => ({
          phase: 'completed',
          running: null,
          result: AUDIT_RESULT,
          stale: true,
          incomplete: false
        })
      })
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'get_audit',
        arguments: {}
      })) as CallToolResult
      const text = textOf(result)
      expect(text).toContain('(stale)')
      expect(text).toContain('search-appearance/title-present')
    })
  })

  describe('run_lighthouse', () => {
    it('delegates to runLighthouse and formats the returned scores', async () => {
      const completed = {
        phase: 'completed',
        error: null,
        progress: null,
        results: {
          mobile: {
            stale: false,
            categories: [
              { id: 'performance', title: 'Performance', score: 0.91, auditIds: [] },
              { id: 'seo', title: 'SEO', score: 1, auditIds: [] }
            ]
          },
          desktop: null
        }
      } as unknown as LighthouseAssessmentState
      const port = makePort({ runLighthouse: async () => ({ ok: true, state: completed }) })
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'run_lighthouse',
        arguments: {}
      })) as CallToolResult
      const text = textOf(result)
      expect(text).toContain('Lighthouse state: completed')
      expect(text).toContain('Performance: 91')
      expect(text).toContain('SEO: 100')
    })

    it('returns a structured error when no URL is loaded', async () => {
      const port = makePort({ runLighthouse: async () => ({ ok: false, reason: 'no-url' }) })
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'run_lighthouse',
        arguments: {}
      })) as CallToolResult
      expect(result.isError).toBe(true)
      expect(textOf(result)).toMatch(/no url is loaded/i)
    })
  })

  describe('get_lighthouse_state', () => {
    it('returns the current state without re-running', async () => {
      const port = makePort()
      const client = await connect(port)
      const result = (await client.callTool({
        name: 'get_lighthouse_state',
        arguments: {}
      })) as CallToolResult
      expect(port.runLighthouseCalls).toBe(0)
      expect(textOf(result)).toContain('Lighthouse state: idle')
    })
  })
})
