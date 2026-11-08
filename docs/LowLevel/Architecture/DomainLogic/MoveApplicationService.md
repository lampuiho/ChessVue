# MoveApplicationService

## Purpose
Provide explicit in-place board-position mutations and a separate copied-position replay boundary.

## Public Interface
```ts
// src/domain/MoveApplicationService.ts
applyMove(position: IBoardPosition, move: IMoveCandidate): IBoardPosition
genPosition(rootPosition: IBoardPosition, moves: readonly IMoveCandidate[]): IBoardPosition
clearBoard(position: IBoardPosition): boolean
deletePiece(position: IBoardPosition, boardId: BoardId): boolean
movePiece(position: IBoardPosition, from: BoardId, to: BoardId): boolean
togglePiece(position: IBoardPosition, boardId: BoardId, piece: IChessPiece): boolean
```

`IMoveCandidate` is the complete move shape needed to apply a transition (coordinates, kind, moving colour and piece, optional capture and promotion). Detailed `IMove` values satisfy it.

## Mutation Contract
- `applyMove` mutates the supplied position and returns that same position for chaining. It does not create a snapshot, and it clears the position's runtime metadata. **Why:** authoritative live and rendered state may intentionally share that position; returning a replacement would silently break the alias unless every consumer changed authority atomically. The `apply*` name makes caller ownership visible.
- `clearBoard`, `deletePiece` and `movePiece` mutate the supplied position, return whether an effective edit occurred and clear position runtime metadata after an effective edit. `togglePiece` always changes the square (removing an equal kind-and-colour piece, otherwise replacing or adding the supplied piece) and therefore always returns `true`. **Why:** only the owning workflow knows whether an effective edit should clear history or restart analysis, while only the mutator knows exactly which derived caches became stale. Delayed global invalidation would permit stale reads between those steps.
- `genPosition` is the copying boundary. It clones `rootPosition` once, replays the supplied moves into that clone, and leaves `rootPosition` untouched. With an empty move list it returns a detached copy. **Why:** analysis, replay, previews and validation need independent mutation; sharing the board container would corrupt authority. A single operation that sometimes mutates and sometimes copies was rejected because the call site could not prove ownership. Any replacement must keep mutation versus detachment explicit.
- Callers own legality checks, complete move construction, workflow ordering, history updates and rollback policy. This service only applies an already accepted transition. **Why:** those side effects require live, analysis or validation context that a board transition does not have; putting them here would force simulations and replays to perform live-game work.

## Responsibilities
- provide the layer-2 transition boundary for application workflows while delegating chess mechanics to `GameRuleUtility` (`applyMove`, `cloneBoardPosition`). Stores must not call the utility's mutation directly, because that would bypass the documented ownership contract, while duplicating the mechanics here would create two chess implementations.
- apply complete moves to caller-owned positions in place
- replay a move sequence into a newly generated position when a detached snapshot is required
- provide direct board-edit mutations with explicit changed-state results
- invalidate cached position metadata after mutation

## Callers
- `GamesStore` composables: `GamePositionComposable` (live and rendered positions, premove projection), `GameMoveComposable` (commits and rewinds), `GamePremoveComposable` (revalidation previews) and `GameBoardEditComposable` (board edits).
- `EngineRuntimeService` for detached ponder and principal-variation validation positions.
- Presentation uses `genPosition` for detached preview boards: `GameView`, `GameControlPanel` and `SavedGamesView`, and `GameView` applies moves to its own detached preview. These are narrow reads under the [dependency rules](../index.md#dependency-rules); none mutates canonical game state.

## Dependencies
- `GameRuleUtility`
