import { execFile } from 'child_process'
import { stat } from 'fs/promises'
import { dirname, join } from 'path'
import { promisify } from 'util'
import type { DevContext } from '../shared/dev-context'

const execFileAsync = promisify(execFile)

async function findGitRoot(startDir: string): Promise<string | null> {
  let dir = startDir
  while (true) {
    try {
      await stat(join(dir, '.git'))
      return dir
    } catch {
      const parent = dirname(dir)
      if (parent === dir) return null
      dir = parent
    }
  }
}

async function gitOutput(cwd: string, ...args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd, timeout: 3000 })
    return stdout.trim() || null
  } catch {
    return null
  }
}

export async function resolveDevContext(cwd: string): Promise<DevContext | null> {
  const repoPath = await findGitRoot(cwd)
  if (!repoPath) return null

  const [rawBranch, commit, statusOutput] = await Promise.all([
    gitOutput(repoPath, 'rev-parse', '--abbrev-ref', 'HEAD'),
    gitOutput(repoPath, 'rev-parse', 'HEAD'),
    gitOutput(repoPath, 'status', '--porcelain')
  ])

  // 'HEAD' means detached HEAD — no symbolic branch name
  const branch = rawBranch === 'HEAD' ? null : rawBranch
  const dirty = statusOutput !== null && statusOutput.length > 0

  return { repoPath, branch, commit, dirty }
}
