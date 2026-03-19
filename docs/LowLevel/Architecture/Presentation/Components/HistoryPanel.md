# Presentation/Components/HistoryPanel.md
# HistoryPanel Component (Presentation)

## Purpose
Display move tree and allow navigation across branches.

## Data Interfaces
- IMoveTree (from DataInterface/Move.md)

## Component Methods
- renderMoveNodes(moveTree: IMoveTree): VNode
- onNavigateNode(nodeId: string): void

## Calls
- MoveUpdateService.navigateToNode
- MoveUpdateService.getMainlineMoves
- GamesStore.getGameById

