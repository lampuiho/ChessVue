# Components

## Common Components
- [Common Index](Common/index.md)
- [ChessPiece](ChessPiece.md)

## Shell Components
- [MenuBar](MenuBar.md)
- [GameTabs](GameTabs.md)
- [NewGameModal](NewGameModal.md)

## Game Workspace Components
- [Chessboard](Chessboard.md)
- [PlayerPanel](PlayerPanel.md)
- [HistoryPanel](HistoryPanel.md)
- [AnalysisPanel](AnalysisPanel.md)
- [GameControlPanel](GameControlPanel.md)

## Rules
- Common components are presentation-only building blocks reused by feature components and views.
- Components emit user intent upward or call store actions through their owning view.
- Components render derived state but do not own persistence, rule evaluation, or engine lifecycle.
