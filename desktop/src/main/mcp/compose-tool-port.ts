import { writeFile } from 'node:fs/promises'
import { DEVICE_PRESETS, PANE_IDS } from '../../shared/device-presets'
import { isLocalhostUrl } from '../../shared/dev-context'
import { captureSnapshot } from '../services/snapshot-service'
import { makeSnapshotPort } from '../ipc'
import type { AuditManager } from '../seo/audit-manager'
import type { PaneManager } from '../panes/pane-manager'
import type { DeviceInfo, McpToolPort, ObservedContext } from './mcp-tool-port'

export interface ComposeMcpToolPortDeps {
  paneManager: PaneManager
  auditManager: AuditManager
}

/**
 * Compose the concrete {@link McpToolPort} from the app's existing managers and
 * services. This is the single place live agent access and human interaction are
 * bridged, so both surfaces act on the same manager instances and never diverge.
 */
export function composeMcpToolPort(deps: ComposeMcpToolPortDeps): McpToolPort {
  const { paneManager, auditManager } = deps

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
    },

    screenshot: async (device) => {
      if (device === null) {
        const url = paneManager.getNavigationState().barUrl
        if (!url || url === 'about:blank') return { ok: false, reason: 'no-url' }
        return { ok: true, png: await paneManager.captureActivePaneScreenshot() }
      }
      const url = paneManager.getTrackedPaneUrl(device)
      if (!url || url === 'about:blank') return { ok: false, reason: 'no-url' }
      return { ok: true, png: await paneManager.capturePaneImage(device) }
    },

    getObservedContext: (): ObservedContext => {
      const nav = paneManager.getNavigationState()
      const activePane = nav.activePane ?? 'desktop'
      // Dev context is only meaningful for a local project, so include it when
      // any pane is on localhost — matching the capture bundle's boundary.
      const anyLocalhost = PANE_IDS.some((id) => isLocalhostUrl(paneManager.getTrackedPaneUrl(id)))
      return {
        device: { id: activePane, name: DEVICE_PRESETS[activePane].name },
        url: nav.barUrl || null,
        title: nav.pageTitle,
        lastNavTimestamp: paneManager.getLastNavTimestamp(activePane),
        evidence: paneManager.getRuntimeEvidenceSnapshot(),
        devContext: anyLocalhost ? paneManager.getDevContext() : null
      }
    },

    reload: () => paneManager.reloadAll(),

    runAudit: (indexingIntent) => auditManager.run({ indexingIntent }),

    getAudit: () => auditManager.getState()
  }
}
