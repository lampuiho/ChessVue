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

## Still Pending
- Finish the items still open in `docs/StuffChangedAndNeedChanging.md`.
- Continue the broader copy-reduction pass beyond the paths already touched.
- Revisit the remaining process-flow docs that still describe the old private player-move flow.
- Decide which layer populates configured `IEngineOptionMap` values from discovered option metadata; metadata intentionally remains outside engine records for now.
- Run the wider regression suite outside `GamesStore.spec.ts` after the next batch of tracker items lands.

## Verification
- Current UCI state-machine pass: automated tests and type checking were not run because this environment does not expose a Node executable or package-manager commands.
- Previously completed regression runs:
- `npx vitest run src/domain/__tests__/GameRuleService.spec.ts src/domain/__tests__/MoveUpdateService.spec.ts src/domain/__tests__/SerializationService.spec.ts`
- Result: `18` tests passed.
- `npx vitest run src/state/__tests__/GamesStore.spec.ts`
- Result: `16` tests passed. The mocked `analysis boom` stderr is still expected from the failure-path test.
