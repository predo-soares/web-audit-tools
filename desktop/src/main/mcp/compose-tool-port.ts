import { writeFile } from 'node:fs/promises'
import { DEVICE_PRESETS, PANE_IDS } from '../../shared/device-presets'
import { captureSnapshot } from '../services/snapshot-service'
import { makeSnapshotPort } from '../ipc'
import type { PaneManager } from '../panes/pane-manager'
import type { DeviceInfo, McpToolPort } from './mcp-tool-port'

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
    },

    listDevices: (): DeviceInfo[] => {
      const focused = paneManager.getFocusedPane()
      const active = paneManager.getNavigationState().activePane
      return PANE_IDS.map((id) => {
        const preset = DEVICE_PRESETS[id]
        return {
          id,
          name: preset.name,
          width: preset.width,
          height: preset.height,
          deviceScaleFactor: preset.deviceScaleFactor,
          touch: preset.touch,
          visible: focused === null || focused === id,
          active: active === id
        }
      })
    },

    setActivePane: (device) => {
      paneManager.focusPane(device)
    },

    setVisibleDevices: (devices) => {
      const requested = new Set(devices)
      // The main-process visibility primitive is solo-or-all: showing every pane
      // clears the solo focus, and a single pane solos it. An arbitrary subset
      // (more than one, fewer than all) has no primitive.
      if (requested.size >= PANE_IDS.length) {
        paneManager.setFocusedPane(null)
        return { ok: true }
      }
      if (requested.size === 1) {
        paneManager.setFocusedPane([...requested][0])
        return { ok: true }
      }
      return { ok: false, reason: 'unsupported-subset' }
    }
  }
}
