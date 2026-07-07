import type { PreviewApi } from '../../preload/index'

declare global {
  interface Window {
    api: PreviewApi
  }
}

export {}
