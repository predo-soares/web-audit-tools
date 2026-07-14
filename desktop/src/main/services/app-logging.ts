import log from 'electron-log/main'
import { is } from '@electron-toolkit/utils'

let initialized = false

export function initializeAppLogging(): void {
  if (initialized) return
  initialized = true

  log.initialize()
  log.transports.file.level = 'debug'
  log.transports.console.level = is.dev ? 'debug' : 'info'

  Object.assign(console, log.functions)

  log.errorHandler.startCatching({
    onError: ({ error, errorName, processType }) => {
      log.error(`[${processType}] ${errorName}:`, error)
    }
  })

  log.info('App logging initialized', {
    logFile: log.transports.file.getFile().path
  })
}
