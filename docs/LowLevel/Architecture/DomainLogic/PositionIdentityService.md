# PositionIdentityService

## Purpose
Own canonical structural position identity for equality checks and indexing.

## Public Interface
```ts
// src/domain/PositionIdentityService.ts
buildPositionKey(position: IBoardPosition): string
```

## Responsibilities
- derive a stable key from the structural board state
- include only position-relevant equality state: board occupancy, side to move, castling availability and en-passant target
- exclude move counters such as `halfMoveClock` and `fullMoveNumber` from the identity key
- keep structural position identity independent from FEN, which includes move counters and belongs to the notation and engine boundary

## Dependencies
- `PositionIdentityUtility.buildPositionKey` in `src/utility/chess`, which the service exposes unchanged

## Notes
- The key is an opaque app-owned encoding of occupied squares, side to move, castling availability and en-passant target. It is not user-facing or persisted chess notation; consumers compare or index it but do not parse it.
- There is currently no production caller. Analysis seat lines belong to the game's `renderedPath` and recorded analysis to its move node, rather than to a position key, and `SerializationService` validates saved games through their schema, move tree and paths rather than a position-identity check. The service is retained as the documented boundary for a future identity consumer. If repetition-rule identity is introduced later, it needs a separately named contract.
- FEN remains an engine-boundary detail owned by `EngineClient`.
