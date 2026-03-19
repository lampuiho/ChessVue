# Presentation/Components/HistoryPanel.md
# HistoryPanel Component (Presentation)

## Purpose
Display move tree and allow navigation across branches.

## Data Interfaces
- IMoveTree (from DataInterface/Move.md)

## Component Methods
- IMoveTree
enderMoveNodes(moveTree: MoveTree): VNode
- onNavigateNode(nodeId: string): void

## Calls
- MoveUpdateService.navigateToNode
- MoveUpdateService.getMainline
- GamesStore.getGameById

