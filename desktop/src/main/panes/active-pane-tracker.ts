import { PANE_IDS } from '../../shared/device-presets'
import type { PaneId } from '../../shared/pane-types'

export interface ActivePaneSnapshot {
  activePane: PaneId | null
  barUrl: string
  pageTitle: string
  faviconUrl: string | null
}

export interface ActivePaneTracker {
  didNavigate(paneId: PaneId, url: string, opts: { inPage: boolean; isProgrammatic: boolean }): void
  didFocus(paneId: PaneId): void
  didTitleUpdate(paneId: PaneId, title: string): boolean
  didFaviconUpdate(paneId: PaneId, favicon: string | null): boolean
  didNavigateAll(url: string): void
  getSnapshot(): ActivePaneSnapshot
  getPaneUrl(paneId: PaneId): string | undefined
}

export function createActivePaneTracker(): ActivePaneTracker {
  const paneUrls = new Map<PaneId, string>()
  const paneTitles = new Map<PaneId, string>()
  const paneFavicons = new Map<PaneId, string>()
  let activePane: PaneId | null = null
  let barUrl = ''
  let pageTitle = ''
  let faviconUrl: string | null = null

  // A pane is "active" for metadata purposes if it is the explicitly focused
  // pane, or if no pane has been explicitly focused and its URL matches barUrl
  // (e.g. immediately after navigateAll).
  function isActivePane(paneId: PaneId): boolean {
    return activePane === paneId || (activePane === null && barUrl === paneUrls.get(paneId))
  }

  return {
    didNavigate(paneId, url, { isProgrammatic }) {
      if (url === 'about:blank') return
      paneUrls.set(paneId, url)
      if (isProgrammatic) return
      activePane = paneId
      barUrl = url
      pageTitle = paneTitles.get(paneId) ?? ''
      faviconUrl = paneFavicons.get(paneId) ?? null
    },

    didFocus(paneId) {
      activePane = paneId
      const url = paneUrls.get(paneId)
      if (url && url !== 'about:blank') {
        barUrl = url
        pageTitle = paneTitles.get(paneId) ?? ''
        faviconUrl = paneFavicons.get(paneId) ?? null
      }
    },

    didTitleUpdate(paneId, title) {
      paneTitles.set(paneId, title)
      if (!isActivePane(paneId)) return false
      pageTitle = title
      return true
    },

    didFaviconUpdate(paneId, favicon) {
      paneFavicons.set(paneId, favicon ?? '')
      if (!isActivePane(paneId)) return false
      faviconUrl = favicon
      return true
    },

    didNavigateAll(url) {
      for (const paneId of PANE_IDS) {
        paneUrls.set(paneId, url)
        paneTitles.set(paneId, '')
      }
      activePane = null
      barUrl = url
      pageTitle = ''
      faviconUrl = null
    },

    getSnapshot() {
      return { activePane, barUrl, pageTitle, faviconUrl }
    },

    getPaneUrl(paneId) {
      return paneUrls.get(paneId)
    }
  }
}
