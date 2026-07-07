import { createContext, useContext } from 'react'

export type Alignment = 'left' | 'center' | 'right'

export interface PreviewCanvasContextValue {
  zoom: number
  alignment: Alignment
  setZoom: (zoom: number) => void
  adjustZoom: (delta: number) => void
  setAlignment: (alignment: Alignment) => void
}

export const PreviewCanvasContext = createContext<PreviewCanvasContextValue | null>(null)

export function usePreviewCanvas(): PreviewCanvasContextValue {
  const context = useContext(PreviewCanvasContext)
  if (!context) {
    throw new Error('usePreviewCanvas must be used within PreviewCanvas')
  }
  return context
}
