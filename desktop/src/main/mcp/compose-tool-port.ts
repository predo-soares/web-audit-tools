import { writeFile } from 'node:fs/promises'
import { captureSnapshot } from '../services/snapshot-service'
import { makeSnapshotPort } from '../ipc'
import type { PaneManager } from '../panes/pane-manager'
import type { McpToolPort } from './mcp-tool-port'

export interface ComposeMcpToolPortDeps {
  paneManager: PaneManager
}

/**
 * Compose the concrete {@link McpToolPort} from the app's existing managers and
 * services. This is the single place live agent access and human interaction are
 * bridged, so both surfaces act on the same manager instances and never diverge.
 */
export function composeMcpToolPort(deps: ComposeMcpToolPortDeps): McpToolPort {
  const { paneManager } = deps

  return {
    navigateAll: (url) => paneManager.navigateAll(url),

    captureBundle: async () => {
      // The pipeline computes the bundle directory internally and never returns
      // it, so intercept the context.md write to recover the exact path. The
      // human clipboard is left untouched — this is an agent action, not a
      // Share-with-agent click.
      let contextPath: string | null = null
      const result = await captureSnapshot(makeSnapshotPort(paneManager), {
        writeClipboard: () => {},
        writeMd: async (path, data) => {
          contextPath = path
          await writeFile(path, data, 'utf-8')
        }
      })
      if (!result.ok) return { ok: false, reason: result.reason }
      return { ok: true, pointer: contextPath ?? '', warningCount: result.warningCount }
    }
  }
}
