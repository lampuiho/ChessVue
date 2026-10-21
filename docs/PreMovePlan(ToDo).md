# Premove and player-turn flow plan

Updated on 21 October 2026 after the user's nine conflict decisions and request to split analysis into a prerequisite. **Status: waiting for the separate [background analysis plan](BackgroundAnalysisPlan.md); premove implementation has not started.** Complete that plan first, including its unit-tests-first gate. The [decision/scenario record](questions/play/Q-PLAY-002-PremoveAnalysisConflicts.md) retains the resolved product choices. Follow [AGENTS.md](../AGENTS.md) and the [code cleanup plan](CodeCleanupPlan.md).

## Prerequisite and tests-first order

The [background analysis plan](BackgroundAnalysisPlan.md) owns changing analysis clocks, selected-position isolation, actual background-turn scheduling, active-branch pruning, analysis controls and old paused-state compatibility. Implement and verify it independently before starting this plan. This plan consumes those existing data-driven APIs; it does not develop that prerequisite alongside the queue.

After the prerequisite passes, write premove unit tests against game data and existing store actions **before changing production code**. Observe meaningful failures for opponent-turn append, due-turn validation, whole-queue clearing, hotseat exclusion and derived board/red-square projection. Only then implement the queue and presentation, rerun focused unit tests and add browser acceptance. Do not use the prerequisite's passing analysis tests as premove acceptance.

## Outcome and settled behaviour

A human playing an engine can prepare an ordered sequence during the engine's turn. The board shows that human's pieces after applying the sequence, with every pending source/destination shaded red. Each actual local turn validates and executes one queued move. Analysis and history review do not stop the actual clock, premoves or successive engine turns.

For `g1-f3`, then `f3-g5`, display the knight on `g5`, leave `g1`/`f3` empty and shade all three squares red. The canonical rendered position stays unchanged. Queued moves are not history; only actual commits create move nodes, clock transitions and recorded analysis.

| Decision | Required behaviour |
| --- | --- |
| Canonical rendering | Keep `renderedPosition` as the selected board without premoves. Derive displayed pieces by applying the queue to a copy; analysis still uses the canonical rendered position |
| Analysis timing | Actual clocks and live play continue in the background. Entering Analyse does not add a pause or freeze the queue |
| Analysis entry | Use an explicit Analyse button on the currently selected canonical move. Merely selecting history or entering another board move does not implicitly start analysis |
| History review | Keep executing valid queued moves and engine turns while the user reviews another node. Do not suspend execution waiting for return or queue editing |
| Hotseat/local versus local | No premoves. Once one side moves, input belongs to the other side, as on a physical chessboard. A previous side has no off-turn premove/analysis entitlement |
| Takeback | Always applies to the actual live game, including while analysis is shown. History navigation remains selection, not Takeback |
| Opponent-turn input | Every eligible human move during the engine opponent's turn appends to the queue, unless explicitly in analysis. No Play now/replace/append choice for the same action |
| Navigation | Keep the queue for an in-memory game across temporary menu/game-tab navigation. Existing real Manual/Menu pauses still apply; close/disposal cancels the queue |
| Invalid queue | If a queued sequence is no longer valid, clear the whole queue. No retained invalid suffix, skipped entry, history entry or automatic revival |

Analysis preserves queue ownership, not a frozen snapshot of its entries. Actual play may consume or cancel entries while analysis is open. On exit, display only the remaining valid queue over the latest live board; never replay the entry-time sequence.

## Current implementation and test gaps

| Source boundary | Current behaviour | Planned change |
| --- | --- | --- |
| [Game runtime](../src/contracts/Game.ts) | Three pending-turn fields and one `deferredPlayerMove` slot | One current-turn owner and a runtime queue; no speculative future-turn promises |
| [Player turn](../src/state/game/GamePlayerTurnComposable.ts) | Existing shared local/engine current-turn delivery; prerequisite removes selected-board arming gate | Add ordered future local input while preserving one actual-turn owner and the verified background API |
| [Game view](../src/views/GameView.vue) | Prerequisite distinguishes explicit analysis/review; no premove drawing/input exists | Enable own-piece off-turn queue gestures and derive displaced pieces/red squares |
| [Engine runtime](../src/domain/EngineRuntimeService.ts) | Validates actual/ponder moves at the searched position | Preserve legality/protocol ownership and bind result delivery to the captured actual turn |
| Pause/recovery | Prerequisite owns real pause/old saved-analysis compatibility | Retain the new queue across genuine pauses without another pause policy |

