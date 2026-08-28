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
- keep app-level position identity independent from FEN. **Why:** FEN includes half-move and full-move counters and belongs to the notation/engine boundary; using it as the analysis key would split otherwise equivalent app positions and couple persisted keys to protocol formatting
- support `GamesStore` analysis indexing and `SerializationService` validation

## Notes
- `buildPositionKey(...)` is an opaque app-owned structural encoding of board occupancy, side to move, castling availability, and en-passant availability, not user-facing or persisted chess notation. Consumers compare or index it but do not parse it. If repetition-rule identity is introduced later, it needs a separately named contract rather than silently changing existing persisted analysis keys.
- FEN remains an engine-boundary detail owned by `EngineClient`.
