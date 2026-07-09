import { TOOLBAR_HEIGHT_PX } from '../../../shared/sidebar'
import { usePanel } from '@renderer/hooks/use-panel'
import type { ReactNode } from 'react'

export function ToolbarProvider({ children }: { children: ReactNode }): React.JSX.Element {
  usePanel('toolbar-top', {
    mode: 'docked',
    open: true,
    edge: 'top',
    width: TOOLBAR_HEIGHT_PX
  })

  return <>{children}</>
}
