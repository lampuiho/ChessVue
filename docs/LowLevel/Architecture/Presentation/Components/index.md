# Components

## Common Components
- [Common Index](Common/index.md)
- [ChessPiece](ChessPiece.md)

## Shell Components
- [MenuBar](MenuBar.md)
- [GameTabs](GameTabs.md)
- [NewGameModal](NewGameModal.md)

## Game Workspace Components
- [GameWorkspaceShell](GameWorkspaceShell.md)
- [Chessboard](Chessboard.md)
- [BoardSquare](BoardSquare.md)
- [PiecePalette](PiecePalette.md)
- [PlayerPanel](PlayerPanel.md)
- [HistoryPanel](HistoryPanel.md)
- [HistoryTree](HistoryTree.md)
- [AnalysisPanel](AnalysisPanel.md)
- [AnalysisEngineSection](AnalysisEngineSection.md)
- [GameControlPanel](GameControlPanel.md)

## Settings Components
- [SettingsSection](SettingsSection.md)
- [EngineInventoryEditor](EngineInventoryEditor.md)

## Rules
- Common components are presentation-only building blocks reused by feature components and views.
- Common components are the only presentation units allowed to contain HTML or template markup.
- Components emit user intent upward or call store actions through their owning view.
- Components render derived state but do not own persistence, rule evaluation, or engine lifecycle.
- Feature components contain no HTML or template markup; they act as named adapters over common render components.
- Rendering-dense parts should be extracted into common building blocks before feature components become hard to read.
