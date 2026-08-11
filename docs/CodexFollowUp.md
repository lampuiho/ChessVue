# Codex Follow-Up

## Completed
- Moved `createInitialBoardPosition(...)` into `GameRuleService`.
- Removed `normaliseBoardPosition(...)`.
- Reduced the public `BoardUtility` surface to shared helpers only.
- Kept board-position cloning private to rule-application code instead of exposing it as a general utility helper.
- Reduced a few avoidable copies in touched code paths:
  - `GamesStore.createGame(...)` no longer clones the initial root position.
  - `MoveHistoryService` now stores the supplied move, position, and clock objects directly.
- Implemented castling-right updates inside `GameRuleService` without cloning castling availability a second time.
- Added `GameRuleService` coverage for castling-right updates after king moves, rook moves, and rook captures.
- Simplified `IMoveNode` from `Mainline/Variation/Analysis` to `Live/Analysis`.
- Added runtime `IMoveNode.$.isHighlighted` and hydrate or sync support so selection state stays runtime-only.
- Kept aborted live-turn rejections uncaught in `_playerMoveHandler(...)` and pushed the intentional cancellation handling into the tests that trigger those paths.
- Tightened `GamesStore._requestPlayerMoveIfNeeded(...)` so it only arms turns while the game is actually on the live current board.
- Simplified rendered-node runtime selection so `renderedNode` follows the rendered path directly instead of depending on `gameState` ordering during transitions.
- Reworked `GamesStore` store tests so they assert public state transitions instead of depending on internal pending-turn promise payloads.
- Updated stale docs in:
  - `docs/LowLevel/Architecture/DataInterface/Game.md`
  - `docs/LowLevel/Architecture/DataInterface/Move.md`
  - `docs/LowLevel/Architecture/UtilityIndex.md`
- Added protocol-neutral `IEngineOptionMeta` and UCI option-line parsing for action, boolean, choice, integer, and text options.
- Added `IEngineClient.getOptions(...)` backed by option metadata collected during the UCI initialisation handshake.
- Added UCI command builders for `debug`, `isready`, `position`, `quit`, `register later`, `setoption`, `stop`, `uci`, and `ucinewgame`.
- Changed position synchronisation to pass the canonical `IGame` through `EngineRuntimeService` and `IEngineClient`, with `UciUtility.buildPositionCommand(...)` deriving the root FEN and highlighted move path directly.
- Removed the redundant `IEnginePositionState` contract and public new-game-boundary query; the concrete client now owns that protocol decision privately.
- Updated `buildUciMove(...)` to reuse `IMove.$.uci` when present and populate that runtime cache lazily when absent.
- Added purpose-level UCI command builders for continuous analysis, finding the next timed move, and starting a ponder search.
- Extended `parseBestMoveLine(...)` to retain an optional engine-suggested reply under runtime-only `IMove.$.ponderMove`.

## Still Pending
- Finish the items still open in `docs/StuffChangedAndNeedChanging.md`.
- Continue the broader copy-reduction pass beyond the paths already touched.
- Revisit the remaining process-flow docs that still describe the old private player-move flow.
- Decide which layer populates configured `IEngineOptionMap` values from discovered option metadata; metadata intentionally remains outside engine records for now.
- Add `position startpos` support so games rooted at the standard initial position do not emit the full starting FEN.
- Complete the deferred client integration for the purpose-level command builders and updated `parseBestMoveLine(...)` and `parseInfoLine(...)` boundaries, including ponder-hit or ponder-miss orchestration and use of `IAnalysisLine.$.reference` for MultiPV line identity.
- Run the wider regression suite outside `GamesStore.spec.ts` after the next batch of tracker items lands.

## Verification
- `npx vitest run src/domain/__tests__/GameRuleService.spec.ts src/domain/__tests__/MoveUpdateService.spec.ts src/domain/__tests__/SerializationService.spec.ts`
- Result: `18` tests passed.
- `npx vitest run src/state/__tests__/GamesStore.spec.ts`
- Result: `16` tests passed. The mocked `analysis boom` stderr is still expected from the failure-path test.
