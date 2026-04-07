# GameRuleService

## Purpose
Validate and apply legal chess moves for the baseline standard game flow.

## Public Interface
```ts
enum RuleOutcomeKind {
  Ongoing = "ongoing",
  Draw = "draw",
  WhiteWin = "whiteWin",
  BlackWin = "blackWin"
}

interface IRuleOutcome {
  kind: RuleOutcomeKind
  resultState: ResultState
  isFinal: boolean
}

generateLegalMoves(position: IBoardPosition): IMove[]
isMoveLegal(position: IBoardPosition, move: IMove): boolean
requiresPromotionSelection(position: IBoardPosition, move: IMove): boolean
applyMove(position: IBoardPosition, move: IMove): IBoardPosition
resolveRuleOutcome(position: IBoardPosition, repetitionCount: number): IRuleOutcome
```

## Responsibilities
- derive legal moves for the visible position
- block illegal and out-of-context moves
- enforce explicit promotion selection
- detect rule-derived terminal states such as draw or win
- treat timeout, resignation, draw agreement, and abandonment as store-owned lifecycle outcomes rather than board-rule outcomes
- return structural moves only; SAN and UCI decoration belongs to `MoveNotationService`

## Scenario Coverage
- `SCN-MOVE-01`
- `SCN-MOVE-02`
- `SCN-MOVE-03`
- `SCN-CTRL-03`
