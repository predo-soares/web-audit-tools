import { cn } from '@renderer/lib/utils'

/**
 * A blur that intensifies toward the bottom edge and fades to none — softer than
 * a single uniform `backdrop-blur`. Stacks a few backdrop-filter layers with
 * increasing radii, each masked by a gradient so the strongest blur only reaches
 * the bottom band. Decorative; position it with `className` (e.g. `absolute inset-0`).
 */
export function ProgressiveBlur({ className }: { className?: string }): React.JSX.Element {
  return (
    <div aria-hidden className={cn('pointer-events-none', className)}>
      <div className="absolute inset-0 backdrop-blur-[1px] [-webkit-mask-image:linear-gradient(to_top,black,transparent_65%)] [mask-image:linear-gradient(to_top,black,transparent_65%)]" />
      <div className="absolute inset-0 backdrop-blur-[3px] [-webkit-mask-image:linear-gradient(to_top,black,transparent_45%)] [mask-image:linear-gradient(to_top,black,transparent_45%)]" />
      <div className="absolute inset-0 backdrop-blur-[6px] [-webkit-mask-image:linear-gradient(to_top,black,transparent_25%)] [mask-image:linear-gradient(to_top,black,transparent_25%)]" />
    </div>
  )
}
