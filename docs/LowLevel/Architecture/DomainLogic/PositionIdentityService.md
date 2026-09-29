# PositionIdentityService

## Purpose
Own canonical structural position identity for runtime indexing, equality checks, and validation.

## Public Interface
```ts
buildPositionKey(position: IBoardPosition): string
```

## Responsibilities
- derive a stable key from the structural board state
- include only position-relevant equality state: board occupancy, side to move, castling availability, and en-passant target
- exclude move counters such as `halfMoveClock` and `fullMoveNumber` from the identity key
- keep structural position identity independent from FEN, which includes half-move and full-move counters and belongs to the notation/engine boundary
- support `GamesStore` analysis indexing and `SerializationService` validation

## Notes
- `buildPositionKey(...)` is an opaque app-owned structural encoding of board occupancy, side to move, castling availability, and en-passant availability, not user-facing or persisted chess notation. Consumers compare or index it but do not parse it. Analysis seats do not use this key. If repetition-rule identity is introduced later, it needs a separately named contract.
- FEN remains an engine-boundary detail owned by `EngineClient`.