The old note's pending-promise equality guard was already removed by the cleanup. Do not reintroduce it. Duplicate-turn prevention, owned cancellation/draining and the queue replace that concern.

The current analysis mismatch and four-test baseline belong to the prerequisite's evidence, not this plan's implementation. No premove flow exists yet to verify hotseat exclusion or queue progression while reviewing. Add queue/capability/gesture tests rather than assuming the model's player types already enforce those permissions.

## Position, queue and input ownership

Keep the existing concepts small:

- `livePosition`/`livePath`: the actual game and its current turn.
- `renderedPosition`/`renderedPath`: the canonical selected live/history/analysis board, without premoves.
- Displayed pieces/red squares: a pure derived result of the rendered board plus the queue when showing the live gameplay board. A small helper returning copied squares and highlight IDs is sufficient; no third persisted game position or separate engine position is needed.
- Runtime queue: one FIFO for the human seat in a human-versus-engine game, bound to the actual continuation and seat. Local-local and engine-engine games have no human premove queue.
- Current turn: captures actual parent node, colour/player, abort controller, completion and provider work before asynchronous startup begins.
- Input/analysis session: owns the selected node, unfinished drag/promotion or playback and the explicit mode. Queue entries outlive component remounts; unfinished gestures do not.

Queue entries contain raw `from`, `to`, optional promotion, expected own piece/colour and dependencies on preceding intentions. Do not store future capture/check/notation metadata as an accepted `IMove`. The eventual opponent replies are unknown; an intention's target is its next actual local turn on the same continuation, not a predicted exact FEN.

Replace `pendingPlayerTurnPromise`, `pendingPlayerTurnHandlePromise`, `pendingPlayerTurnAbortController` and `deferredPlayerMove` together. A single internal `Deferred` may still represent current-turn completion. Accepted paused engine output belongs to that actual turn; it is not an editable local premove or a competing resolver.

Publish runtime queue changes through the existing raw-game rendering boundary without changing persisted `metadata.updatedAt` or the move/autosave count just for preview edits. A computed projection must preserve identity across unrelated evaluation publications so new scores do not cancel an unfinished gesture.

## Input permissions and routing

| Context | Board/gameplay input |
| --- | --- |
| Human versus engine, human turn | Human's normal move enters the current actual turn owner; due queued input is consumed through that same owner |
| Human versus engine, engine turn | Human's own-piece gestures append premoves in order. Click, drag and keyboard use the same rule. Never let human input resolve the engine's current turn |
| Explicit Analyse | Ordinary legal moves/PV prefixes explore the selected canonical position with both colours. They neither append to nor replace the background queue |
| History review without explicit Analyse | Show the selected node for review. Do not infer analysis permission from a `LiveAnalysisFrom*` enum or accidentally submit moves from historical coordinates; offer Analyse on that selected move |
| Local-local/hotseat | Only the actual side due owns live input and can initiate analysis on its current move. No off-turn queue, colour selector or previous-side input after handoff |
| Engine-engine | No manual gameplay/premove input; retain the existing observation/analysis capability |
| Manual/Menu pause | No gameplay commits or new move submission until real pause ownership permits it; existing engine output may finish and be retained |
| Free/post-result analysis or edit | Existing non-live analysis/edit behaviour; no premoves |

An enabled local-colour engine suggestion follows the same gameplay routing as board input: own turn commits, opponent turn appends, explicit analysis explores. An opponent-colour suggestion cannot steal the engine seat; inspect it through Analyse. Keep the existing suggestion-playability preference independent of queue routing.

Bind each gesture to its actual game, input mode, source projection and owner. If a real move or mode change occurs before completion, cancel the unfinished gesture; do not reinterpret its late drop/promotion as a fresh premove. Repeated provider/gesture delivery cannot settle the next actual turn.

## Shared actual-turn driver

One guarded driver per game handles activation, accepted input, real commit completion, genuine resume and recovery. Repeated requests join owned work; serialise wake requests so input arriving as a drain exits is not lost. Use iterative draining rather than recursively committing a queue.

