// Shared Tailwind class strings for the Lighthouse view. Kept as constants so the
// easing/press/chevron behaviour stays identical across the report subcomponents.
export const EASE_OUT = 'ease-[var(--ease-out-strong)]'

export const PRESSABLE =
  'transition-transform duration-[160ms] ease-[var(--ease-out-strong)] active:scale-[0.97] motion-reduce:active:scale-100'

export const PRESSABLE_ROW =
  'transition-transform duration-[160ms] ease-[var(--ease-out-strong)] active:scale-[0.995] motion-reduce:active:scale-100'

export const CHEVRON =
  'transition-transform duration-200 ease-[var(--ease-out-strong)] group-aria-expanded/accordion-trigger:rotate-180 motion-reduce:transition-none'
