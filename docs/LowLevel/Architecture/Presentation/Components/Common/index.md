# Common Components

## Purpose
Define the small reusable drawing and control primitives in `src/components/common`, shared by views, feature components and modals.

## Components
- [AppIcon](AppIcon.md): named stroke icon from `src/config/IconConfig.ts`.
- [ChessPiece](ChessPiece.md): SVG artwork for one chess piece.
- [ControlButton](ControlButton.md): icon-only gameplay control with a tooltip.
- [ExpandableText](ExpandableText.md): truncated text that opens a full-text popover.

The dialog shell `ModalDialog` lives with the modal components; see [Modals](../Modals/index.md).

## Rules
- Common components are generic and domain-agnostic apart from the chess-piece artwork. They accept display data, slots and native events, and do not read stores, routes or persistence.
- Each common component renders its own template and is styled by one global stylesheet. A different presentation is an explicit class variant in that stylesheet, not a local override.
- Common components that style app chrome consume semantic colour variables from the root appearance contract rather than hardcoded light/dark values. Piece artwork uses the fixed board palette in `board.css` until piece themes exist.
- Prefer flexbox, grid, intrinsic sizing and `em`/`rem` units over fixed sizes.
- Add a common component only for actual repeated use with shared behaviour. Plain repeated markup uses the shared global classes instead.

## Replaced primitive docs
The baseline design listed a larger generic render layer. None of these components was ever implemented; their responsibilities are owned as follows. See [Markup and Ownership Rules](../../index.md#markup-and-ownership-rules) for the decision.

| Proposed primitive | Implemented owner |
| --- | --- |
| `WorkspaceShell`, `GameWorkspaceShell` | `GameView` markup with `workspace.css` layout classes |
| `TabbedView`, `TabButton` | `GameTabs` (`.tab-strip`, `.tab-button`); Settings categories and library modes are `NavigationFrame` menu buttons |
| `ToolbarStrip`, `ButtonGroup`, `MenuToolbarButton` | `NavigationFrame` slots with `.navigation-group` and `.menu-button` |
| `HomeMenuButton` | `.action-card` buttons in `HomeView` and `GameResultModal` |
| `DialogButton`, `SettingsActionButton` | `.text-button` with `--primary`, `--ghost` and `--danger` variants |
| `SidePanelButton` | `.icon-button`, `.panel-chip` and `ControlButton` |
| `AnalysisChessPieceButton` | Palette buttons in `Chessboard` and choices in `PromotionModal`, each drawing `ChessPiece` |
| `BoardGrid`, `SquareSurface`, `BoardSquare`, `PiecePalette` | `Chessboard` |
| `PanelSurface` | `.side-panel` classes in `panels.css` |
| `TreeView`, `HistoryTree` | `HistoryPanel` |
| `ItemList` | Lists in `SavedGamesView`, `SettingsView` and the engine views |
| `StatusCard`, `ClockDisplay` | `PlayerPanel` |
| `FormSection`, `FieldRow`, `SettingsSection` | `.form-section` and `.field-row` classes in `shared.css` |
| `TextField`, `SelectField`, `NumberField`, `ToggleField` | Native inputs with `.field-control` and `.toggle-row` |
| `InlineMessage`, `EmptyState` | `.inline-message`, `.empty-state` and `.panel-empty` classes |
| `AnalysisEngineSection` | Inline engine rows in `AnalysisPanel` |
| `EngineInventoryEditor` | `SettingsView` engine overview and the routed engine views |
