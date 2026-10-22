# Codex Follow-Up

Completed UI scenario fixes are covered by [application regressions](../journeys/__tests__/UiFollowUp.spec.ts), with repeatable starting data in [testing journeys](../journeys/README.md).

## Completed
- Consolidated `createInitialBoardPosition(...)` into `GameRuleUtility` after the temporary `GameRuleService` boundary was removed.
- Removed `normaliseBoardPosition(...)`.
- Reduced the public `BoardUtility` surface to shared helpers only.
- Kept board-position cloning private to rule-application code instead of exposing it as a general utility helper.
- Reduced a few avoidable copies in touched code paths:
  - `GamesStore.createGame(...)` no longer clones the initial root position.
  - `MoveHistoryService` now stores the supplied move, position, and clock objects directly.
- Implemented castling-right updates inside `GameRuleUtility` without cloning castling availability a second time.
- Added `GameRuleUtility` coverage for castling-right updates after king moves, rook moves, and rook captures.
- Simplified `IMoveNode` from `Mainline/Variation/Analysis` to `Live/Analysis`.
- Reserved runtime `IMoveNode.$.isHighlighted` for the UI; generic tree-wide synchronisation was removed and event-driven path highlighting remains deferred until its presentation semantics are established.
- Kept aborted live-turn rejections internal to `GamePlayerTurnComposable.playerMoveHandler(...)` and pushed the intentional cancellation handling into the tests that trigger those paths.
- Tightened `GamePlayerTurnComposable.requestPlayerMoveIfNeeded(...)` so it only arms turns while the game is actually on the live rendered board.
- Simplified rendered-node runtime selection so the lazy `renderedNode` cache follows the single authoritative rendered path instead of depending on `gameState` ordering during transitions.
- Reworked `GamesStore` store tests so they assert public state transitions instead of depending on internal pending-turn promise payloads.
- Updated stale docs in:
  - `docs/LowLevel/Architecture/DataInterface/Game.md`
  - `docs/LowLevel/Architecture/DataInterface/Move.md`
  - `docs/LowLevel/Architecture/UtilityIndex.md`
- Added protocol-neutral `IEngineOptionMeta` and UCI option-line parsing for action, boolean, choice, integer, and text options.
- Added `IEngineClient.getOptions(...)` backed by option metadata collected during the UCI initialisation handshake.
- Added `EngineRuntimeService.getOptions(...)` to discover copied option metadata through a temporary runtime which is always closed before completion.
- Added an `EnginesStore` option-metadata cache keyed by reusable profile id, including launch-identity invalidation and explicit refresh support.
- Kept saved `IEngineRecord.options` authoritative; discovered metadata is presentation-only and never populates or reconciles configured values.
- Added UCI command builders for `debug`, `isready`, `position`, `quit`, `register later`, `setoption`, `stop`, `uci`, and `ucinewgame`.
- Removed the separate position-synchronisation API. Purpose-level analysis, player-turn, and ponder calls now receive the canonical `IGame`, with `UciUtility` deriving the required highlighted or live move path directly.
- Removed the redundant `IEnginePositionState` contract and public new-game-boundary query; the concrete client now owns that protocol decision privately.
- Updated `buildUciMove(...)` to reuse `IMove.$.uci` when present and populate that runtime cache lazily when absent.
- Added purpose-level UCI command builders for continuous analysis, finding the next timed move, and starting a ponder search.
- Extended `parseBestMoveLine(...)` to retain an optional engine-suggested reply under runtime-only `IMove.$.ponderMove`.
- Reworked `NwjsUciEngineClient` around explicit handshake, ready, analysis, player-turn, ponder, stopping, stopped, and failed session states instead of routing lines by whichever output parser accepted them.
- Integrated the purpose-level builders and updated move/info parsers through `IEngineClient`, `EngineRuntimeService`, and `GamesStore`.
- Added ponder-hit handling and ponder-miss recovery that consumes the stopped speculative search's terminal `bestmove` before starting a fresh player search.
- Added direct runtime, store, and NW.js client coverage for canonical-game forwarding, ponder metadata preservation, and analysis/player/ponder state transitions.
- Added `position startpos` output for standard initial roots, backed by runtime-only `IBoardPosition.$.isStandardInitialPosition` verification caching.
- Added guarded board-edit APIs for toggling or deleting one chess piece, clearing the board, and resetting to the canonical start position, with first-edit root promotion, in-place later edits, and exact start-position cache handling.
- Completed the remaining move-flow, cache, copy-ownership, and documentation reconciliation. The temporary change tracker was removed after its design rationale was transferred to the owning high-level and low-level documents.
- Implemented the [code cleanup plan](CodeCleanupPlan.md): explicit cancellation and route/dialog/selection ownership replace async generation counters and orchestration watchers. Only two documented boundary watchers remain; the build enforces their allowlist and inferred implementation returns. Removed 440 redundant annotations after the behaviour refactors. The separate turn-flow/premove proposal remains open.

## Still Pending
- Define the board-interaction move-submission boundary so legal move selection uses `IMoveRaw`, promotion selection completes that raw move, and conversion to `IMove` happens only afterwards for move-tree and service interactions.
  - Explicitly scheduled as [PRE-RAW in the premove plan](PreMovePlan%28ToDo%29.md#pre-raw---pending-move-submission-refactor), before queue implementation: tests first, then Chessboard/GameView/store raw submission and canonical enrichment, preserving detailed history/engine-result consumers and existing behaviour. Application requires candidate facts; PV/modal submission and ponder commands require only raw fields. This item remains pending; planning it does not complete the refactor.
  - Full proposed signatures, [per-API justification for retaining `IMove`](RawMoveSubmissionDesign.md#type-retention-audit-and-justification), conversion/ownership rules, function flows and migration are in [Raw move submission API design](RawMoveSubmissionDesign.md); implementation still awaits approval.

## Verification
- Current cleanup: **527/527 unit/application tests across 84 files**, code audit, type checking and production build passed. Browser scope and generated reports are recorded in the [cleanup verification](CodeCleanupPlan.md#verification).
- The following 26-file/165-test record is the earlier baseline, not the current cleanup run.
- `npm run type-check`
- Result: passed.
- `npm run test:unit -- --run`
- Result: all `26` test files and `165` tests passed. The logged unreadable-save and `analysis boom` errors are expected from their failure-path tests.
