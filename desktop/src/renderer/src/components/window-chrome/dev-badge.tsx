import { forwardRef } from 'react'

export const DevBadge = forwardRef<HTMLButtonElement, { onClick?: () => void }>(function DevBadge(
  { onClick },
  ref
): React.JSX.Element {
  return (
    <button
      ref={ref}
      type="button"
      data-testid="dev-badge"
      className="mr-2 shrink-0 rounded px-1.5 py-1 text-[9px] font-semibold leading-none tracking-[0.08em] text-emerald-300 transition-colors hover:bg-emerald-500/30 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
      aria-label="Open local project metadata"
      onClick={onClick}
    >
      DEV
    </button>
  )
})
