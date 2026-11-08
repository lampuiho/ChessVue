# Analysis Types

## Purpose

Define ordered engine seats, their rendered results on a game, and the analysis recorded on played moves. A seat remains assigned while empty, starting, stopped, failed, or restored without an available engine. Sources: `contracts/AnalysisSeat.ts` (line, seat, and recorded-analysis shapes plus schema factories) and `contracts/Analysis.ts` (game and visible analysis; it also re-exports `AnalysisSeat.ts`).

## Interfaces
- `interface IAnalysisLineRuntime`
- `interface IAnalysisLine`
- `interface IAnalysisSeat`
- `interface IRecordedAnalysis`
- `type ReadonlyAnalysisSeat`
- `interface IGameAnalysis`
- `interface IVisibleAnalysis`

## Data Structures

```ts
interface IAnalysisLineRuntime {
  reference: number;
}
interface IAnalysisLine {
  depth: number;
  scoreCp?: number;
  scoreMate?: number;
  pv: readonly IMove[];
  $?: IAnalysisLineRuntime;
}
interface IAnalysisSeat {
  assignedEngine: IAssignedEngine;
  updatedAt: AnalysisTimestamp;
  bestMove?: IMove;
  lines: readonly IAnalysisLine[];
  isComplete: boolean;
}
interface IRecordedAnalysis {
  recordedAt: AnalysisTimestamp;
  seats: IAnalysisSeat[];
}
type ReadonlyAnalysisSeat = DeepReadonly<IAnalysisSeat>;
interface IGameAnalysis {
  seats: IAnalysisSeat[];
}
interface IVisibleAnalysis {
  readonly engineSeats: readonly ReadonlyAnalysisSeat[];
}
```

## Schemas
- `createAnalysisLineSchema(moveSchema)`, `createAnalysisSeatSchema(moveSchema)`, and `createRecordedAnalysisSchema(moveSchema)` in `AnalysisSeat.ts` take the move schema as a parameter. **Why:** `Move.ts` embeds recorded analysis in `moveNodeSchema` while analysis lines embed moves, so importing schemas in both directions would form a module cycle; injecting `moveSchema` keeps `AnalysisSeat.ts` dependent only on the `IMove` type.
- `Analysis.ts` instantiates `analysisLineSchema` and `analysisSeatSchema` with the real `moveSchema`, and `Move.ts` instantiates `recordedAnalysisSchema`. `gameAnalysisSchema` wraps the seat array; `visibleAnalysisSchema` validates `{ engineSeats }`.
- A line requires an integer `depth >= 0`, optional integer `scoreCp` and `scoreMate`, and a `pv` of detailed moves; it declares no `$`. A seat uses `assignedEngineSchema`, an `AnalysisTimestamp` `updatedAt`, an optional `bestMove`, at most three `lines`, and `isComplete`. A recorded analysis requires between one and four seats.

## Ownership Rules

- `IGame.analysis.seats` is the ordered assignment list. Each seat embeds the copied engine configuration and at most three rendered lines for the game's current rendered position. `GameAnalysisComposable.createAnalysisSeat(...)` copies the profile's display name, entry path, client type, and a shallow copy of its option map; a new seat has no lines and `isComplete: false`.
- `IAssignedEngine.$.analysisLines` is the separate runtime map, keyed by `IAnalysisLine.$.reference`, the engine's reported line rank (UCI `multipv`, defaulting to `1`). It has no presentation cap and is never persisted or rendered directly.
- The client emits all retained lines in engine rank order. The game subscription takes `update.lines.slice(0, 3)`, sharing immutable line and move objects in a new small array. It does not re-rank by score or depth. Seats request `multiPv: 3` with `EngineAnalysisSearchMode.Infinite`.
- Producers replace runtime map entries without mutating emitted line/PV objects. The common service guard validates every line, including ranks not displayed; when the handler returns `false`, the client restores its prior accepted entry for that rank.
- Effective rendered-position changes clear every targeted seat's `bestMove` and `lines` and reset `isComplete` synchronously before restarting, superseding the seat's service operation. Same-position state changes preserve results. There is no per-position history cache or analysis position key.
- No search starts while the game is in `BoardEdit`, or when the rendered node is the live node of a game that ended by `ResultReason.Checkmate` or `ResultReason.Stalemate`, because no legal move remains to search; the refresh stops the targeted seats instead. Updates that arrive during `BoardEdit` are ignored.
- `getVisibleAnalysis` returns `undefined` for a game with no seats. Otherwise it returns all seats in roster order, including empty seats, in a new outer array without cloning seats or line graphs. It performs no visibility filter or line selection.
- Explicit Stop retains `lines`, `bestMove`, `updatedAt`, and `isComplete`. Stopped availability and natural search completion are different states. Refresh/retry clears targeted results before starting.
- Runtime operation identity and subscription membership reject stale output, including A -> B -> A and replaced assignments with the same name. A subscription publishes only while it is active and the game still resolves its engine object to the same seat.
- The seat schema limits persisted rendered lines to three. Their position is the root/rendered selection saved in the same game document; no compatibility reader or migration is provided for the former analysis shape.
- Missing score or best-move fields indicate unavailable values; an empty result does not remove an assignment. At most four analysis engines may be assigned to one game, and `addAnalysisEngine(...)` rejects a second seat with the same engine display name.
- `scoreCp` and `scoreMate` retain the UCI side-to-move perspective for the analysed position, including persisted and recorded lines. A positive mate distance means the side to move delivers mate; zero means that side is already mated. Presentation converts scores to White's perspective using the rendered position.
- `IRecordedAnalysis` is captured by `GameAnalysisComposable.captureMoveAnalysis(...)` when a live move is committed while the rendered node is the live node. It copies, through `analysisSeatSchema`, only seats that have lines, so the copies carry no engine runtime, line references, or later updates; no qualifying seat means no record. See [Move](Move.md#notes).
- Fold state remains UI-owned in `IUiLayoutState.analysisEngineExpandedByIndex`, indexed by seat order. `AnalysisPanel` removes the matching index when it removes a seat.

See [Engine](Engine.md), [GamesStore](../StateManagement/GamesStore.md), and the [runtime flow](../../ProcessFlows/EngineRuntimeOwnership.md).