1. Reject disposed, transitioning or ended work and reconcile actual clock expiry.
2. Attach one actual turn owner from the actual live parent/seat before readiness/provider work starts. Neither analysis selection nor another displayed game blocks ownership.
3. If a real Manual/Menu pause prevents execution, retain current ownership/output and return. Analysis, history review and temporary view departure are not execution pauses.
4. On an actual local turn, resolve the queue head against the actual board, or wait for normal current-turn input. During an actual engine turn start its provider once; local off-turn submissions only append.
5. Validate the full speculative projection after relevant actual changes and the next due move's full legality before acceptance. Any invalid queue clears completely.
6. Reconcile timeout at the actual commit timestamp and commit once through the existing clock/history/analysis/autosave path. Keep the turn owner attached through this atomic commit.
7. Settle and retire that owner, remove its consumed queue entry/result, rebuild the remaining queue projection and arm the successor even if the user is still analysing or reviewing. An empty local queue leaves that local turn waiting while its clock runs.

Separate input acknowledgement from internal turn completion. Future input acknowledges queuing immediately. An engine callback submits to its captured owner and returns without waiting for commit/resume; drain provider delivery outside its callback before replacement startup. Immediate `makeMove` callers still observe their commit before advancing playback.

Remove successor scheduling from independent `_finaliseLiveMove`, flush and analysis-exit branches; the driver owns it. Analysis exit only returns selection/input to live and rebuilds the latest remaining display. It is not a resume action, queue replay, bulk commit or second engine search.

Capture the searched position before asynchronous readiness. Cancellation closes acceptance synchronously, aborts/drains the old actual turn/provider and settles it before replacement. Long-lived pondering remains engine-owned and must not block turn retirement; immediate premoves follow existing ponder hit/miss ordering.

Replace the unowned 500 ms failure-retry timeout with one owned cancellable retry. A seat/game change or disposal cancels it; genuine failures remain reported. No generation counters, promise-identity invalidation guards, orchestration watchers, polling loops or automatic reconnect redesign.

## Background analysis and selection

Use the entry/exit, canonical selected-position isolation, actual background progression, Takeback and pause/hydration behaviour delivered by [BackgroundAnalysisPlan](BackgroundAnalysisPlan.md). Those APIs must already have failing-then-passing unit evidence before this plan starts.

Queue integration adds only these requirements: analysis/review must not suspend queue execution; exploratory board/PV moves must not enqueue; actual commits consume entries while the selected board stays fixed; returning to live derives only the current remainder. Premoves never become analysis/history nodes, and branch pruning never owns the queue. A live Takeback/rewrite/reassignment invalidates the whole queue through its existing explicit action boundary.

## Whole-queue validation

Premove creation uses speculative movement, not full current-turn legality for a side that is not due. Use a pure projection/target utility; do not mutate the real `sideToMove` or relax `genLegalMovesForPiece`.

| Piece/case | Queue-time projection | At the actual due turn |
| --- | --- | --- |
| All pieces | Correct geometry, own-piece provenance, no friendly target or opposing king capture | Generate actual legal candidates and match exact raw input |
| Knight/king | Ignore current attacked-square/check restrictions for speculative input | Full king safety |
| Slider | Respect projected blockers | Actual path and king safety |
| Pawn push | Correct direction, empty projected path, starting-rank condition for double push | Actual pawn legality |
| Pawn diagonal | Allow empty/enemy diagonal because a capture/en-passant opportunity may arise | An actual legal capture/en-passant opportunity must exist |
| Castling | Existing right, projected king/rook and clear path; no speculative king-safety claim | All actual castling conditions |
| Promotion | Explicit queen/rook/bishop/knight before appending; project the chosen piece | Match exact promotion and rebuild actual move details |

After each relevant actual commit, rebuild the whole remaining speculative sequence from the new live board. If it can no longer project, **clear the entire queue immediately**. Also clear it if its next due move fails full legality. Do not retain an invalid tail, skip ahead, or let previously removed intentions revive.

Do not confuse speculative feasibility with requiring all future moves to be fully legal now: future opponent replies/checks/en-passant rights are unknown. Full chess legality belongs to each actual due turn. Regenerate detailed move/capture/check/ambiguity/notation from that actual board with the existing utilities.

A successful commit consumes only its own head; background analysis leaves the remainder executing normally. A failed intention clears all remaining entries/red shades without making a partial history node, changing clock ownership or undoing moves already actually played. Show brief cancellation feedback.

## Presentation

