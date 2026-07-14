import { nativeImage } from 'electron'
import { overlayBitmap } from './bitmap-overlay'

/**
 * Alpha-composites `overlayPng` onto `basePng` at `(destX, destY)` in bitmap
 * pixel space (already scaled; not CSS px). Returns a PNG buffer.
 */
export function overlayPng(
  basePng: Buffer,
  overlayPngBuffer: Buffer,
  destX: number,
  destY: number
): Buffer {
  const base = nativeImage.createFromBuffer(basePng)
  const overlay = nativeImage.createFromBuffer(overlayPngBuffer)
  if (base.isEmpty() || overlay.isEmpty()) {
    return basePng
  }

  const { width, height } = base.getSize()
  const baseBitmap = Buffer.from(base.toBitmap())
  const overlayPixels = overlay.toBitmap()
  const { width: overlayWidth, height: overlayHeight } = overlay.getSize()

  overlayBitmap(
    baseBitmap,
    width,
    height,
    overlayPixels,
    overlayWidth,
    overlayHeight,
    destX,
    destY
  )

  return nativeImage.createFromBitmap(baseBitmap, { width, height }).toPNG()
}
