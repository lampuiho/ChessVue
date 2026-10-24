# Components

## Common Components
- [Common Index](Common/index.md)
- [ChessPiece](ChessPiece.md)

## Shell Components
- [MenuBar](MenuBar.md)
- [GameTabs](GameTabs.md)
- [GameCreationModal](GameCreationModal.md)

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
- Vue views and feature components own their rendered surface; shared primitives own their common drawing or dialog surface. All styling stays in the global CSS modules.
- Feature components call existing store actions locally when they own the complete interaction. Events cross an actual ownership boundary, such as captured board input, playback, Menu interruption or modal dismissal.
- Components render derived state but do not own persistence, rule evaluation, or engine lifecycle.
- Read mutable game fields and arrays through their existing reactive owners; no revision prop or manual publication layer is used.
- Extract common behaviour where there is actual shared use, without adding prop/event relays solely to preserve an extra component layer.
