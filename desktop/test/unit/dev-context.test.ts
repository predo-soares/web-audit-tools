import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isLocalhostUrl } from '../../src/shared/dev-context'

// Mock child_process and fs/promises before importing the module under test
vi.mock('child_process', () => ({
  execFile: vi.fn()
}))

vi.mock('fs/promises', () => ({
  stat: vi.fn()
}))

import { execFile } from 'child_process'
import { stat } from 'fs/promises'
import { resolveDevContext } from '../../src/main/dev-context'

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>
const mockStat = stat as unknown as ReturnType<typeof vi.fn>

function makeExecFileImpl(outputs: Record<string, string>) {
  return (
    _bin: string,
    args: string[],
    _opts: unknown,
    callback: (err: Error | null, result: { stdout: string } | null) => void
  ) => {
    const key = args.join(' ')
    if (key in outputs) {
      callback(null, { stdout: outputs[key] })
    } else {
      callback(new Error(`unexpected git args: ${key}`), null)
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // By default, stat resolves (meaning .git exists at /fake/repo)
  mockStat.mockResolvedValue({})
})

describe('isLocalhostUrl', () => {
  it('returns true for localhost', () => {
    expect(isLocalhostUrl('http://localhost:3000')).toBe(true)
    expect(isLocalhostUrl('http://localhost')).toBe(true)
  })

  it('returns true for 127.0.0.1', () => {
    expect(isLocalhostUrl('http://127.0.0.1:5173')).toBe(true)
  })

  it('returns true for [::1] (IPv6 loopback)', () => {
    expect(isLocalhostUrl('http://[::1]:4000')).toBe(true)
  })

  it('returns true for hostnames ending in .local (mDNS/Bonjour)', () => {
    expect(isLocalhostUrl('http://mydevbox.local:3000')).toBe(true)
    expect(isLocalhostUrl('http://macbook-pro.local')).toBe(true)
  })

  it('returns false for public domain URLs', () => {
    expect(isLocalhostUrl('https://example.com')).toBe(false)
    expect(isLocalhostUrl('https://staging.myapp.com')).toBe(false)
  })

  it('returns false for invalid URLs', () => {
    expect(isLocalhostUrl('not-a-url')).toBe(false)
  })
})

describe('resolveDevContext', () => {
  it('returns null when no git root is found', async () => {
    // stat always throws → no .git found anywhere
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const result = await resolveDevContext('/no/git/here')
    expect(result).toBeNull()
  })

  it('returns dirty=false when working tree is clean', async () => {
    mockExecFile.mockImplementation(
      makeExecFileImpl({
        'rev-parse --abbrev-ref HEAD': 'main\n',
        'rev-parse HEAD': 'abc1234\n',
        'status --porcelain': ''
      })
    )

    const result = await resolveDevContext('/fake/repo')
    expect(result).not.toBeNull()
    expect(result!.dirty).toBe(false)
    expect(result!.branch).toBe('main')
    expect(result!.commit).toBe('abc1234')
  })

  it('returns dirty=true when working tree has uncommitted changes', async () => {
    mockExecFile.mockImplementation(
      makeExecFileImpl({
        'rev-parse --abbrev-ref HEAD': 'feature/my-branch\n',
        'rev-parse HEAD': 'deadbeef\n',
        'status --porcelain': ' M src/main/dev-context.ts\n?? new-file.ts\n'
      })
    )

    const result = await resolveDevContext('/fake/repo')
    expect(result).not.toBeNull()
    expect(result!.dirty).toBe(true)
    expect(result!.branch).toBe('feature/my-branch')
    expect(result!.commit).toBe('deadbeef')
  })

  it('returns branch=null in detached HEAD state', async () => {
    mockExecFile.mockImplementation(
      makeExecFileImpl({
        'rev-parse --abbrev-ref HEAD': 'HEAD\n',
        'rev-parse HEAD': 'cafebabe\n',
        'status --porcelain': ''
      })
    )

    const result = await resolveDevContext('/fake/repo')
    expect(result).not.toBeNull()
    expect(result!.branch).toBeNull()
    expect(result!.dirty).toBe(false)
  })

  it('returns dirty=false when git status --porcelain returns only whitespace', async () => {
    mockExecFile.mockImplementation(
      makeExecFileImpl({
        'rev-parse --abbrev-ref HEAD': 'main\n',
        'rev-parse HEAD': 'abc1234\n',
        'status --porcelain': '   \n'
      })
    )

    // trim() of '   \n' is '' → gitOutput returns null → dirty=false
    const result = await resolveDevContext('/fake/repo')
    expect(result).not.toBeNull()
    expect(result!.dirty).toBe(false)
  })

  it('includes repoPath in result', async () => {
    mockExecFile.mockImplementation(
      makeExecFileImpl({
        'rev-parse --abbrev-ref HEAD': 'main\n',
        'rev-parse HEAD': 'abc1234\n',
        'status --porcelain': ''
      })
    )

    const result = await resolveDevContext('/fake/repo')
    expect(result!.repoPath).toBe('/fake/repo')
  })
})
