import type {
  PopoverAction,
  PopoverPanelId,
  PopoverPayload,
  PopoverShowMessage
} from '../../../../shared/popover-types'

export interface PopoverPanelProps<TPayload extends PopoverPayload = PopoverPayload> {
  payload: TPayload
  onAction: (action: PopoverAction) => void
}

export type PopoverPanelComponent = (props: PopoverPanelProps) => React.JSX.Element

export type PopoverPanelRegistry = Record<PopoverPanelId, PopoverPanelComponent>

export type { PopoverShowMessage }
