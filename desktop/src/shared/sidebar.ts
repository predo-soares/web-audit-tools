export const SIDEBAR_WIDTH_PX = 280
export const SIDEBAR_TRANSITION_MS = 200
export const SIDEBAR_STORAGE_KEY = 'audit-screens-sidebar-open'
export const TOOLBAR_HEIGHT_PX = 52

/**
 * Which full-window workspace is active. `browser` is the device canvas; the rest
 * are full-screen views that replace it. The toolbar uses this to hide the URL
 * bar and page-scoped controls, which are only meaningful in the browser view.
 */
export type WorkspaceView = 'browser' | 'seo' | 'lighthouse' | 'devices' | 'settings'
