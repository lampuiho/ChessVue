# Analysis Types

## Purpose

Define ordered engine seats and their rendered results on a game. A seat remains assigned while empty, starting, stopped, failed, or restored without an available engine.

## Data Structures

```ts
interface IAnalysisLine {
  depth: number;
  scoreCp?: number;
  scoreMate?: number;
  pv: readonly IMove[];
  $?: { reference: number };
}
interface IAnalysisSeat {
  assignedEngine: IAssignedEngine;
  updatedAt: AnalysisTimestamp;
  bestMove?: IMove;
  lines: readonly IAnalysisLine[];
  isComplete: boolean;
}
interface IGameAnalysis {
  seats: IAnalysisSeat[];
}
type ReadonlyAnalysisSeat = DeepReadonly<IAnalysisSeat>;
interface IVisibleAnalysis {
  readonly engineSeats: readonly ReadonlyAnalysisSeat[];
}
```

## Ownership Rules

- `IGame.analysis.seats` is the ordered assignment list. Each seat embeds the copied engine configuration and at most three rendered lines for the game's current rendered position.
- `IAssignedEngine.$.analysisLines` is the separate runtime map, keyed by the engine's reported rank. It has no presentation cap and is never persisted or rendered directly.
- The client emits all retained lines in engine rank order. The game subscription takes `update.lines.slice(0, 3)`, sharing immutable line and move objects in a new small array. It does not re-rank by score or depth.
- Producers replace runtime map entries without mutating emitted line/PV objects. The common service guard validates every line, including ranks not displayed, and rejected updates retain the client's prior accepted entries.
- Effective rendered-position changes clear every seat's rendered results synchronously before publication and supersede its service operation. Same-position state changes preserve results. There is no per-position history cache or analysis position key.
- `getVisibleAnalysis` returns all seats in roster order, including empty seats. It creates an outer array for revision-driven rendering without cloning seats or line graphs. It performs no visibility filter or line selection.
- Explicit Stop retains `lines`, `bestMove`, `updatedAt`, and `isComplete`. Stopped availability and natural search completion are different states. Refresh/retry clears targeted results before starting.
- Runtime operation identity and subscription membership reject stale output, including A -> B -> A and replaced assignments with the same name.
- The seat schema limits persisted rendered lines to three. Their position is the root/rendered selection saved in the same game document; no compatibility reader or migration is provided for the former analysis shape.
- Missing score or best-move fields indicate unavailable values; an empty result does not remove an assignment. At most four analysis engines may be assigned to one game.
- `scoreCp` and `scoreMate` retain the UCI side-to-move perspective for the analysed position, including persisted and recorded lines. A positive mate distance means the side to move delivers mate; zero means that side is already mated. Presentation converts scores to White's perspective using the rendered position.
- Fold state remains UI-owned in `IUiLayoutState.analysisEngineExpandedByIndex`, indexed by seat order. Removing a seat reconciles that array in the view.

See [Engine](Engine.md), [GamesStore](../StateManagement/GamesStore.md), and the [runtime flow](../../ProcessFlows/EngineRuntimeOwnership.md).
