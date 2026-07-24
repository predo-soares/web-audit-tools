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
        // Each color only sets `--btn-*` slots from the Radix scales in main.css
        // (see devouringdetails.com/system/button). The scales redefine themselves
        // under `.dark`, so no per-color dark: overrides are needed.
        neutral:
          '[--btn-solid:var(--primary)] [--btn-solid-fg:var(--primary-foreground)] [--btn-soft:var(--color-gray-a3)] [--btn-soft-hover:var(--color-gray-a4)] [--btn-outline:var(--background)] [--btn-border:var(--border)] [--btn-fg:var(--foreground)] [--btn-ghost-hover:var(--color-gray-a3)]',
        accent:
          '[--btn-solid:oklch(0.71_0.24_42.36)] [--btn-solid-fg:#fff] [--btn-soft:oklch(0.95_0.045_42.36)] [--btn-soft-hover:oklch(0.92_0.065_42.36)] [--btn-outline:oklch(0.985_0.016_42.36)] [--btn-border:oklch(0.87_0.09_42.36)] [--btn-fg:oklch(0.6_0.2_42.36)] [--btn-ghost-hover:oklch(0.95_0.045_42.36)] dark:[--btn-soft:oklch(0.32_0.09_42.36)] dark:[--btn-soft-hover:oklch(0.37_0.11_42.36)] dark:[--btn-outline:oklch(0.28_0.06_42.36)] dark:[--btn-border:oklch(0.45_0.12_42.36)] dark:[--btn-fg:oklch(0.82_0.15_42.36)] dark:[--btn-ghost-hover:oklch(0.32_0.09_42.36)]',
        blue: '[--btn-solid:var(--color-blue9)] [--btn-solid-fg:#fff] [--btn-soft:var(--color-blue3)] [--btn-soft-hover:var(--color-blue4)] [--btn-outline:var(--color-blue2)] [--btn-border:var(--color-blue7)] [--btn-fg:var(--color-blue11)] [--btn-ghost-hover:var(--color-blue3)]',
        red: '[--btn-solid:var(--color-red9)] [--btn-solid-fg:#fff] [--btn-soft:var(--color-red3)] [--btn-soft-hover:var(--color-red4)] [--btn-outline:var(--color-red2)] [--btn-border:var(--color-red7)] [--btn-fg:var(--color-red11)] [--btn-ghost-hover:var(--color-red3)]',
        // amber9 is a light swatch in both themes, so solid text stays dark.
        amber:
          '[--btn-solid:var(--color-amber9)] [--btn-solid-fg:#4e2009] [--btn-soft:var(--color-amber3)] [--btn-soft-hover:var(--color-amber4)] [--btn-outline:var(--color-amber2)] [--btn-border:var(--color-amber7)] [--btn-fg:var(--color-amber11)] [--btn-ghost-hover:var(--color-amber3)]'
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
