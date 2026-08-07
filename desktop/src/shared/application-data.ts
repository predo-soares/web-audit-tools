import type { PaneId } from './types'

export interface ApplicationStorageItem {
  key: string
  value: string
}

export interface ApplicationServiceWorker {
  scope: string
  scriptUrl: string
  state: string
}

export interface ApplicationBackgroundService {
  name: string
  available: boolean
  detail: string
}

export interface ApplicationData {
  paneId: PaneId
  url: string
  origin: string
  localStorage: ApplicationStorageItem[]
  sessionStorage: ApplicationStorageItem[]
  cookies: ApplicationStorageItem[]
  indexedDb: string[]
  cacheStorage: string[]
  serviceWorkers: ApplicationServiceWorker[]
  backgroundServices: ApplicationBackgroundService[]
}

export const EMPTY_APPLICATION_DATA: ApplicationData = {
  paneId: 'desktop',
  url: '',
  origin: '',
  localStorage: [],
  sessionStorage: [],
  cookies: [],
  indexedDb: [],
  cacheStorage: [],
  serviceWorkers: [],
  backgroundServices: []
}

/** Runs in the active page and returns serializable Application-tab evidence. */
export const APPLICATION_DATA_EXPRESSION = `(() => {
  const readStorage = (storage) => {
    try {
      return Object.keys(storage).sort().map((key) => ({ key, value: String(storage.getItem(key) ?? '') }))
    } catch {
      return []
    }
  }

  const readCookies = () => {
    try {
      return document.cookie
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const separator = part.indexOf('=')
          return {
            key: separator === -1 ? part : part.slice(0, separator),
            value: separator === -1 ? '' : part.slice(separator + 1)
          }
        })
    } catch {
      return []
    }
  }

  const indexedDb = typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function'
    ? indexedDB.databases().then((databases) => databases.map((database) => database.name).filter(Boolean)).catch(() => [])
    : Promise.resolve([])

  const cacheStorage = typeof caches !== 'undefined'
    ? caches.keys().catch(() => [])
    : Promise.resolve([])

  const serviceWorkers = 'serviceWorker' in navigator
    ? navigator.serviceWorker.getRegistrations().then((registrations) => registrations.map((registration) => ({
        scope: registration.scope,
        scriptUrl: registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? registration.installing?.scriptURL ?? '',
        state: registration.active?.state ?? registration.waiting?.state ?? registration.installing?.state ?? 'registered'
      }))).catch(() => [])
    : Promise.resolve([])

  return Promise.all([indexedDb, cacheStorage, serviceWorkers]).then(([indexedDbNames, cacheNames, workers]) => ({
    url: location.href,
    origin: location.origin,
    localStorage: readStorage(window.localStorage),
    sessionStorage: readStorage(window.sessionStorage),
    cookies: readCookies(),
    indexedDb: indexedDbNames,
    cacheStorage: cacheNames,
    serviceWorkers: workers,
    backgroundServices: [
      {
        name: 'Service workers',
        available: 'serviceWorker' in navigator,
        detail: workers.length === 1 ? '1 registered' : workers.length + ' registered'
      },
      {
        name: 'Background sync',
        available: 'SyncManager' in window,
        detail: 'SyncManager API'
      },
      {
        name: 'Push messaging',
        available: 'PushManager' in window,
        detail: 'PushManager API'
      },
      {
        name: 'Periodic background sync',
        available: 'PeriodicSyncManager' in window,
        detail: 'PeriodicSyncManager API'
      }
    ]
  }))
})()`
