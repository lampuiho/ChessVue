# DomainLogic/GameRuleService.md
# GameRuleService Module (Domain Logic)

## Purpose
Validate chess moves and board state according to game rules and variant constraints. This module is pure domain logic and does not depend on state management or presentation.

## Data Interfaces
- IChessboardState (from DataInterface/ChessboardState.md)
- IChessPiece (from DataInterface/ChessPiece.md)
- Move (from DataInterface/Move.md)

## Module Functions
- isMoveLegal(position: IChessboardState, move: Move): boolean
- generateLegalMoves(position: IChessboardState, player: PlayerColour): Move[]
- applyMove(position: IChessboardState, move: Move): IChessboardState
- isCheck(position: IChessboardState, player: PlayerColour): boolean
- isCheckmate(position: IChessboardState, player: PlayerColour): boolean
- isStalemate(position: IChessboardState, player: PlayerColour): boolean
- evaluateGameStatus(position: IChessboardState): GameStatus

## Calls
- none
