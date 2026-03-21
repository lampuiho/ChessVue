# GameRuleService

## Purpose
Validate and apply legal chess moves for the baseline standard game flow.

## Public Interface
```ts
generateLegalMoves(position: IBoardPosition): IMove[]
isMoveLegal(position: IBoardPosition, move: IMove): boolean
requiresPromotionSelection(position: IBoardPosition, move: IMove): boolean
applyMove(position: IBoardPosition, move: IMove): IBoardPosition
resolveResultState(position: IBoardPosition): ResultState
```

## Responsibilities
- derive legal moves for the visible position
- block illegal and out-of-context moves
- enforce explicit promotion selection
- detect terminal states such as draw or win

## Scenario Coverage
- `SCN-MOVE-01`
- `SCN-MOVE-02`
- `SCN-MOVE-03`
- `SCN-CTRL-03`
