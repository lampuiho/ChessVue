# Background analysis implementation plan

Prepared on 21 October 2026 from the resolved [analysis decision](questions/play/Q-PLAY-001-LiveProgressDuringAnalysis.md) and [conflict review](questions/play/Q-PLAY-002-PremoveAnalysisConflicts.md). **Priority: implement before premoves. Status: failing unit tests recorded; production implementation follows.** The [premove plan](PreMovePlan%28ToDo%29.md) depends on this work and must not absorb it again.

## Outcome and scope

Entering Analyse explicitly on the current selected canonical move leaves the actual clock and actual play running. The selected analysis board stays independent while engine turns continue in the background. History review also allows actual progression. Exit returns to the latest live node without changing clock ownership, replaying a move or repeating a search.

Use the existing data model, store APIs and services. Exercise game records and transitions directly in unit tests before changing implementation; do not build a separate application workflow or start with browser/UI changes. Add only the smallest data distinction needed where current states conflate explicit analysis with history review.

This plan implements no premove queue, future-move validation, red-square display, queue controls or speculative board. Canonical rendered positions continue to exclude premoves. Future premoves will use the resulting background actual-turn flow rather than introducing another analysis policy.

## Existing APIs and boundaries

| Owner | Existing seam to exercise and change |
| --- | --- |
| [GamesStore](../src/state/GamesStore.ts) | `createGame`, `insertGame`, `makeMove`, `navigateToNode`, `enterInGameAnalysis`, `exitInGameAnalysis`, `pauseGame`, `resumeGame`, `takeBack`, `syncClock` and reassignment |
| [GameMoveComposable](../src/state/game/GameMoveComposable.ts) | Analysis entry/exit, actual commits, selection, Takeback and pruning; entry currently pauses and exit resumes |
| [GamePositionComposable](../src/state/game/GamePositionComposable.ts) | Rendered/live caches and paths; equal-valued paths currently re-alias board objects |
| [GamePlayerTurnComposable](../src/state/game/GamePlayerTurnComposable.ts) | Existing single actual-turn deferred, delivery, abort/drain and arming gate; arming currently requires the live board to be selected |
| [GameClockComposable](../src/state/game/GameClockComposable.ts) | Actual elapsed time, timeout and independent Manual/Menu pause owners |
| [GameStatusComposable](../src/state/game/GameStatusComposable.ts) | Actual versus selected side, result and action permissions; Analysis-owned pause currently identifies exploration |
| [MoveHistoryService](../src/domain/MoveHistoryService.ts) | Existing live/analysis nodes and paths; full descendant pruning currently removes an active branch |
| [GameWorkspaceComposable](../src/state/game/GameWorkspaceComposable.ts) | Data hydration and reconstruction of old paused-analysis state |
| [GameView](../src/views/GameView.vue) | Existing explicit Analyse/Exit events, selected board, actual labels/clocks and owned PV playback |

Keep actual-turn execution separate from selected-board input. The existing shared local/engine settlement remains the current-turn owner; replacing it with the future premove queue is outside this prerequisite.

## Unit tests first — mandatory order

1. Write/update the unit specifications below against existing public actions and data fixtures. Use real board rules, history and time calculations where their correctness is under test; control only external engine/provider and platform effects.
2. Run the new specifications against the unchanged implementation and record the meaningful assertion failures. Keep cases independent so a failure on entry does not hide all background-progression failures.
3. Only after that failing run, make the smallest production changes that satisfy the specifications. Do not weaken expected results to match the current frozen-analysis behaviour.
4. Rerun the focused tests, then the affected existing suites. Change obsolete Analysis-pause expectations, preserving genuine Manual/Menu, cancellation, timeout and UCI ownership regressions.
5. Add/adapt browser acceptance after unit behaviour is passing, then run the code audit and build. Do not use browser-only coverage as a substitute for the data/state tests.

Use explicit engine-result barriers/captured provider callbacks and fake timestamps, not random waits. Drive multiple background turns with controlled results so a test cannot accidentally create an unbounded engine loop. Dispose/cancel every pending game/provider at teardown. Assert game data and observable service effects rather than reproducing private implementation helpers in test code.

