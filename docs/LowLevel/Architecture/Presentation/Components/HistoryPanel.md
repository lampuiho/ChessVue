# HistoryPanel Component (Presentation)

## Purpose
Display move tree with mainline and branch navigation.

## Interfaces
- `HistoryPanelProps`

## Component Methods
- `renderMoveNodes(moveTree: MoveTree): VNode`
- `onNavigateNode(nodeId: string): void`

## Called By
- `GameView`

## Calls
- `MoveUpdateService.navigateToNode`
- `MoveUpdateService.getMainline`
- `GamesStore.getGameById`
