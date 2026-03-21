# Common Components

## Purpose
Define reusable presentation primitives and functional UI wrappers shared across views and feature components.

## Components
- [ChessPiece](../ChessPiece.md)
- [ToolbarStrip](ToolbarStrip.md)
- [MenuToolbarButton](MenuToolbarButton.md)
- [DialogButton](DialogButton.md)
- [HomeMenuButton](HomeMenuButton.md)
- [SidePanelButton](SidePanelButton.md)
- [AnalysisChessPieceButton](AnalysisChessPieceButton.md)
- [TabButton](TabButton.md)
- [SettingsActionButton](SettingsActionButton.md)
- [ButtonGroup](ButtonGroup.md)
- [ItemList](ItemList.md)
- [TreeView](TreeView.md)
- [StatusCard](StatusCard.md)
- [ClockDisplay](ClockDisplay.md)
- [FormSection](FormSection.md)
- [FieldRow](FieldRow.md)
- [TextField](TextField.md)
- [SelectField](SelectField.md)
- [ToggleField](ToggleField.md)
- [NumberField](NumberField.md)
- [InlineMessage](InlineMessage.md)
- [EmptyState](EmptyState.md)
- [BoardGrid](BoardGrid.md)
- [SquareSurface](SquareSurface.md)
- [PanelSurface](PanelSurface.md)
- [WorkspaceShell](WorkspaceShell.md)
- [TabbedView](TabbedView.md)
- [ModalDialog](ModalDialog.md)

## Rules
- Common components are generic and domain-agnostic.
- Common components own all HTML and template markup for the presentation layer.
- They accept display data, slots, and emitted events, but they do not know about chess rules, stores, routes, or persistence.
- Feature components compose these primitives rather than reimplementing tab, list, panel, dialog, and context-specific button behaviour ad hoc.
