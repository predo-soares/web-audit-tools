# Audit Screens (Desktop)

An Electron app that previews a URL simultaneously across several device sizes and helps audit the pages (SEO, Lighthouse, runtime evidence), including sharing that evidence with an AI agent.

## Language

**Device pane**:
One device viewport shown in the preview area (iPhone, iPad, or Desktop), each with its own frame, dimensions, and per-device controls.
_Avoid_: panel (a "panel" is a chrome-UI surface such as the toolbar or sidebar, not a device)

**Active pane**:
The single device pane the user is currently interacting with. It is the source of interactions that get mirrored to other panes.
_Avoid_: focused pane, selected device

**Interaction sync**:
The behavior where pointer, scroll, and keyboard input performed on the active pane is mirrored onto the other participating panes so several devices can be driven at once.
_Avoid_: mirroring mode, link mode

**Linked device**:
A device pane that participates in interaction sync. Linked panes mirror input among themselves; an unlinked pane is fully detached — it neither sends nor receives mirrored input and behaves as an independent island. Link membership is per device.
_Avoid_: synced device, connected pane

**Share with agent**:
The action of capturing one device pane's evidence (screenshot, runtime evidence, dev context, title, optional SEO audit) into a capture bundle and putting a pointer to it on the clipboard for an AI agent to read. Always scoped to a single device.
_Avoid_: snapshot for agent, snapshot all