- Derive displayed squares by applying the queue to a copy of canonical `renderedPosition` only while displaying live gameplay. Keep canonical rendered input unchanged for analysis, engines, FEN, saves and move validation. During review/explicit analysis show that selected canonical board; return to live reapplies the **current remainder** over the latest live position.
- Move normal piece artwork to its final projected destination and empty its projected origin. No duplicate source piece or marker-only substitute. Selecting the projected destination extends a chain such as `g1-f3-g5`.
- Red-fill the union of every pending `from`/`to`, including empty intermediate squares. Repeated squares use one opacity. Actual execution, Undo last and Clear rebuild the copied squares and red union; no in-place reversal of speculative captures.
- Speculative capture hides the displayed target without changing actual captured-piece totals. Promotion displays the chosen kind; castling moves both king and rook. Recommended castling shading includes all four relocated squares.
- When any remaining intention becomes invalid, clear the complete displayed sequence/red union. Do not display a valid prefix with an unavailable tail or resurrect a captured source.
- Use a compact queue count/list and Undo last/Clear at the live board. No local-local colour selector or two-colour queue. Review/analysis may show read-only remaining-count/progression/cancellation status; inability to edit there must never suspend actual queued play.
- Make explicit Analyse available on the selected canonical move. Analysis board/PV input stays independent; history navigation by itself remains review. Takeback remains clearly labelled as actual-game rewind.
- Preserve actual clock/side/result/check/capture labels. Red fill takes precedence over actual-last-move background; retain distinct last-move outline, selection/focus and readable piece/coordinate layers. Never evaluate checkmate on the displaced display.
- Escape cancels unfinished input/promotion first; in live premove context it can clear the queue. In analysis/review it must not silently clear background intentions. Provide explicit touch-accessible controls and accessible coordinate/status text.
- Dispose unfinished gestures/playback on context changes and keep completed queue ownership per game across remounts. Real clock pauses still block execution; review/analysis/tab selection do not create extra pauses.

Own board/queue styles in [board.css](../src/assets/styles/board.css) and shared control variants in their existing global owner. Use global CSS only, no scope escapes or inline presentation declarations. Keep derived projection computed and effects in explicit actions/lifecycle hooks; reuse only the documented narrow external-prop input-reset observer boundary.

## Boundary matrix

| Boundary | Queue and actual execution |
| --- | --- |
| Analyse entry, analysis moves, history review, return/exit | Queue remains game-owned and executes in the background. These actions affect selection/input, not the actual clock |
| Temporary menu/game-tab navigation | Preserve the same in-memory queue. Continue actual execution unless an existing Manual/Menu pause really applies |
| Manual/Menu pause or final real Resume | Retain queue/accepted output while paused; final real resume re-enters the same actual driver once |
| Queue invalidation | Clear every remaining intention, not a suffix. Already played history remains |
| Actual Takeback, confirmed history rewrite, changed seat, setup/root replacement | Close old input, cancel queue, abort/drain actual turn, then change canonical ownership. No-op/cancelled actions preserve it |
| Result/timeout/resignation/draw/abandonment | Clear queue, settle actual work, stop live arming. Analysis remains review-only; exit cannot revive play |
| Explicit tab close or game/store disposal | Clear that game's queue and settle owned work; other games remain independent |
| Save/export | Persist canonical selected/live workspace; omit all queue/display/turn runtime |
| Load/restore | Empty queue and rebuilt actual ownership. Legacy saved pause remains explicit until Resume |

Queue edits never pause running clocks or change actual history. Use actual commit timestamps and existing elapsed/increment policy, with no artificial premove delay or zero-time exemption. A timeout wins over an uncommitted queue head.

## Implementation sequence

| Step | Work | Completion gate |
| --- | --- | --- |
| PRE-00 | Complete and verify the separate background analysis plan | Its tests were written/failed before implementation and now pass; actual clocks/turns and selected boards have an independent verified contract |
| PRE-01 | Write queue/capability/projection unit tests against existing data/actions, then run them before premove production edits | Record meaningful failing assertions for append, interleaving, full-clear, hotseat exclusion and red-square/piece projection |
| PRE-02 | Introduce one actual-turn owner/queue and serial driver in Game runtime, PlayerTurn and GamesStore; preserve immediate input completion | One current owner/provider, owned cancellation/retry, no future-turn promises |
| PRE-03 | Integrate queue consumption/cancellation with the verified actual-turn, analysis and invalidation actions | Multiple queued local/engine turns progress behind the stable selected board; no new analysis, pause, cache or pruning redesign |
| PRE-04 | Add raw opponent-turn enqueue, whole-queue projection/clear and due-turn legal resolution | Every accepted off-turn local move appends; any invalid sequence clears completely |
| PRE-05 | Add derived displaced-piece/red-square rendering, queue controls, current-move Analyse and explicit context cleanup | All gestures/labels agree in both orientations; hotseat has no queue; analysis return shows only current remainder |
| PRE-06 | Implement the linked scenario matrix, focused browser/platform regression and architecture/product updates | Executed evidence covers the new background contract and existing real pauses; documentation matches behaviour |

