import { HugeiconsIcon, type HugeiconsIconProps, type IconSvgElement } from '@hugeicons/react'
import { cn } from '@renderer/lib/utils'

export type { IconSvgElement }

export interface IconProps extends Omit<HugeiconsIconProps, 'icon'> {
  icon: IconSvgElement
}

export function Icon({
  icon,
  className,
  size = 16,
  strokeWidth = 1.5,
  color = 'currentColor',
  ...props
}: IconProps): React.JSX.Element {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      className={cn('shrink-0', className)}
      {...props}
    />
  )
}
