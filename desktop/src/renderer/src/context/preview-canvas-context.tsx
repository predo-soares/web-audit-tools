import { createContext, useContext } from 'react'

export interface CanvasPoint {
  x: number
  y: number
}

export interface PreviewCanvasContextValue {
  zoom: number
  webviewScale: number
  pan: CanvasPoint
  setZoomCentered: (zoom: number) => void
  adjustZoom: (delta: number) => void
  setWebviewScale: (scale: number) => void
}

export const PreviewCanvasContext = createContext<PreviewCanvasContextValue | null>(null)

export function usePreviewCanvas(): PreviewCanvasContextValue {
  const context = useContext(PreviewCanvasContext)
  if (!context) {
    throw new Error('usePreviewCanvas must be used within PreviewCanvas')
  }
  return context
}
