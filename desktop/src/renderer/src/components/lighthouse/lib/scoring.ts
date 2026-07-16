export type ScoreTone = 'pass' | 'average' | 'fail' | 'none'

export function scoreTone(score: number | null): ScoreTone {
  if (score == null) return 'none'
  if (score >= 0.9) return 'pass'
  if (score >= 0.5) return 'average'
  return 'fail'
}

export const TONE_STROKE: Record<ScoreTone, string> = {
  pass: '#0cce6b',
  average: '#ffa400',
  fail: '#ff4e42',
  none: 'rgba(255,255,255,0.2)'
}

export const TONE_TEXT: Record<ScoreTone, string> = {
  pass: 'text-[#0cce6b]',
  average: 'text-[#ffa400]',
  fail: 'text-[#ff4e42]',
  none: 'text-white/40'
}

export const TONE_SHAPE: Record<ScoreTone, string> = {
  pass: 'rounded-full',
  average: 'rounded-[2px]',
  fail: 'rounded-none rotate-45',
  none: 'rounded-full'
}

export function formatScore(score: number | null): string {
  return score == null ? '—' : String(Math.round(score * 100))
}
