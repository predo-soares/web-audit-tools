const BYTES_PER_PIXEL = 4

/**
 * Alpha-composites `overlay` onto `base` at `(destX, destY)` in bitmap pixel
 * space. Buffers are BGRA (Electron `toBitmap` layout). Mutates `base`.
 */
export function overlayBitmap(
  base: Buffer,
  baseWidth: number,
  baseHeight: number,
  overlay: Buffer,
  overlayWidth: number,
  overlayHeight: number,
  destX: number,
  destY: number
): void {
  for (let row = 0; row < overlayHeight; row++) {
    const targetY = destY + row
    if (targetY < 0 || targetY >= baseHeight) continue

    for (let col = 0; col < overlayWidth; col++) {
      const targetX = destX + col
      if (targetX < 0 || targetX >= baseWidth) continue

      const src = (row * overlayWidth + col) * BYTES_PER_PIXEL
      const dst = (targetY * baseWidth + targetX) * BYTES_PER_PIXEL
      const alpha = overlay[src + 3] ?? 0
      if (alpha === 0) continue

      if (alpha === 255) {
        base[dst] = overlay[src]!
        base[dst + 1] = overlay[src + 1]!
        base[dst + 2] = overlay[src + 2]!
        base[dst + 3] = 255
        continue
      }

      const inv = 255 - alpha
      base[dst] = Math.round((overlay[src]! * alpha + base[dst]! * inv) / 255)
      base[dst + 1] = Math.round((overlay[src + 1]! * alpha + base[dst + 1]! * inv) / 255)
      base[dst + 2] = Math.round((overlay[src + 2]! * alpha + base[dst + 2]! * inv) / 255)
      base[dst + 3] = 255
    }
  }
}
