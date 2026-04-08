# GameRuleService

## Purpose
Validate and apply legal chess moves for the baseline standard game flow.

## Public Interface
```ts
interface IRuleResult {
  resultState: ResultState
  resultReason: ResultReason | null
}

generateLegalMoves(position: IBoardPosition): IMove[]
isMoveLegal(position: IBoardPosition, move: IMove): boolean
requiresPromotionSelection(position: IBoardPosition, move: IMove): boolean
applyMove(position: IBoardPosition, move: IMove): IBoardPosition
resolveResult(position: IBoardPosition): IRuleResult
```

## Responsibilities
- derive legal moves for the visible position
- block illegal and out-of-context moves
- enforce explicit promotion selection
- detect rule-derived terminal states such as draw or win
- treat timeout, resignation, draw agreement, and abandonment as store-owned lifecycle outcomes rather than board-rule outcomes
- return structural moves only; SAN and UCI decoration belongs to `MoveNotationService`
- baseline rule resolution is driven by the visible board state only; repetition-count tracking is out of scope unless promoted by a higher-level contract later

## Scenario Coverage
- `SCN-MOVE-01`
- `SCN-MOVE-02`
- `SCN-MOVE-03`
- `SCN-CTRL-03`
