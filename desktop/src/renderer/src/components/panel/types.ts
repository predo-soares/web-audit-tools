import type {
  PanelAction,
  PanelAlign,
  PanelId,
  PanelMode,
  PanelPayload,
  PanelPlacement
} from '../../../../shared/panel-types'

export interface PanelViewProps<TPayload extends PanelPayload | void = PanelPayload> {
  payload: TPayload extends void ? undefined : TPayload
  onAction: (action: PanelAction) => void
}

export type PanelViewComponent = (props: {
  payload?: PanelPayload
  onAction: (action: PanelAction) => void
}) => React.JSX.Element

export type PanelViewRegistry = Partial<Record<PanelId, PanelViewComponent>>

export interface PanelShowState {
  panelId: PanelId
  mode: PanelMode
  payload?: PanelPayload
  placement: PanelPlacement
  align: PanelAlign
  resolvedPlacement?: PanelPlacement
}
