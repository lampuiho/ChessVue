# GameRuleService

## Purpose
Validate and apply legal chess moves for the baseline standard game flow.

## Public Interface
```ts
generateLegalMoves(position: IBoardPosition): IMove[]
isMoveLegal(position: IBoardPosition, move: IMove): boolean
requiresPromotionSelection(position: IBoardPosition, move: IMove): boolean
applyMove(position: IBoardPosition, move: IMove): IBoardPosition
resolveResult(position: IBoardPosition): {
  resultState: ResultState
  resultReason: ResultReason
}
```

## Responsibilities
- derive legal moves for the visible position
- block illegal and out-of-context moves
- enforce explicit promotion selection
- detect terminal states such as draw or win and return an outcome plus cause
- return structural moves only; SAN and UCI decoration belongs to `MoveNotationService`

## Scenario Coverage
- `SCN-MOVE-01`
- `SCN-MOVE-02`
- `SCN-MOVE-03`
- `SCN-CTRL-03`
