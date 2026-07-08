import { createContext, useContext } from 'react'

export interface PreviewCanvasContextValue {
  zoom: number
  setZoom: (zoom: number) => void
  adjustZoom: (delta: number) => void
}

export const PreviewCanvasContext = createContext<PreviewCanvasContextValue | null>(null)

export function usePreviewCanvas(): PreviewCanvasContextValue {
  const context = useContext(PreviewCanvasContext)
  if (!context) {
    throw new Error('usePreviewCanvas must be used within PreviewCanvas')
  }
  return context
}
