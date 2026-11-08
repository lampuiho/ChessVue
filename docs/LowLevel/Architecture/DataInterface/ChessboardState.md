# Board Position Types

## Purpose
Define the serialisable board state used by rules, move application, persistence, and restore. Source: `contracts/ChessboardState.ts`.

## Types
- `enum CheckState`

## Interfaces
- `interface ICastlingAvailability`
- `interface ICastlingRook`
- `interface IBoardPositionRuntime`
- `interface IBoardPosition`

## Data Structures
```ts
const enum CheckState {
  Check = "check",
  Checkmate = "checkmate"
}

interface ICastlingAvailability {
  whiteKingSide: boolean
  whiteQueenSide: boolean
  blackKingSide: boolean
  blackQueenSide: boolean
}

interface ICastlingRook {
  whiteKingSide: BoardId
  whiteQueenSide: BoardId
  blackKingSide: BoardId
  blackQueenSide: BoardId
}

interface IBoardPositionRuntime {
  checkState?: CheckState
  isCheckStateCached?: boolean
  isStandardInitialPosition?: boolean
  fen?: string
}

interface IBoardPosition {
  board: (IChessPiece | undefined)[]
  sideToMove: PlayerColour
  castlingAvailability: ICastlingAvailability
  castlingRook?: ICastlingRook
  enPassantTarget?: BoardId
  halfMoveClock: number
  fullMoveNumber: number
  $?: IBoardPositionRuntime
}
```

## Schemas
- `checkStateSchema` validates `CheckState` on persisted detailed moves.
- `castlingAvailabilitySchema` and `castlingRookSchema` validate the castling objects; each `castlingRookSchema` square is an integer from `0` to `63`.
- `boardPositionSchema` requires exactly `64` board entries, `halfMoveClock >= 0`, and `fullMoveNumber >= 1`. It declares no `$`, so parsing drops the runtime caches.
- A board entry accepts a piece, `null`, or `undefined`, and the parsed output always uses `undefined` for an empty square. **Why:** `JSON.stringify` writes an `undefined` array entry as `null`, so a saved board can only round-trip if the reader accepts `null`; normalising it immediately keeps one in-memory absence representation, as the [Nullability Convention](../index.md#nullability-convention) requires. Object properties need no such allowance because JSON omits `undefined` properties.

## Ownership
- `GameRuleUtility` creates and validates `IBoardPosition`; `MoveApplicationService.applyMove` and its board-edit operations mutate a caller-owned position, while `genPosition` copies the mutable board array and castling availability before replaying moves when a detached position is required. Immutable `IChessPiece` values and the never-mutated `castlingRook` object are shared, so piece identity survives reconstruction and animation. **Why:** the live and rendered selectors intentionally share one position while they identify the same node, so replacing the position or its pieces on every move would break that alias and force all consumers to install a new authority atomically. Analysis, replay, premove projection, and validation must instead detach only the mutable containers they need. The required invariant is visible ownership: `apply*` changes its argument; `gen*` returns an independently mutable position.
- `SerializationService` persists `IBoardPosition` inside `IGame`.
- `GamesStore`, through `GameAnalysisComposable.refreshAnalysisForGame(...)`, clears rendered analysis results when the rendered board changes; analysis seats do not store a position key or FEN.
- `$.checkState`, `$.isCheckStateCached`, `$.isStandardInitialPosition`, and `$.fen` are runtime-only derived caches. `GameRuleUtility.createInitialBoardPosition(...)` marks the known standard root immediately. **Why:** persisting deterministic projections would create a second authority that deserialisation or a later position mutation could leave stale; a replacement cache must remain disposable and invalidated by the mutation that changes its input.
- `CheckState.Checkmate` describes the chess state of a materialised position or a detailed move; it is never a `GameState`. The persisted outcome belongs to `IGame.resultState` and `resultReason` (including `ResultReason.Checkmate`), while the detailed move also retains its resulting check state.
- `GameRuleUtility.getCheckState(...)` caches both check and no-check results; `isCheckStateCached` distinguishes an uncached lookup from a cached `undefined` result. `GameRuleUtility.isStandardInitialPosition(...)` caches its boolean result. **Why:** omission naturally represents both "not in check" and "not calculated"; without the sentinel every no-check read would recalculate or the contract would need an artificial persisted value.
- `MoveNotationUtility.buildFen(...)` caches FEN on the position because engine and notation consumers can request the same deterministic projection repeatedly. FEN is not the application's general position identity. **Why:** a board edit mutates the root in place, so object identity cannot detect an engine-boundary position change, while using protocol-formatted FEN as every app key would couple structural identity to counters and notation rules. Effective mutations invalidate the cached value at the mutation point.
- These query functions are semantically reads but may initialise `$`. They stay in the chess utilities because the layer model does not permit a utility-to-service fetch for derived chess data, and keeping the cache beside the derivation avoids repeated calculation or duplicated lookup logic in every caller.
- Normal move application mutates the supplied position and replaces `$` with `undefined`. The board-edit actions `GamesStore.clearBoard(...)`, `deleteChessPiece(...)`, `moveChessPiece(...)`, and `toggleChessPiece(...)` reach `MoveApplicationService.clearBoard`, `deletePiece`, `movePiece`, and `togglePiece`, which drop `$` only when the edit is effective; an ineffective edit returns `false` and leaves the cache and history untouched. Full replacement positions supplied through `applyBoardEdit(...)` or `resetBoardToStartPosition(...)` retain their own runtime state, and unknown roots are verified lazily by the UCI command builder (`startpos` versus `fen`).

## Rules
- `board` is always a `64`-entry array indexed directly by `BoardId`.
- An omitted `enPassantTarget` means no en-passant capture is currently available. When present it is the square the capturing pawn moves to.
- An omitted `castlingRook` means each castling right uses the standard rook home square (`h1`/`a1` for White, `h8`/`a8` for Black). When present it names the rook origin square for each side; rule generation and premove castle shading read it before falling back to the standard squares, and `isStandardInitialPosition(...)` returns `false` for any position that carries it. No in-app workflow currently writes `castlingRook`, so it reaches a game only through a supplied root position or saved payload; FEN and UCI output do not encode it.