Keep functions focused and normally under 35 lines. Follow UK spelling, interface naming, TypeScript semicolons, inferred implementation returns and the audited async/style boundaries. `OperationOwner.run` supersedes work; do not use it as an append queue.

## Verification and acceptance

Use real chess-rule utilities for legality/projection integration; mocked store tests alone cannot establish that queue moves are legal. Use held providers/fake time for race ordering, clocks and cleanup rather than incidental delays.

| Case | Required evidence |
| --- | --- |
| PRE-A01: sequence | Multiple local premoves execute one per actual local turn, interleaved with successive engine searches, including while analysis/review is displayed |
| PRE-A02: permissions | Human-engine own-turn versus off-turn versus explicit analysis; hotseat handoff and engine-engine reject all premove starts across click/drag/keyboard/PV |
| PRE-A03: whole clear | Invalid head or unprojectable later dependency clears the entire remaining queue/red fill immediately; no retained prefix/tail or speculative history |
| PRE-A04: actual details | Captures changing, check/pin, castling, en passant and all promotions are resolved from the actual due board |
| PRE-A05: real pause | Manual/Menu/layered pauses retain queue/output, commit nothing while owned and resume once without repeated search/increment |
| PRE-A06: background analysis | Analyse adds no pause or clock mutation; actual local/engine turns continue while selected board/evaluations remain anchored, even before the first exploratory move |
| PRE-A07: history and navigation | Review/temporary menu/tab changes do not create queue suspension; actual progress and remaining-count feedback continue under real clock-pause policy |
| PRE-A08: invalidating actions | Actual Takeback, rewrite, changed seat/root, terminal result and disposal drain old work and never restore old intentions on exit |
| PRE-A09: provider/ponder/retry | Immediate and duplicate output, late success/error, cancellation, retry and ponder hit/miss preserve one actual turn and bounded cleanup |
| PRE-A10: clocks/effects | Queue/display changes create no clock transition, increment, recorded analysis or autosave count; actual commits do so once, with timeout reconciliation during analysis |
| PRE-A11: drawing/input | Final displaced pieces/red union, chaining, partial consumption, Undo/Clear, both orientations, accessible labels and context-cancelled promotion/drag agree |
| PRE-A12: isolation/persistence | Canonical rendered/live boards, engine FEN, other games and saves never receive speculative pieces; restore has no queue and honours saved pause |
| PRE-A13: active branch lifetime | Background actual commits cannot remove/reindex the selected analysis branch or re-alias its board. A branch left at a historical anchor stays history through Exit/navigation; pruning remains limited to the existing own-current-move case |

The historical four-test paused-analysis baseline is recorded in [BackgroundAnalysisPlan](BackgroundAnalysisPlan.md); it is not queue evidence. Record this plan's own failing unit run before premove development and its passing run afterwards. No new premove acceptance is claimed by this planning document.

During implementation run `npm run check:code`, affected unit/integration tests, `npm run build` and the focused browser scenarios. Preserve Manual/Menu pause, UCI pondering, cancellation and independent analysis-seat regressions; replace obsolete Analysis-freeze expectations. Record exact executed counts, platforms and failures; browser evidence is not native NW.js acceptance.

Update [GamesStore architecture](LowLevel/Architecture/StateManagement/GamesStore.md), [Game runtime](LowLevel/Architecture/DataInterface/Game.md), [Chessboard](LowLevel/Architecture/Presentation/Components/Chessboard.md), [state model](HighLevel/state_model.md), [engine runtime](HighLevel/engine_runtime.md), [scenarios](HighLevel/scenarios.md) and [persistence](HighLevel/persistence_contract.md) when implementation changes. Add the new flow to the [journey plan](JourneyTestPlan.md) without relabelling old execution evidence. [Q-PLAY-001](questions/play/Q-PLAY-001-LiveProgressDuringAnalysis.md) now records the resolved background policy.

## Definition of done

Canonical rendered positions exclude premoves; derived pieces show the queued destinations and red source/destination squares. Human-engine opponent-turn input appends, hotseat cannot premove, actual play continues during analysis/review, Takeback affects live play and any invalid sequence clears the whole queue. Return displays only the surviving remainder. Ownership, active analysis selection, clocks, engines and persistence have passing evidence against these clarified requirements.
