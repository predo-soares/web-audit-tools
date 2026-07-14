import type { SafariChromeApi } from '../../preload/safari-chrome-preload'

declare global {
  interface Window {
    safariChromeApi: SafariChromeApi
  }
}

export {}
