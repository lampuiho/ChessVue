# Q-PLAY-001 — Live play continues during interactive analysis

| Field | Value |
| --- | --- |
| Status | Resolved product policy; implementation changes planned |
| Priority | P0 |
| Raised | 15 October 2026 |
| Resolved | 21 October 2026 |
| Decision source | User's numbered premove/analysis clarifications, especially answers 2–4 |
| Related decisions | [Premove conflicts and scenarios](Q-PLAY-002-PremoveAnalysisConflicts.md), [suggestion interaction](../analysis/Q-ANALYSIS-003-SuggestionInteraction.md), [temporary-branch scope](../analysis/Q-ANALYSIS-002-VariationRetention.md) |

## Decision

Explicit Analyse does not stop the actual clock or live progression. Engine replies, valid queued human moves and subsequent engine turns continue while the user explores or reviews another canonical position. Ordinary history review also does not suspend premoves.

Enter analysis through an explicit button on the currently selected canonical move. That rendered position excludes premoves and remains the analysis engine's input. Displayed premoved pieces are derived separately. Exploration changes only its selected analysis board; actual play changes only the live game.

Exiting/returning selects the latest live position and reapplies only the remaining valid queue for display. It is not a clock resume, queue replay or reason to start a duplicate engine search. Real Manual/Menu pause ownership still prevents actual commits until explicitly resolved under its existing policy.

The later [paused-entry decision](Q-PLAY-003-PausedAnalysisEntry.md) allows explicit Analyse while that actual pause remains. The record explains why the older paused-entry contract required a product decision and separates the still-pending question about exploratory moves/history while paused. Entry/Exit cannot release the actual pause.

Local-local play has no premoves or previous-side off-turn entitlement: each actual move hands input to the other side. Takeback always changes the actual live game. Invalid premoves clear the whole queue and are never history.

## Implementation gap and evidence

This decision changes the current implementation rather than describing existing behaviour:

- [GameMoveComposable](../../../src/state/game/GameMoveComposable.ts) currently adds Analysis pause on entry and removes it on exit.
- [GamePlayerTurnComposable](../../../src/state/game/GamePlayerTurnComposable.ts) currently requires the selected live board to arm a successor actual turn.
- Equal rendered/live path values currently alias board caches; active selected analysis needs independent position ownership even before its first exploratory move.
- Background actual commits currently prune descendants that can contain the active exploratory branch. Protect its selection lifetime. The user's coverage-audit clarification confirms that once background play passes its anchor, the branch remains history; do not add Exit/navigation cleanup. Retain pruning only for the existing own-current-move case.

On 21 October 2026 four focused existing [store tests](../../../src/state/__tests__/GamesStore.spec.ts) passed, confirming current paused-analysis/path behaviour. Existing browser JRN-RACE-02 was inspected and asserts that frozen policy too; it was not rerun. Passing those tests does not demonstrate the newly requested background behaviour.

The [premove plan](../../PreMovePlan%28ToDo%29.md) records the exact baseline command and implementation/verification sequence. Its [conflict record](Q-PLAY-002-PremoveAnalysisConflicts.md) defines the required background, hotseat, clock, cache, pruning and queue-clear scenarios.

## Acceptance and compatibility

Replace obsolete Analysis-freeze expectations with controlled tests for multiple interleaved actual engine/local turns, running actual clocks and timeout behind an unchanged selected analysis board. Preserve genuine Manual/Menu pause, cancellation, provider/ponder ordering and independent analysis-seat regressions.

Test entry at equal selected/live paths before any exploratory move, an active branch surviving actual commits, queue consumption/cancellation before exit and actual Takeback removing a selected branch. Existing paused saves must remain paused until explicit Resume without retaining an obsolete Analysis-owned resume requirement.

The accepted current-move-pruning/actual-move-recording distinction remains in force. A branch whose anchor becomes historical stays in history under the user's 21 October audit clarification. Exit/navigation does not retrospectively prune it; retained exploratory nodes still do not create actual-move analysis records or put premoves in history.
