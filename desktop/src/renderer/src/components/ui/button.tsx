import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@renderer/lib/utils'

// Button follows the DevouringDetails model (https://devouringdetails.com/system/button):
// appearance (`variant`) is decoupled from `color`, so any of the four looks can be
// rendered in any of the five colors. Each `color` only sets CSS custom properties;
// each `variant` reads them. That keeps the matrix additive instead of 4×5 hardcoded.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap border border-transparent bg-clip-padding font-medium outline-none transition-[transform,background-color,color,box-shadow,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 data-[loading=true]:pointer-events-none data-[loading=true]:cursor-progress data-[loading=true]:opacity-100 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        solid:
          'bg-[var(--btn-solid)] text-[color:var(--btn-solid-fg)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)] active:brightness-90',
        soft: 'bg-[var(--btn-soft)] text-[color:var(--btn-fg)] hover:bg-[var(--btn-soft-hover)]',
        outline:
          'border-[color:var(--btn-border)] bg-[var(--btn-outline)] text-[color:var(--btn-fg)] hover:bg-[var(--btn-soft)]',
        ghost:
          'text-[color:var(--btn-fg)] hover:bg-[var(--btn-ghost-hover)] aria-expanded:bg-[var(--btn-ghost-hover)]'
      },
      color: {
        // Neutral maps to the theme tokens so it flips correctly in dark mode.
        neutral:
          '[--btn-solid:var(--primary)] [--btn-solid-fg:var(--primary-foreground)] [--btn-soft:var(--secondary)] [--btn-soft-hover:color-mix(in_oklch,var(--secondary),var(--foreground)_7%)] [--btn-outline:var(--background)] [--btn-border:var(--border)] [--btn-fg:var(--foreground)] [--btn-ghost-hover:color-mix(in_oklch,transparent,var(--foreground)_8%)]',
        accent:
          '[--btn-solid:oklch(0.71_0.24_42.36)] [--btn-solid-fg:#fff] [--btn-soft:oklch(0.95_0.045_42.36)] [--btn-soft-hover:oklch(0.92_0.065_42.36)] [--btn-outline:oklch(0.985_0.016_42.36)] [--btn-border:oklch(0.87_0.09_42.36)] [--btn-fg:oklch(0.6_0.2_42.36)] [--btn-ghost-hover:oklch(0.95_0.045_42.36)] dark:[--btn-soft:oklch(0.32_0.09_42.36)] dark:[--btn-soft-hover:oklch(0.37_0.11_42.36)] dark:[--btn-outline:oklch(0.28_0.06_42.36)] dark:[--btn-border:oklch(0.45_0.12_42.36)] dark:[--btn-fg:oklch(0.82_0.15_42.36)] dark:[--btn-ghost-hover:oklch(0.32_0.09_42.36)]',
        blue: '[--btn-solid:oklch(0.562_0.2419_260.9)] [--btn-solid-fg:#fff] [--btn-soft:oklch(0.95_0.04_260.9)] [--btn-soft-hover:oklch(0.92_0.06_260.9)] [--btn-outline:oklch(0.985_0.016_260.9)] [--btn-border:oklch(0.86_0.08_260.9)] [--btn-fg:oklch(0.55_0.22_260.9)] [--btn-ghost-hover:oklch(0.95_0.04_260.9)] dark:[--btn-soft:oklch(0.32_0.09_260.9)] dark:[--btn-soft-hover:oklch(0.37_0.11_260.9)] dark:[--btn-outline:oklch(0.28_0.06_260.9)] dark:[--btn-border:oklch(0.46_0.13_260.9)] dark:[--btn-fg:oklch(0.8_0.14_260.9)] dark:[--btn-ghost-hover:oklch(0.32_0.09_260.9)]',
        red: '[--btn-solid:oklch(0.63_0.2555_29.02)] [--btn-solid-fg:#fff] [--btn-soft:oklch(0.95_0.04_29.02)] [--btn-soft-hover:oklch(0.92_0.06_29.02)] [--btn-outline:oklch(0.985_0.016_29.02)] [--btn-border:oklch(0.86_0.09_29.02)] [--btn-fg:oklch(0.58_0.22_29.02)] [--btn-ghost-hover:oklch(0.95_0.04_29.02)] dark:[--btn-soft:oklch(0.32_0.1_29.02)] dark:[--btn-soft-hover:oklch(0.37_0.12_29.02)] dark:[--btn-outline:oklch(0.28_0.07_29.02)] dark:[--btn-border:oklch(0.46_0.15_29.02)] dark:[--btn-fg:oklch(0.8_0.14_29.02)] dark:[--btn-ghost-hover:oklch(0.32_0.1_29.02)]',
        amber:
          '[--btn-solid:oklch(0.82_0.18_72.6)] [--btn-solid-fg:oklch(0.32_0.07_72.6)] [--btn-soft:oklch(0.95_0.05_82)] [--btn-soft-hover:oklch(0.92_0.07_82)] [--btn-outline:oklch(0.985_0.02_82)] [--btn-border:oklch(0.87_0.1_82)] [--btn-fg:oklch(0.52_0.11_60)] [--btn-ghost-hover:oklch(0.95_0.05_82)] dark:[--btn-soft:oklch(0.33_0.07_72.6)] dark:[--btn-soft-hover:oklch(0.38_0.09_72.6)] dark:[--btn-outline:oklch(0.29_0.05_72.6)] dark:[--btn-border:oklch(0.47_0.1_72.6)] dark:[--btn-fg:oklch(0.83_0.14_82)] dark:[--btn-ghost-hover:oklch(0.33_0.07_72.6)]'
      },
      size: {
        micro: "h-[26px] gap-1 px-2 text-[13px] [&_svg:not([class*='size-'])]:size-3",
        tiny: "h-7 gap-1 px-2 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        small: 'h-8 gap-1.5 px-2.5 text-[13.5px]',
        medium: 'h-9 gap-1.5 px-3 text-sm',
        large: "h-10 gap-2 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-[18px]",
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3.5",
        'icon-sm': 'size-7',
        icon: 'size-8',
        'icon-lg': 'size-9'
      },
      shape: {
        square: '',
        round: 'rounded-full'
      }
    },
    compoundVariants: [
      // Radius scales with size for square buttons; `round` overrides to a pill.
      { shape: 'square', size: 'micro', className: 'rounded-[8px]' },
      { shape: 'square', size: 'tiny', className: 'rounded-[8px]' },
      { shape: 'square', size: 'small', className: 'rounded-[10px]' },
      { shape: 'square', size: 'medium', className: 'rounded-[10px]' },
      { shape: 'square', size: 'large', className: 'rounded-[12px]' },
      { shape: 'square', size: 'icon-xs', className: 'rounded-[8px]' },
      { shape: 'square', size: 'icon-sm', className: 'rounded-[8px]' },
      { shape: 'square', size: 'icon', className: 'rounded-[10px]' },
      { shape: 'square', size: 'icon-lg', className: 'rounded-[10px]' }
    ],
    defaultVariants: {
      variant: 'solid',
      color: 'neutral',
      size: 'small',
      shape: 'square'
    }
  }
)

function ButtonSpinner(): React.JSX.Element {
  return (
    <svg className="size-[1em] shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.25"
      />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function Button({
  className,
  variant = 'solid',
  color = 'neutral',
  size = 'small',
  shape = 'square',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & { loading?: boolean }): React.JSX.Element {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading || undefined}
      // Loading is functionally disabled but keeps its color (DevouringDetails
      // treats "loading" and "disabled" as discrete states).
      disabled={disabled || loading || undefined}
      className={cn(buttonVariants({ variant, color, size, shape, className }))}
      {...props}
    >
      {loading ? <ButtonSpinner /> : null}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
