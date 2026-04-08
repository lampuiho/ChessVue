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
- keep app-level position identity independent from FEN
- support `AnalysisStore` analysis indexing and `SerializationService` validation

## Notes
- `buildPositionKey(...)` is an app-owned structural encoding, not a user-facing or persisted chess notation.
- FEN remains an engine-boundary detail owned by `EngineClient`.
