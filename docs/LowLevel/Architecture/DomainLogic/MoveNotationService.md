# MoveNotationService

## Purpose
Own app-facing move notation derived from structural ChessVue move and position data.

## Public Interface
```ts
buildSan(position: IBoardPosition, move: IMove): string
buildUci(move: IMove): string
decorateMove(position: IBoardPosition, move: IMove): IMove
```

## Responsibilities
- derive SAN lazily for rendering from structural moves and positions
- derive UCI lazily for runtime engine communication
- write runtime-only notation metadata into `IMove.$` when requested
- keep SAN and UCI out of the canonical persisted move contract

## Notes
- `MoveNotationService` depends on domain chess rules, so it belongs in `Domain Logic`.
- `decorateMove(...)` is optional convenience only; callers may request raw strings instead.
