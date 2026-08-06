import { spawn } from 'child_process'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import electronPath from 'electron'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cwd = join(__dirname, '../..')
const port = 9700 + Math.floor(Math.random() * 50)

function setDefault(value) {
  execFileSync('defaults', ['write', 'com.github.Electron', 'ApplePersistenceIgnoreState', value])
}

function readDefault() {
  try {
    return execFileSync(
      'defaults',
      ['read', 'com.github.Electron', 'ApplePersistenceIgnoreState'],
      {
        encoding: 'utf8'
      }
    ).trim()
  } catch {
    return null
  }
}

async function waitForRendererTarget(timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      if (response.ok) {
        const targets = await response.json()
        if (targets.some((t) => t.type === 'page' && t.url.includes('index.html'))) return true
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

function launch(extraArgs) {
  const userDataDir = mkdtempSync(join(tmpdir(), 'audit-screens-cli-proof-'))
  const env = {
    ...process.env,
    E2E_TEST: '1',
    NODE_ENV: 'production',
    E2E_USER_DATA_DIR: userDataDir
  }
  delete env.ELECTRON_RUN_AS_NODE

  const args = ['.', `--remote-debugging-port=${port}`, ...extraArgs]
  const child = spawn(electronPath, args, { cwd, env, stdio: 'ignore' })

  return {
    child,
    userDataDir,
    async close() {
      if (child.exitCode === null) {
        child.kill('SIGKILL')
        await new Promise((r) => child.once('exit', r))
      }
      rmSync(userDataDir, { recursive: true, force: true })
    }
  }
}

if (process.platform !== 'darwin') {
  console.log('skip: macOS-only proof')
  process.exit(0)
}

const previous = readDefault()
setDefault('NO')

try {
  const withoutCli = launch([])
  const withoutOk = await waitForRendererTarget(8_000)
  await withoutCli.close()

  const withCli = launch(['-ApplePersistenceIgnoreState', 'YES'])
  const withOk = await waitForRendererTarget(8_000)
  await withCli.close()

  console.log(`defaults=NO, no CLI flag: renderer target in 8s = ${withoutOk}`)
  console.log(`defaults=NO, with CLI flag: renderer target in 8s = ${withOk}`)

  if (!withOk) {
    console.error('FAIL: CLI flag did not produce a renderer target')
    process.exit(1)
  }
  console.log('PASS: -ApplePersistenceIgnoreState YES works via CLI (even when defaults=NO)')
} finally {
  if (previous === null) {
    execFileSync('defaults', ['delete', 'com.github.Electron', 'ApplePersistenceIgnoreState'])
  } else {
    setDefault(previous)
  }
}
