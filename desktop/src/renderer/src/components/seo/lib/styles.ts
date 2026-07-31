// Shared visual language with the Lighthouse view: translucent glass cards over
// the canvas, soft white borders, uppercase section labels, and easing tokens.
export const EASE_OUT = 'ease-[var(--ease-out-strong)]'

export const PRESSABLE =
  'transition-transform duration-[160ms] ease-[var(--ease-out-strong)] active:scale-[0.98] motion-reduce:active:scale-100'

// bg-black/40 matches the Settings and Lighthouse section cards so every
// full-screen workspace shares one card shade over the dotted canvas surface.
export const CARD = 'rounded-xl border border-white/10 bg-black/40 backdrop-blur-md'

export const SECTION_TITLE = 'text-xs font-semibold uppercase tracking-wider text-white/55'

export const SUBLABEL = 'text-[11px] font-medium uppercase tracking-wider text-white/55'