## Required unit specifications

| ID | Initial data/actions | Required assertion |
| --- | --- | --- |
| ANL-U01 | Timed live game; explicitly enter and exit Analyse | Same running clock snapshot/elapsed basis, no added Analysis pause and no pause/resume service call caused by either action |
| ANL-U02 | Enter at latest live node; do not play an exploratory move; deliver actual engine reply | Actual path/board advances, selected path/board remains at entry node even though their original path values were equal |
| ANL-U03 | Select a historical canonical move, then explicitly enter Analyse | Anchor that selected node, rather than latest live or any display projection; selection alone does not grant analysis input |
| ANL-U04 | Two controlled engine seats, or controlled successive actual-turn submissions; keep analysis open | Multiple actual turns and successor engine starts complete while selected board stays fixed; exactly one delivery/commit per turn |
| ANL-U05 | Play legal exploratory moves while an actual reply completes | Analysis moves update only selected branch; actual moves update only live branch; both positions remain legal and independently addressable |
| ANL-U06 | Background actual move starts from the parent of the currently selected exploratory branch | Selected nodes/path stay valid through append; release/exit cleanup removes only eligible temporary nodes and retains actual mainline/unrelated history |
| ANL-U07 | Ordinary history review with an actual turn in flight | Actual reply and subsequent eligible engine turn proceed without returning to live; selected historical node/position stays unchanged |
| ANL-U08 | Manual, Menu and layered pauses while analysing; finish an engine result | No actual commit/increment while a real owner remains. Removing final owner resumes through existing actual-turn flow without requiring Exit analysis or another search |
| ANL-U09 | Actual local turn waits while analysis is shown; advance time through expiry | Actual remaining time decreases and timeout settles once; exploratory input cannot rescue the actual turn or restart play after result |
| ANL-U10 | Takeback during analysis, including selected branch removed by rewind | Takeback uses actual live node and existing move-count policy, drains old actual work and relocates any removed selected path safely; no automatic Analysis pause |
| ANL-U11 | Exit while engine readiness/result is pending, then deliver; also deliver before exit | No duplicate actual search, replay, clock transition or actual commit; exit returns to latest live, independently of delivery order |
| ANL-U12 | Actual reassignment/result/root replacement cancels work while analysing; release old success/error | Old delivery cannot mutate replacement actual ownership or selection; existing abort/drain and independent-game isolation remain intact |
| ANL-U13 | Insert old paused live-analysis record, then Resume while analysis remains selected | Preserve saved paused clock until explicit Resume, then remove obsolete synthetic Analysis pause without requiring Exit; never silently auto-start on load |
| ANL-U14 | Selected analysis output differs from actual parent output during a background actual move | Actual recorded analysis never copies unrelated selected-position evaluation; analysis engine requests continue to use canonical selected position |
| ANL-U15 | Hotseat handoff and explicit analysis entry/exit; stale previous-side gesture | Current side owns normal local input; no previous-side off-turn permission is created by analysis. No premove support is introduced |

Use focused composable/service tests for cache/pruning details and store-level unit/integration tests for complete data transitions. Extend [GamePosition tests](../src/state/game/__tests__/GamePositionComposable.spec.ts), [GamesStore tests](../src/state/__tests__/GamesStore.spec.ts), [MoveHistory tests](../src/domain/__tests__/MoveHistoryService.spec.ts) and mounted [GameView tests](../src/views/__tests__/GameView.spec.ts) where their existing seams are sufficient. Keep fixtures/builders shared only when they describe a real repeated game state, not a parallel test implementation of the turn driver.

## Implementation after the failing unit run

| Step | Smallest intended change | Completion gate |
| --- | --- | --- |
| ANL-01 | Add the unit cases and run them before production edits | Record failing assertions showing the current automatic pause, selected/live aliasing and successor-turn gate |
| ANL-02 | Separate explicit analysis selection from real pause ownership and history review using existing game data/actions | Analyse anchors the current selected canonical move without clock mutation; selection alone is not analysis entry |
| ANL-03 | Make actual-turn readiness depend on actual position/result/real pauses rather than rendered/live equality | Controlled successive actual turns continue behind stable analysis/review, with one existing current-turn owner |
| ANL-04 | Correct equal-path position aliasing and active-branch pruning/cleanup | Selected canonical position remains independent before and after exploratory moves; actual history/selection remains valid |
| ANL-05 | Update Takeback, timeout, reassignment and old paused-state hydration readers of Analysis-owned pause | Actual invalidation/clock ownership remains correct; saved paused timing remains explicit until Resume |
| ANL-06 | Wire existing GameView Analyse/Exit/review controls and PV playback to the passing data transitions | Actual clocks/side/result remain distinct from selected board; context replacement settles unfinished playback/input |
| ANL-07 | Update browser fixtures/expectations and architecture documentation, run final verification | Relevant tests/build/audit pass; implementation evidence is recorded separately from future premove acceptance |

Do not add orchestration watchers, invalidation counters or speculative state to solve selection. Preserve existing abort/drain/provider ownership; a genuine Manual/Menu pause remains a real pause. Keep code compact with meaningful small helpers and the repository's global styling boundary.

The active analysis branch needs temporary ownership protection during background appends. Prefer targeted cleanup when selection releases it over a new persistent history feature; preserve the [accepted exploratory recording scope](questions/analysis/Q-ANALYSIS-002-VariationRetention.md). Equal path values do not imply that explicit analysis follows actual play.

## Verification and evidence

Existing baseline inspected on 21 October: four selected store tests passed, but assert current paused-analysis/path behaviour; browser JRN-RACE-02 also expects frozen analysis and was inspected rather than rerun. This is baseline evidence, not completion of this plan.

Tests-first gate completed before any production edit on 21 October: the real-rule/data-driven `BackgroundAnalysis.spec.ts` plus focused position/history suites ran **15 failed / 22 passed** across 37 cases. Failures independently expose automatic clock pause, equal-path board aliasing, successor-turn gating in analysis/review, active-branch pruning, genuine pause recovery, timeout and legacy pause ownership. Two mounted GameView input-boundary cases then failed before UI changes. The initial harness's fake-Date inheritance mismatch was corrected by passing explicit timestamps through the existing APIs before recording this behaviour baseline; its earlier startup run is not the red evidence.

Commands: portable Node running `vitest run src/state/__tests__/BackgroundAnalysis.spec.ts src/state/game/__tests__/GamePositionComposable.spec.ts src/domain/__tests__/MoveHistoryService.spec.ts --maxWorkers=1 --pool=threads --testTimeout=90000 --reporter=dot`, followed by `vitest run src/views/__tests__/GameView.spec.ts --maxWorkers=1 --pool=threads --testTimeout=90000 -t 'renders history review as read-only|replaces the board input owner when entering analysis'`.

Record the new failing unit command/results before production changes, then passing focused results and affected regressions. Run `npm run check:code`, appropriate unit suites, `npm run build` and focused browser analysis/history/clock/engine-race cases after implementation. Retain Manual/Menu race coverage; replace Analysis-freeze expectations intentionally. Use portable tools from AGENTS.md and report executed platforms; browser tests do not establish native NW.js acceptance.

Update [state model](HighLevel/state_model.md), [scenarios](HighLevel/scenarios.md), [GamesStore architecture](LowLevel/Architecture/StateManagement/GamesStore.md), [engine runtime](HighLevel/engine_runtime.md), [analysis decision](questions/play/Q-PLAY-001-LiveProgressDuringAnalysis.md) and relevant journey review records with implemented behaviour. Do not relabel historical paused-analysis test results as background acceptance.

## Definition of done

Tests were written and observed failing before production development. Actual clocks and successive actual turns continue during explicitly selected analysis/history review; canonical selected positions, real pause ownership, temporary branch lifetime, invalidation and saved paused states remain correct. Relevant unit/browser/build checks pass. Only then start the separate premove implementation.
