# Premove and player-turn flow plan

Replanned and approved on 23 October 2026 after reversing the rejected turn-resolution rewrite. **Status: implemented through the existing turn request and resolver.** Queue entries retain existing `IMoveRaw` references. The separately delivered [background analysis prerequisite](ArchivedPlans/BackgroundAnalysisPlan.md#implementation-and-verification) remains the baseline. Carry forward the [resolved decisions](questions/play/Q-PLAY-002-PremoveAnalysisConflicts.md), [AGENTS.md](../AGENTS.md) and [code cleanup rules](ArchivedPlans/CodeCleanupPlan.md). Current execution evidence is recorded under [implementation verification](#implementation-verification---23-october-2026); historical baselines below describe earlier revisions.

All [14 premove function flows](#function-flow), [25 premove scenarios](#concrete-scenarios-for-unit-tests) and the [data-driven test specification](#data-driven-unit-test-specification) are retained. [PRE-RAW](#pre-raw---raw-move-submission-refactor) records the completed submission refactor and ten prerequisite scenarios. Earlier passing premove implementation results concern the reverted code, not this design. The current request authorises rollback and replanning only.

Review correction on 23 October: the earlier arrows and responsibilities were too vague to assess the implementation. Each PRE-F flow now lists concrete calls, arguments, work, branches, mutation and await/return behaviour, following the low-level process-flow documents. Proposed functions/props/dependencies are identified separately from existing source. Each PRE-S row names its decisive calls rather than only referring to flow numbers. This update changes documentation only.

Append ownership correction: trust each producer's contract. Board/PV input offers possible premoves, `makeMove` classifies their current game context, and `_appendPremove` appends the supplied move reference and updates reactive data. It performs no copying, projection, chess-rule, seat or existing-queue checks. Checks after actual play changes the board remain necessary because the opponent can invalidate a previously possible intention.

The same rule now applies to every flow: drawing trusts accepted queue data; the actual-turn helper trusts the existing request and post-commit revalidation; cancellation trusts the board's input eligibility. Each changing fact has one owner below. No new invariant checks, cloned-owner rejection, malformed-data fallback or repeated mode/seat checks are added to consumers.

Copying correction: produced move coordinates/promotion are stable; pass and retain those objects by reference through events, confirmation, playback and FIFO. No destructuring/rebuilding, sanitising `.map`, repeated prefix copies or cloned queue-value snapshots. Detached board state is required where simulation would otherwise mutate canonical data: one board per projection or revalidation pass, never one per entry. Constructing actual move details or a temporary application candidate supplies new facts rather than copying a transport payload. See the explicit [copy and reference audit](#copy-and-reference-audit).

## Turn mechanism retained

The user's correction is explicit: premoves use the same turn-taking and resolving mechanism; shift the queue on a turn request and immediately make that move through the existing API. Keep `pendingPlayerTurnPromise`, `pendingPlayerTurnHandlePromise`, `pendingPlayerTurnAbortController` and `deferredPlayerMove`. Keep `_playerMoveHandler`, `attemptPlayerMove`, `_clearPendingPlayerTurn`, `flushDeferredPlayerMove`, retry timing, engine readiness/delivery/pondering and their completion semantics.

The sole turn-dispatch addition is a local branch after `_requestPlayerMove` registers its existing Deferred/handler/controller. A small private `_tryPremove(game)` trusts that request and the revalidated FIFO, resolves only its head's actual legality, shifts once and immediately calls existing `attemptPlayerMove(game, detailedMove)`. It never calls `commitLiveMove` itself. The existing handler commits or holds accepted output during a genuine pause. `_finaliseLiveMove` continues requesting the successor; final real Resume continues flushing held output and requesting a turn.

Do not add `IPlayerTurn`, a claimed-head field, a drain loop, another scheduler, delivery acknowledgements, provider-draining completion, action lanes or a replacement turn/disposal API. Do not restructure dependencies or consolidate engine stopping as part of this feature. The separate dependency-restructuring document is independent work.

`GamesStore.makeMove(IMoveRaw)` remains the board/analysis/history intake API. `attemptPlayerMove(IMove)` is the existing actual-turn resolution API used by ordinary live input and engine delivery. A background premove uses the latter after resolving its raw head on `getLivePosition`; calling the selected-board `makeMove` would wrongly explore or rewrite the board being reviewed. No temporary selection/mode changes are permitted.

## Prerequisite and tests-first order

The [background analysis plan](ArchivedPlans/BackgroundAnalysisPlan.md) has delivered analysis clocks, selected-position isolation, actual background-turn scheduling, active-branch pruning, analysis controls and old paused-state compatibility. This plan consumes those verified actions. Explicit analysis moves/history also remain permitted during genuine pauses, while actual commits stay paused, as confirmed in [Q-PLAY-003](questions/play/Q-PLAY-003-PausedAnalysisEntry.md).

After the prerequisite passes, write premove unit tests against game data and existing store actions **before changing production code**. Observe meaningful failures for opponent-turn append, due-turn validation, whole-queue clearing, hotseat exclusion and derived board/red-square projection. Only then implement the queue and presentation, rerun focused unit tests and add browser acceptance. Do not use the prerequisite's passing analysis tests as premove acceptance.

The **board-interaction `IMoveRaw` refactor** in [CodexFollowUp](CodexFollowUp.md#raw-move-submission) is the separately approved and completed **PRE-RAW** prerequisite. Board/PV/modal submission, view confirmation/playback and the store now use raw input; canonical acceptance enriches for history/commit. Its [tests-first verification](ArchivedPlans/RawMoveSubmissionDesign.md#implementation-and-verification) is independent of the raw FIFO migration and scenario baseline now recorded below. The completed sequence is **PRE-RAW tests fail -> raw-submission refactor passes -> raw queue data migration -> premove behaviour tests fail -> premove implementation**.

## PRE-RAW - Raw move submission refactor

The separate [Raw move submission API design](ArchivedPlans/RawMoveSubmissionDesign.md) defines the complete before/after signatures, [per-boundary full-move justifications](ArchivedPlans/RawMoveSubmissionDesign.md#type-retention-audit-and-justification), copying/validation boundary, five function flows, promise/error semantics and implementation migration. It is the API reference for PRE-RAW; this section retains its dependency and test matrix within the premove plan.

**Status: complete after explicit approval, tests-first implementation and verification on 22 October 2026.** Source: [CodexFollowUp](CodexFollowUp.md#raw-move-submission). This covers existing legal gameplay, analysis and historical continuation; speculative targets, queue execution and displaced rendering remain pending. Preserve every previously agreed mode/pause/history policy.

### Existing flow and target boundary

Pre-refactor board flow was `genLegalMovesForPiece -> raw target/promotion choice -> Chessboard._emitMove -> toDetailedMove -> moveAttempted(IMove) -> GameView -> GamesStore.makeMove(IMove)`. The old view additionally enriched suggested moves during prefix preview and retained those detailed objects for playback. Move-tree storage and accepted commits retain full moves for notation/history consumers. Board application only reads candidate facts; its parameters use existing `IMoveCandidate`, with no rule-behaviour change. The API audit also narrows raw PV/modal submission and ponder/protocol inputs where no detailed consumer exists.

Target submission flow:

```text
legal target IMoveRaw
  -> finish an explicit promotion choice if required
  -> Chessboard.moveAttempted(IMoveRaw)
  -> captured GameView input / raw continuation / raw playback
  -> GamesStore.makeMove(IMoveRaw)
  -> GameMoveComposable: classify mode and select canonical source
  -> match legal raw candidate; toDetailedMove(canonical source, candidate)
  -> existing actual-turn or analysis/history commit route using IMove
  -> MoveHistoryService/recording retain full facts; MoveApplicationService requires candidate facts
```

When premoves are subsequently implemented, add one branch **before canonical enrichment and the view's canonical-prefix preflight**: possible off-turn input supplied by the board/PV producer goes raw to the store and appends to `IMoveRaw[]`. Intake trusts that producer and does not project or recheck the move. Resolve actual details later through PRE-F07. No speculative detailed move crosses into the actual commit path.

| Existing owner | Planned refactor |
| --- | --- |
| `Chessboard.legalMoves`, selection and drag | Continue using existing legal raw candidates. Keep move-list types explicit where needed for inference. Do not add premove candidate rules in PRE-RAW |
| `_commitTarget`, pending promotion and `_choosePromotion` | A completed choice selects a raw candidate with exact `promotionPiece`; no emission while incomplete. Cancel or source/mode replacement discards the attempt; an old choice cannot complete a new chooser |
| `Chessboard._emitMove` / `moveAttempted` | Emit `IMoveRaw` directly. Remove board-side `toDetailedMove` and its import. `lastMove?: IMove` remains because the legal query consumes historical moving colour/check state; highlighting alone would not justify it |
| `GameView.inputActions.move`, `_makeMove`, `_requestMoves` | Accept raw payloads through the existing captured input owner; no conversion back to a detailed payload for transport |
| Captured `IContinuation`, `_confirmContinuation(pending, signal)` | Keep raw move data with the selected game/node owner in the mounted confirmation callback. Abort/context checks precede canonical acceptance. Cancelled/stale confirmation changes neither actual play nor queue |
| `AnalysisPanel.moveSelected`, `_playAnalysisLine`, `_applyMoves` | Existing event/adapters use `readonly IMoveRaw[]`; detailed PV entries already satisfy that type. Select the clicked prefix once with entry references, then forward/retain that prefix without raw-field `.map` or another array copy. Full-prefix canonical preview still needs one detached board before first commit. Temporary actual/preview detail construction is semantic enrichment, not payload cloning |
| `GamesStore.makeMove`, `GameMoveComposable.makeMove` | Keep the existing action names, widen input to `IMoveRaw`, select the correct canonical board, reject stale/illegal raw moves and generate actual details immediately before the existing commit routes. No `IMove | IMoveRaw` union, raw-to-detailed cast or new public conversion wrapper |
| Actual turn, history and engine-result delivery | Retain `IMove` for accepted transition facts consumed by clock/history/SAN and existing result schemas. The [audit](ArchivedPlans/RawMoveSubmissionDesign.md#full-move-contracts-retained) gives each API's reader or downstream sink; forwarding alone is not a full-type requirement |
| Existing application and protocol inputs | Application/rule replay and its engine validation helpers require existing `IMoveCandidate`; ponder command/expected-reply inputs require only `IMoveRaw`. Keep names, algorithms, engine commands and lifecycle; no full fields are needed by these consumers |
| Mounted `PromotionModal` chooser | Returns its offered raw candidate through `Chessboard._choosePromotion -> _emitMove -> GameView`; no game/store dependency or conversion inside the modal. Keep saved game schemas unchanged |

An `IMove` is structurally compatible with `IMoveRaw`, so existing detailed callers can migrate incrementally without a duplicate union. Their supplied kind/colour/capture/check/notation/runtime fields must not become commit authority: resolve from the canonical board and matching legal candidate. Keep conversion at this explicit acceptance boundary; preview-only enrichment is allowed for existing look-ahead, never used as the committed payload.

### PRE-RAW tests before implementation

Use ordinary legal boards and existing actual/analysis routes; do not require premove generation or simulate a queue to make this prerequisite pass. Write/adjust the following assertions first and record the meaningful failures. Existing board enrichment and view submission of detailed payloads provide observable failures; missing imports/types alone do not establish a red baseline.

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| RAW-S01 | Quiet legal click, drag and keyboard activation, both colours/orientations | Board emits only raw coordinate/promotion data. No board-side detailed enrichment; current legal target behaviour remains |
| RAW-S02 | Quiet/capture promotion to Q/R/B/N, both colours; existing modal handler variant | Nothing emits before a choice. Board/modal submits exact raw promotion; Cancel emits nothing. Source/mode replacement and a detached old choice cannot submit into a new chooser |
| RAW-S03 | Raw board event enters the mounted GameView | Existing input handler forwards raw data to the existing store action; no fabricated `kind`, moving colour/piece, capture or check fields |
| RAW-S04 | Raw ordinary local move through the real store | Correct canonical detailed history node, clock/increment, recording and successor behaviour once; action completes after its actual commit |
| RAW-S05 | Raw capture, en passant, castling, promotion and ambiguous move | Canonical rule resolution determines all stored details/SAN; forged/stale supplied detail fields cannot override them. Illegal coordinates/source/promotion produce no partial canonical mutation |
| RAW-S06 | Raw explicit/free/post-result analysis, including genuinely paused analysis | Correct selected branch changes, actual game/clock unchanged by exploration, existing Takeback/result restrictions preserved |
| RAW-S07 | Raw ordinary history continuation: cancel, confirm, disabled Takeback and stale confirmation | Existing confirmation policy remains; only valid confirmed continuation rewrites actual play. Cancel/obsolete data has no actual effects |
| RAW-S08 | Detailed PV display chosen for due-local play or full-prefix analysis | Panel selects one prefix retaining original move references; view forwards it. Full prefix is preflighted before first commit; illegal suffix produces no partial commit. This reference policy supersedes earlier copied-payload assertions, while actual acceptance still derives canonical details |
| RAW-S09 | Delayed raw playback/gesture/promotion followed by mode, game, path, permission or result replacement | Existing owner rejects obsolete callbacks/suffixes; unrelated evaluation of the same selected position preserves valid unfinished input |
| RAW-S10 | Existing engine reply, paused output, save/load and hotseat handoff regressions | Detailed engine-result/history contracts remain intact; candidate application and raw ponder inputs preserve existing behaviour. No premove capability appears yet; no extra turn/provider, changed persistence or previous-side input after handoff |

Test owners are the existing `Chessboard.spec.ts` for raw selection/promotion, `GameView.spec.ts` for transport/confirmation/PV/playback, mounted existing modal/UiState tests for its raw promotion variant, and store/background-analysis tests for canonical acceptance and unchanged actual effects. Use real chess rules for canonical detail resolution; a store stub is appropriate only for the mounted view's payload assertions. Keep raw-case fixtures data-driven and ordinary-move refactor failures separate from not-yet-implemented premove failures.

After PRE-RAW implementation, require these tests and affected existing regressions to pass, with `npm run check:code`, type checks/build and focused real promotion/playback gestures as appropriate. Record the executed scope separately from premove acceptance. Leave the source follow-up item pending until this stage actually passes; the planning link is not completion.

PRE-RAW preserves the existing actual-handler completion when genuine pause races an already-accepted move. This premove plan preserves that same completion contract; there is no subsequent PlayerTurn refactor. See the [API design's completion matrix](ArchivedPlans/RawMoveSubmissionDesign.md#raw-f05---engine-pause-and-completion).

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
| Invalid queue | If actual progression invalidates an accepted dependency or due head, clear the whole FIFO. Input producers offer possible premoves; append does not validate or reject them |
| Queue data | Existing `IMoveRaw[]`; no duplicate entry type, stored expected kind or node anchor |
| Board cancellation | Right-click anywhere on the live board clears all remaining premoves; touch tap on a premoved piece cancels. Keep Escape access; no count/list or premove control buttons |
| chess.com comparison | Board cancellation interaction only; retain the agreed projection, clocks, background play and queue policies |

Analysis preserves queue ownership, not a frozen snapshot of its entries. Actual play may consume or cancel entries while analysis is open. On exit, display only the remaining valid queue over the latest live board; never replay the entry-time sequence.

## Current implementation and test gaps

| Source boundary | Current behaviour | Planned change |
| --- | --- | --- |
| [Game runtime](../src/contracts/Game.ts) | Runtime premove FIFO data contract, three pending-turn fields and one `deferredPlayerMove` slot | Retain these declarations; no new turn object or future-turn promises |
| [Player turn](../src/state/game/GamePlayerTurnComposable.ts) | Existing shared local/engine Deferred and handler; background arming already ignores selected-board equality | Add only the local-turn premove attempt after the existing request is registered, plus queue invalidation at a changed seat |
| [Game view](../src/views/GameView.vue) | Explicit analysis/review are already distinguished; no premove drawing/input exists | Enable own-piece off-turn queue gestures and derive displaced pieces/red squares |
| Raw-submission boundary | PRE-RAW now uses raw board/PV/modal/view/store inputs and canonical enrichment | Completed independently; queue integration must reuse this boundary |
| [Engine runtime](../src/domain/EngineRuntimeService.ts) | Validates actual/ponder moves at the searched position | No changes to readiness, delivery, callback completion or ponder/protocol ownership |
| Pause/recovery | Prerequisite owns real pause/old saved-analysis compatibility | Retain the new queue across genuine pauses without another pause policy |

The old note's pending-promise equality guard was already removed by the cleanup. Do not reintroduce it. Retain existing duplicate-request prevention and abort/handler settlement. Independent turn-hardening tests are recorded separately below; they do not justify replacing this mechanism.

The former analysis mismatch/four-test baseline and the older queue declaration/tests are historical evidence. The scenario tests are being migrated from the superseded entry shape under the 23 October request. No old count establishes execution of this raw/no-buttons revision; the fresh executed baseline is recorded below.

## Position, queue and input ownership

Keep the existing concepts small:

- `livePosition`/`livePath`: the actual game and its current turn.
- `renderedPosition`/`renderedPath`: the canonical selected live/history/analysis board, without premoves.
- Displayed pieces/red squares: a pure derived result of the rendered board plus the queue when showing the live gameplay board. A small helper returning copied squares and highlight IDs is sufficient; no third persisted game position or separate engine position is needed.
- Runtime queue: one FIFO for the human seat in a human-versus-engine game, bound to the actual continuation and seat. Local-local and engine-engine games have no human premove queue.
- Current turn: existing Deferred, handler and abort controller registered before provider startup. `deferredPlayerMove` remains the existing genuinely paused accepted-output slot; none of these fields moves into the FIFO.
- Input/analysis session: owns the selected node, unfinished drag/promotion or playback and the explicit mode. Queue entries outlive component remounts; unfinished gestures do not.

The [data contract](PremoveDataStructure.md) remains `game.$.premoveQueue?: IPremoveQueue`, containing only `player: IPlayer` and `moves: IMoveRaw[]`. Push supplied move objects directly; their coordinates/promotion are stable. Objects may structurally carry PV details or `$`, but consumers read raw fields and actual acceptance generates its own canonical details. No sanitation copy, replacement entry interface or stored expected kind. Current actual live position remains the base, with no node/path/FEN anchor; structural actions invalidate ownership explicitly.

Retain `pendingPlayerTurnPromise`, `pendingPlayerTurnHandlePromise`, `pendingPlayerTurnAbortController` and `deferredPlayerMove` unchanged. The FIFO supplies an immediate answer to an ordinary local turn request. Once shifted/submitted, the move belongs to the existing handler or paused-output slot; it is no longer an editable FIFO entry.

Publish runtime queue changes through the existing raw-game rendering boundary without changing persisted `metadata.updatedAt` or the move/autosave count just for preview edits. A computed projection must preserve identity across unrelated evaluation publications so new scores do not cancel an unfinished gesture.

## Scope and minimum code

- Preserve the completed analysis/history/pause prerequisite and existing named entry points. No new game state, persisted setting, schema version, arbitrary queue cap or timing penalty.
- Use `IMoveRaw` directly at raw-input boundaries; no redundant `IMove | IMoveRaw` union, raw-to-`IMove` cast or copied entry interface. Actual details come from the canonical rule boundary.
- Keep one `IPremoveQueue` with exact seated player and raw FIFO. Do not reintroduce expected piece kind through sidecars, signatures or snapshots.
- Add only `GameRuleUtility.genCandidateMovesForPiece(position, from)` as a generic chess-rule query. Reuse legal/detail/application functions. No premove utility/library, premove-named rule API, new service or public dispatcher.
- Append, projection, due resolution and rebase stay private/in existing app owners. One store Clear action serves board cancellation; no Undo-last action, queue count/list or premove buttons in GameControlPanel.
- Keep existing actual pending/deferred delivery, successor scheduling, final-Resume flush and engine/retry lifecycle. Add only the local premove hook; no new turn owner, scheduler or public turn API.
- Global CSS only; extend the existing Chessboard `onBeforeUpdate` input-reset boundary if necessary. No watcher or async invalidation counter.

## Integration update after IMoveRaw submission and modal changes

Moves now cross board/view/store as `IMoveRaw`; this is the refactor referred to by the user, as clarified on 23 October. Preserve the existing raw-game publication model without changing Vue `markRaw` usage. The agreed product scenarios remain unchanged; submission and the subsequently migrated modal/lifecycle boundaries require these function-flow/test corrections:

| Boundary | Current and planned flow |
| --- | --- |
| Raw intake (PRE-F01/F02/F14) | Keep `Chessboard._emitMove -> GameView.inputActions.move -> _makeMove -> _requestMoves`. Board/PV producers own possible targets and completed promotion. Classify live off-turn context before `_applyMoves` canonical preflight; `makeMove` supplies the seated local player to `_appendPremove`, which only appends/publishes. Own-turn/history/analysis retain existing raw acceptance. No duplicate intake validation |
| Promotion (PRE-F14/S18) | `_commitTarget -> modal.open(PromotionModal, { moves, colour, onSelected: _choosePromotion }) -> _emitMove`. The chooser is outside the board DOM and has its own abort signal. Projected candidates use the human's source colour, not the engine's due colour. Changed input props or board unmount call `_clearSelection`, closing that opening; late detached buttons cannot append/commit. Escape dismisses the chooser first; a later board Escape may clear completed premoves |
| Historical rewrite (PRE-F01/F12/S13) | `_requestMoves` captures `IContinuation { game, node, moves }` in the `ConfirmationModal.confirm(signal)` callback. `_confirmContinuation(pending, signal)` checks abort/current game/node/mode/pause/result/Takeback. Cancel, replacement or `_closeContinuation` aborts that opening and preserves the queue. Only a valid confirmed store rewrite clears it |
| Runtime observation (PRE-F08) | The existing workspace collection owns canonical reactive games. `moves: shallowReactive<IMoveRaw[]>([])` observes push/shift while retaining exact entry references; queue assignment/clear and held-output writes are observable. No publisher, revision prop, watcher or timestamp dependency. `_timestampGame` records metadata only |
| Stable display/input owner (PRE-F03/F14/S18/S22) | Retain queue/container, head, tail and held-local-move references in existing input owner; compare with canonical node/mode/permission before creating another projection. Push/shift/clear changes references, entries are stable. Unchanged context returns previous projection/owner, including score-only publications; no raw snapshot, counter, copied array or cloned entry |
| Board lifecycle (PRE-F03/F09/F14) | `Chessboard.onBeforeUpdate` compares actual canonical/display/input props before rendering the replacement; `_clearSelection` cancels selection, drag and mounted promotion. `onBeforeUnmount` closes unfinished input. No observer exceptions remain. Derived getters neither clear queues nor mount modals |
| Mounted specifications | Use the real `modalPlugin` test owner and query promotion/confirmation through `document.body`, retaining old DOM buttons to prove abort behaviour. Mark game fixtures raw before exposing them through a reactive mock store; mutate nested fixtures only with explicit publication when simulating a completed action. This catches missing publication and referential-owner bugs rather than hiding them with deep reactive test data |

The existing candidate query remains the only new chess-rule API. The only queue action remains `clearPremoves(game)`; neither Undo-last nor a premove control/count is restored. All PRE-F01-PRE-F14 and PRE-S01-PRE-S25 below remain in force.

## Input permissions and routing

| Context | Board/gameplay input |
| --- | --- |
| Human versus engine, human turn | Human's normal move enters the current actual turn owner; due queued input is consumed through that same owner |
| Human versus engine, engine turn | Human's own-piece gestures append premoves in order. Click, drag and keyboard use the same rule. Never let human input resolve the engine's current turn |
| Explicit Analyse | Ordinary legal moves/PV prefixes explore the selected canonical position with both colours. They neither append to nor replace the background queue |
| History review without explicit Analyse | Show the selected node without queue displacement. Preserve the existing confirmed actual-history rewrite when Takeback is allowed; otherwise require Analyse before exploratory input. Review never appends coordinates to the background queue |
| Local-local/hotseat | Only the actual side due owns live input and can initiate analysis on its current move. No off-turn queue, colour selector or previous-side input after handoff |
| Engine-engine | No manual gameplay/premove input; retain the existing observation/analysis capability |
| Manual/Menu pause | No actual commits or new premove submission. Existing engine output may finish and be retained. Explicit paused analysis moves/history remain permitted under Q-PLAY-003 |
| Free/post-result analysis or edit | Existing non-live analysis/edit behaviour; no premoves |

An enabled local-colour engine suggestion follows the same gameplay routing as board input: own turn commits, opponent turn appends, explicit analysis explores. An opponent-colour suggestion cannot steal the engine seat; inspect it through Analyse. Keep the existing suggestion-playability preference independent of queue routing.

Bind each gesture to its actual game, input mode, source projection and owner. If a real move or mode change occurs before completion, cancel the unfinished gesture; do not reinterpret its late drop/promotion as a fresh premove. Gesture delivery cannot settle another seat's turn. Keep engine delivery unchanged; independent hardening findings are recorded below.

## Existing actual-turn flow

```text
requestPlayerMoveIfNeeded
  -> _requestPlayerMove registers Deferred, handler and abort controller
     -> engine: existing _requestEngineMove and delivery callback
     -> local: _tryPremove resolves actual legal head, shifts, calls attemptPlayerMove
  -> attemptPlayerMove resolves the same Deferred and awaits its handler
  -> _playerMoveHandler clears pending fields
     -> paused: existing deferredPlayerMove slot
     -> unpaused: commitLiveMove
        -> _finaliseLiveMove revalidates FIFO, retains its successor request
```

Final real Resume retains `await flushDeferredPlayerMove(game); requestPlayerMoveIfNeeded(game);`. Analysis entry/Exit/history only change selection and do not flush, replay or reschedule the queue. Existing readiness and pending-request guards prevent duplicate requests. Normal local input and engine delivery keep exactly the same API/completion behaviour.

### Narrow implementation boundaries

| Owner | Necessary premove change |
| --- | --- |
| `GamePlayerTurnComposable` | One small private `_tryPremove` and local branch after existing registration; clear queue on a genuinely changed seat. Retain turn registration/resolution/handler/flush/engine/retry functions |
| `GameMoveComposable` | Private `_appendPremove` before canonical enrichment; private `_revalidatePremoves` before existing successor request; queue clearing only at accepted rewrite/Takeback/root changes |
| `GamePositionComposable` / `GameRuleUtility` | Pure copied projection and generic movement candidates. No turn lifecycle responsibilities |
| `GamesStore` | Runtime-only publication callback and the already-planned `clearPremoves` board action; a new scope-disposal callback calls existing cancellation APIs listed in PRE-F13. No dispatcher/driver or dependency restructure |
| Result/timeout/workspace actions | Clear queue at their accepted mutation boundaries; retain existing cancellation, clock, engine-stop and hydration mechanisms |
| `GameView`, `Chessboard`, global `board.css` | Derived displaced pieces/red squares, eligible raw off-turn gestures and whole-queue board cancellation; retain raw input/modal ownership |

No turn runtime/type replacement, engine service changes, clock Resume rewrite, retry redesign or regression-test migration to another owner is needed. If implementation appears to require them, stop that expansion and explain the concrete conflict in the plan.

## Background analysis and selection

Use the entry/exit, canonical selected-position isolation, actual background progression, Takeback and pause/hydration behaviour delivered by [BackgroundAnalysisPlan](ArchivedPlans/BackgroundAnalysisPlan.md). Those APIs must already have failing-then-passing unit evidence before this plan starts.

Queue integration adds only these requirements: analysis/review must not suspend queue execution; exploratory board/PV moves must not enqueue; actual commits consume entries while the selected board stays fixed; returning to live derives only the current remainder. Premoves never become analysis/history nodes, and branch pruning never owns the queue. A live Takeback/rewrite/reassignment invalidates the whole queue through its existing explicit action boundary.

## Whole-queue validation

Premove creation uses speculative movement, not full current-turn legality for a side that is not due. Extend the existing `GameRuleUtility` with piece-movement candidates; do not create a premove utility/library. The rule function reads one board/source and returns raw chess coordinates. Queue/seat ownership, sequence composition and red shading belong to the existing state/presentation owners. Read piece kind from the board rather than an entry field. Do not mutate the real `sideToMove` or relax `genLegalMovesForPiece`.

| Piece/case | Queue-time projection | At the actual due turn |
| --- | --- | --- |
| All pieces | Own-colour projected source, correct geometry, no friendly target or opposing king capture | Generate actual legal candidates and match exact raw input |
| Knight/king | Ignore current attacked-square/check restrictions for speculative input | Full king safety |
| Slider | Respect projected blockers | Actual path and king safety |
| Pawn push | Correct direction, empty projected path, starting-rank condition for double push | Actual pawn legality |
| Pawn diagonal | Allow empty/enemy diagonal because a capture/en-passant opportunity may arise | An actual legal capture/en-passant opportunity must exist |
| Castling | Existing right, projected king/rook and clear path; no speculative king-safety claim | All actual castling conditions |
| Promotion | Explicit queen/rook/bishop/knight before appending; project the chosen piece | Match exact promotion and rebuild actual move details |

After each relevant actual commit, rebuild the whole remaining speculative sequence from the new live board. If it can no longer project, **clear the entire queue immediately**. Also clear it if its next due move fails full legality. Do not retain an invalid tail, skip ahead, or let previously removed intentions revive.

Do not confuse speculative feasibility with requiring all future moves to be fully legal now: future opponent replies/checks/en-passant rights are unknown. Full chess legality belongs to each actual due turn. Regenerate detailed move/capture/check/ambiguity/notation from that actual board with the existing utilities.

A valid local-turn request consumes its head with `shift()` immediately before submitting it through `attemptPlayerMove`. The existing handler owns the accepted move thereafter; it is never shifted again or reinserted. Background analysis leaves the remainder executing normally. A failed intention clears all remaining entries/red shades without making a partial history node, changing clock ownership or undoing moves already actually played. A brief transient invalidation notice is sufficient; do not add a queue counter or control panel.

## Function flow

These proposed call sequences follow [GameplayAndControl](LowLevel/ProcessFlows/GameplayAndControl.md) and [EngineRuntimeOwnership](LowLevel/ProcessFlows/EngineRuntimeOwnership.md). Names, including private underscores, were checked against source. Each row gives the call, its work and its return/branch. **Existing** means retain today's implementation unless an insertion is specified; **new** means proposed code. Computed values and Vue events are labelled separately from functions.

Within each owner, dependency names resolve to these source modules: `position` -> [GamePositionComposable](../src/state/game/GamePositionComposable.ts), `playerTurn` -> [GamePlayerTurnComposable](../src/state/game/GamePlayerTurnComposable.ts), `status` -> [GameStatusComposable](../src/state/game/GameStatusComposable.ts), `clock` -> [GameClockComposable](../src/state/game/GameClockComposable.ts), `analysis` -> [GameAnalysisComposable](../src/state/game/GameAnalysisComposable.ts). The `commitLiveMove`, `timestampGame` and `clearPremoves` injected calls are wired by [GamesStore](../src/state/GamesStore.ts); the canonical commit implementation stays in [GameMoveComposable](../src/state/game/GameMoveComposable.ts). UI callers are [GameView](../src/views/GameView.vue) and [Chessboard](../src/components/Chessboard.vue).

### Planned call boundaries

| Function/boundary | Inputs, result and owner |
| --- | --- |
| Existing `GamesStore.makeMove(game, rawMove)` | Alias of `GameMoveComposable.makeMove`. Raw board/PV/modal intake; no new public move dispatcher |
| New private `GameMoveComposable._appendPremove(game, player, rawMove)` | Initialise FIFO if absent, `moves.push(rawMove)` and update reactive data. Same supplied reference; no copy, checks, projection or turn resolution |
| New private `GameMoveComposable._revalidatePremoves(game)` | Checks whole existing FIFO after actual commit; clears invalid/terminal remainder. Never shifts/submits |
| New private `GamePlayerTurnComposable._tryPremove(game)` | Trust existing local request registration and revalidated queue. Resolve only actual legal head, shift and call `attemptPlayerMove`; no repeated whole-queue/seat/mode/runtime checks |
| New `GameRuleUtility.genCandidateMovesForPiece(position, from)` | Pure `IMoveRaw[]` query for source geometry/occupancy/promotion/castling feasibility, independent of actual side due/check |
| New returned `GamePositionComposable.getPremoveProjection(base, queue?, heldLocalMove?)` | One detached board for the pass. Apply optional held move, then existing queue entries by reference; no temporary combined sequence. Return `{ position, redSquares }` |
| New returned internal `GamePositionComposable.applyPremoveProjection(preview, rawMove, redSquares?)` | Mutate caller-owned preview using a temporary `IMoveCandidate`; optionally collect affected IDs. Shared by drawing/revalidation to avoid another board clone or duplicated application logic. No rule query or validation |
| Private `GamesStore._timestampGame(game)` | Changes only `metadata.updatedAt` at existing action boundaries; queue-only edits do not call it |
| New `GamesStore.clearPremoves(game)` | Removes only that game's FIFO, publishes runtime. Empty is a no-op. Context-independent so structural actions and closing a paused/inactive tab can also call it |
| Existing turn APIs | Keep `requestPlayerMoveIfNeeded`, `_requestPlayerMove`, nested `_requestEngineMove`, nested `_playerMoveHandler`, `attemptPlayerMove`, `flushDeferredPlayerMove` and `clearPlayerTurnRuntime` contracts |

Dependency wiring is part of the proposal: `useGamePlayerTurn` and `useGameMove` receive `clearPremoves`; `useGameStatus`, `useGameClock` and `useGameWorkspace` receive `clearPremoves` for accepted invalidation boundaries. `GamesStore` returns `clearPremoves` for board cancellation/tab close. Existing forwarding callbacks stay. No replacement turn object, scheduler, engine-service change or dependency restructure.

Proposed board inputs: `displayPosition?: IBoardPosition`, `premoveSquares?: ReadonlySet<BoardId>`, `premoveColour?: PlayerColour`. Share the projection's red set directly and use `.has(boardId)`; no set-to-array copy. `Chessboard.position` stays canonical. `displayedPosition` computed chooses `displayPosition ?? position` for artwork/labels. Existing `legalMoves` selects movement candidates only in premove mode, otherwise canonical legal targets. New `premovesCancelled` event has no move payload; these are presentation additions, not turn APIs.

### Contract audit for all 14 flows

| Flow | What its consumer trusts / where a check belongs |
| --- | --- |
| PRE-F01 | Existing context dispatch chooses the route; downstream helpers do not repeat mode/seat or possible-move checks. Retain the completed raw-acceptance API and existing deferred input ownership |
| PRE-F02 | Input produced a stable possible move; append pushes that object reference and updates reactive data |
| PRE-F03 | Input/rebase made the queue projectable; projection only applies/draws it. Remove candidate queries, coordinate/colour checks and invalid-data fallback |
| PRE-F04 | Existing request gate owns readiness/duplicate prevention; the new local helper does not repeat those guards |
| PRE-F05 | Existing engine service owns external output validation; delivery/handler/commit do not add premove checks |
| PRE-F06 | **One whole-queue feasibility pass after an actual board change.** Source/geometry/occupancy may have changed, so check them here before publishing/requesting the successor |
| PRE-F07 | Post-commit pass established sequence feasibility; current Local request established player/runtime ownership. Check only actual head legality, because speculative feasibility does not establish king safety/capture rights |
| PRE-F08 | Caller completed a runtime mutation; observe the actual reactive edit without validating game/queue. Empty clearing is an ordinary idempotent operation |
| PRE-F09 | Board input eligibility owns permission to emit cancellation. View only uses existing input-owner checks across playback cancellation; store clear is unconditional |
| PRE-F10 | Existing analysis/history actions own selection/cache/pause policy. Add no queue checks, replays or resumption on entry/return |
| PRE-F11 | Existing pause reasons and flush own readiness/held output. Do not revalidate a held detailed move: pause changed time, not its board |
| PRE-F12 | Accepted structural action clears FIFO at the actual mutation boundary, after existing awaited cleanup. Consumers then trust seat/root/continuation ownership without equality checks |
| PRE-F13 | Existing session/save/hydration owners supply valid objects and fresh runtime; no queue schema/recovery/clone validator. Scope cleanup calls existing owners |
| PRE-F14 | Input candidate query/promotion chooser owns possible input. Retain existing context cancellation after awaits; do not repeat movement checks in emit/transport/append |

Existing prerequisite guards are not being broadly refactored here. In particular, a callback can become obsolete across an await, elapsed time can expire a turn, and engine output is external; those checks establish facts rather than recheck an unchanged internal contract. No additional guards are introduced around them.

### Copy and reference audit

| Boundary | Reference/allocation rule |
| --- | --- |
| Board event, `_makeMove`, `_requestMoves`, `_appendPremove` | Same `IMoveRaw` object throughout; no destructuring/reconstruction. FIFO owns its array, not a clone of each entry. Caller/consumer never changes move coordinates/promotion |
| AnalysisPanel prefix, confirmation, playback | One prefix selection may create an array of existing move references because its length identifies the clicked range. View/confirmation/playback retain that array; do not `.map` moves into new objects or recopy the same selected range |
| Stable input context | Capture queue/head/tail/held references alongside canonical context. Return previous projection before allocating another when these remain unchanged; no queue-value snapshot, JSON signature or new revision counter |
| Whole-queue revalidation | Clone board/rights once via `genPosition(actual, [])`; apply every validated raw entry in place through `applyPremoveProjection`. No one-entry queue wrappers, per-entry cloning or highlight collection |
| Display projection | One detached board/rights copy for the whole pass; held local reference applied before existing queue iteration. Share result/red set directly with board; no combined move array or set-to-array conversion |
| Castle highlight | Read rook endpoints before applying the castle. No before/after board-array snapshot |
| Canonical accepted details / temporary candidate | New fields are required by the existing history/clock or move-application contract; construct them from canonical/preview facts. Do not clone the raw object merely for forwarding |
| Existing analysis entry / full-prefix preview | Retain necessary detached board state because these operations mutate independently of actual play; no additional premove copy at their downstream calls |

Existing forwarding copies in the completed raw refactor are explicitly superseded by this reference policy for the planned implementation. No shared type, event signature or turn resolver needs to change. Historical test counts below predate this correction.

### PRE-F01 - Classify raw input before submitting it

| Caller and call | Function work and branch/return |
| --- | --- |
| Changed `Chessboard._emitMove(rawMove)` -> Vue `moveAttempted` | `emit('moveAttempted', rawMove)` passes supplied reference, then `_clearSelection`. No enrichment, stripping or reconstruction |
| Existing `GameView.inputActions.move` -> `_makeMove(rawMove)` -> `_requestMoves([rawMove])` | Captured `renderedBoard` remains current. Single-move array contains same reference; remove existing raw-field `.map` in `_requestMoves` |
| Changed `_requestMoves`: off-turn branch -> `await _run(() => gamesStore.makeMove(currentGame, moves[0]))` | Same eligible move reference. Return afterwards; **bypass `_applyMoves`**, whose canonical legality is inappropriate for speculation |
| `_requestMoves`: historical branch -> `modal.open(ConfirmationModal, { confirm: signal => _confirmContinuation(pending, signal), ... })` | Capture game/node and existing `moves` array by reference. No move or prefix copy; return until confirmed |
| `_requestMoves`: other branch -> `await _run(() => _applyMoves(currentGame, moves))` | Forward existing array; retain ordinary due-local/analysis canonical-prefix preflight/playback |
| Existing store alias -> `GameMoveComposable.makeMove(game, rawMove)` -> `status.assertMoveAllowed(game)` | Authoritative mode check; ordinary paused/edit input rejected, explicit paused analysis permitted |
| Changed `makeMove`: ordinary following-live human-engine off-turn context -> `_appendPremove(game, localPlayer, rawMove)` -> return | Existing action routing selects the seated local player. Pass it with the producer's possible raw move before `_resolveMove`; the append helper trusts both |
| Existing other allowed input -> `_resolveMove(parentPosition, rawMove, parentNode.move)` | `getRenderedNode/getRenderedPosition` supply canonical selected source; match legal candidate/exact promotion, build fresh details |
| Existing resolved branch calls | Non-live -> `_commitStandaloneAnalysisMove`; explicit live analysis -> `_commitLiveAnalysisMove`; allowed history -> `await _commitHistoryRewriteMove`; ordinary local live -> `await playerTurn.attemptPlayerMove`; forbidden seat/history throws |

Non-live/explicit analysis has priority over off-turn intake. Historical input keeps confirmation. A background premove is submitted separately by PRE-F04/PRE-F07, without changing selected mode/path.

### PRE-F02 - Append a raw move to the FIFO

| Caller and call | Function work and branch/return |
| --- | --- |
| `makeMove` -> new `_appendPremove(game, player, rawMove)` | Caller has classified the current context and supplies the actual local seat. Board/PV producer has already supplied a possible move and completed promotion |
| `_appendPremove` -> `runtime.premoveQueue ??= { player, moves: shallowReactive<IMoveRaw[]>([]) }` | Initialise only when absent; trust existing queue ownership maintained by actual structural actions |
| `_appendPremove` -> `queue.moves.push(rawMove)` | Store the supplied reference in order. No move/array copy, field stripping, board inspection, validation or trial projection |
| `_appendPremove` -> return | Reactive push redraws the preview; no publication call, `attemptPlayerMove`, history, clock/increment, analysis refresh or move/autosave count |

For `g1f3`, then `f3g5`, the board's candidate selection reads the second source at displayed f3. Append simply stores both entries; rendering separately derives the new picture from the reactive edit. Black can queue before its first actual move; no last-own-move node is needed.

The complete proposed helper is deliberately this small; `player` and `rawMove` satisfy their callers' contracts:

```ts
function _appendPremove(game: IGame, player: IPlayer, rawMove: IMoveRaw) {
  const queue = game.$!.premoveQueue ??= { player, moves: shallowReactive<IMoveRaw[]>([]) };
  queue.moves.push(rawMove);
}
```

### PRE-F03 - Derive displaced pieces and red squares

| Caller and call | Function work and branch/return |
| --- | --- |
| Existing `GameView.renderedBoard` computed | Keep existing canonical selected-board owner. Compare canonical/input and queue/head/tail/held references before rebuilding premove projection; unchanged publications return previous result |
| Changed `renderedBoard` -> `GamePositionComposable.getPremoveProjection(canonicalPosition, queue)` | Existing view context selects ordinary following-live drawing; trust the queue maintained by actions. Analyse/history draws canonical board/empty red set. Instantiate existing `useGamePosition()` once for this pure query; no owner/seat validation |
| `getPremoveProjection` -> `MoveApplicationService.genPosition(base, [])` | Detached board/rights copy plus local `Set<BoardId>` |
| `getPremoveProjection` -> `applyPremoveProjection(copy, heldLocalMove, redSquares)` when held output exists, then each existing queue entry | Iterate references directly. No combined `[held, ...moves]` array or entry copies; no validation or queue mutation |
| `applyPremoveProjection` -> read preview source/target | Trust source/movement; derive kind from this evolving board, including earlier promotion. No coordinate/colour/candidate-membership check |
| `applyPremoveProjection` -> temporary `IMoveCandidate` | Derive application fields from preview source/target. Promotion -> `Promotion`; two-file king -> `Castle`; present en-passant right/victim -> `EnPassant`; otherwise `Normal`. Empty speculative diagonal is relocation, not fabricated capture |
| `applyPremoveProjection` -> optional red endpoint collection, then `MoveApplicationService.applyMove(preview, candidate)` | Before castle, read rook origin from existing `castlingRook` layout or standard H/A home square, and rook destination F/D from castle side. Add rook/raw endpoints if a red set was supplied; no prior board snapshot. Mutate caller-owned preview in place; never clone here |
| `getPremoveProjection` -> `{ position: copy, redSquares }` | Return owned board and set directly, with no extra array/map copy. No detail/check/history/clock work; temporary application candidate never enters FIFO |
| Changed `renderedBoard` -> Chessboard `position`, `displayPosition`, `premoveSquares`, `premoveColour` | `position` canonical; copied position drives artwork/accessibility labels and red IDs. No queue/context projection requested -> canonical artwork/no red. There is no invalid-projection fallback |
| Existing `Chessboard.onBeforeUpdate` -> `_clearSelection()` on changed input | Include display/colour context. Rendered owner retains queue/head/tail/held references, so edits replace input without copied snapshots; unchanged scores reuse previous projection/owner |

Input and PRE-F06 establish projectability before publication. Drawing trusts it. A genuinely paused local head comes directly from `deferredPlayerMove` as the optional third argument; apply it before iterating remaining queue references, even if queue is absent. No combined move array or reinsertion. Pause changed no board data, so do not recheck. Held opponent output is not projected; no new runtime field.

The browser journey exposed one publication boundary: the opponent commit publishes before requesting the local turn. That request shifts the head synchronously, but the unchanged `_playerMoveHandler` commits in a later microtask. Vue can render between them. `renderedBoard` reads the existing `pendingPlayerTurnPromise` and actual colour; while a local request is pending, it draws the canonical board without projecting the shifted tail. The ordinary commit or genuinely paused held-output publication supplies the next drawable state. This prevents an unavailable tail source without queue checks, copied snapshots, timers, another runtime field or a resolver change. The focused mounted regression reproduced the browser exception before this rendering adjustment.

### PRE-F04 - Request the ordinary actual turn and try its premove

| Caller and call | Function work and branch/return |
| --- | --- |
| Existing `_finaliseLiveMove`, workspace activation, final Resume or retry -> `requestPlayerMoveIfNeeded(game)` | Keep existing callers; no selected-board-equality gate |
| Existing `requestPlayerMoveIfNeeded` -> `status.isLiveTurnReadyForMove(game)`; inspect `runtime.pendingPlayerTurnPromise` | Return if actual play not ready or request already pending; no shift/provider start |
| Existing guard passes -> `_requestPlayerMove(game)` | Select actual player via `getSideToMovePlayer(game, position.getLivePosition(game).sideToMove)` |
| Existing `_requestPlayerMove` -> `new AbortController()`, `new Deferred<IMove>()`, `_playerMoveHandler(pendingPlayerMove)` | Handler suspends at `await pendingPlayerMove`; store Deferred/handler/controller in existing three runtime fields |
| Existing engine branch -> `void _requestEngineMove(player.assignedEngine).catch(error => pendingPlayerMove.reject(error))` | Preserve verbatim; delivery in PRE-F05 |
| **Only new dispatch branch**, Local -> `void _tryPremove(game).catch(error => logHandledError('GameStore', '_tryPremove', error))` | After registration, immediately reaches PRE-F07 shift/submission before awaiting existing handler. Empty/invalid FIFO leaves same request waiting |
| Existing `attemptPlayerMove(game, detailedMove)` -> `pendingPlayerMove.resolve(detailedMove)` -> `await pendingPlayerTurnHandle` | Same resolver as ordinary local/engine input; no direct commit/new acknowledgement |
| Existing nested `_playerMoveHandler` resumes | Existing `finally` clears three pending fields; genuinely paused -> `runtime.deferredPlayerMove = move`; otherwise -> injected `commitLiveMove(game, move)` |
| Existing `commitLiveMove` -> `_finaliseLiveMove` -> `requestPlayerMoveIfNeeded` | PRE-F06 inserts FIFO revalidation before the existing last call; successor stays here |

The handler's existing promise wait supplies the asynchronous boundary. No synchronous recursive queue executor is added. Repeated request before settlement sees the registered Deferred and cannot shift twice. No function waits for finite provider/ponder startup before actual commit; existing error/abort/retry logic stays.

The proposed dispatch insertion is exactly after the existing three runtime assignments, with the engine branch retained:

```ts
if (isEnginePlayer(player)) void _requestEngineMove(player.assignedEngine).catch((error) => pendingPlayerMove.reject(error));
else if (player?.type === PlayerType.Local) void _tryPremove(game).catch((error) => logHandledError('GameStore', '_tryPremove', error));
```

`_tryPremove` runs synchronously up to resolving the Deferred, then awaits that ordinary handler. Its caller does not await a future turn. Neither this branch nor the existing handler calls a new scheduler.

### PRE-F05 - Keep existing engine delivery

| Caller and call | Existing function work, retained |
| --- | --- |
| Nested `_requestEngineMove` -> `await EngineRuntimeService.ensureReady(engine, abortController.signal)` | Existing request cancellation signal, no new readiness owner |
| `_requestEngineMove` -> `await EngineRuntimeService.startPlayerTurn(engine, game, callback, signal)` | Existing callback checks aborted signal, then `await attemptPlayerMove(game, move)` |
| Service `startPlayerTurn` -> client `startPlayerTurn` -> `awaitPlayerTurnMove(engine, searchedPosition)` | Actual canonical searched-position legality/ponder validation; no selected/speculative position |
| Service `startPlayerTurn` -> optional `startPondering(engine, game, move, ponderMove)` | Begin optional pondering before delivery; retain finite startup promise |
| Service -> `await callback(move)` -> `await pondering` | Preserve this exact ordering/completion; no delivery-acknowledgement/provider-drain-before-commit change |
| Callback -> `attemptPlayerMove` -> `_playerMoveHandler` | Unpaused: actual commit then local request. Paused: existing held `IMove`; callback completes on handler storage, not Resume |

No engine-service/UCI change is planned. Original duplicate-callback/readiness/retry findings remain separate; they do not justify changing this sequence.

### PRE-F06 - Revalidate the remainder after a real commit

| Caller and call | Function work and branch/return |
| --- | --- |
| Existing `_playerMoveHandler` / `flushDeferredPlayerMove` -> `GameMoveComposable.commitLiveMove(game, move)` | Same actual commit for engine, direct local and premove |
| Existing `commitLiveMove` -> `clock.reconcileTimeout(game, moveTimestamp)` | Expired -> return before application/history/increment; `_finaliseTimeout` clears FIFO via PRE-F12 |
| Existing `commitLiveMove` -> optional `MoveHistoryService.pruneFutureMoves(parentNode)` | Keep current selection/pruning predicate; no ancestor/Exit pruning |
| Existing `commitLiveMove` -> `_applyLiveMove(game, move, timestamp)` | `clock.applyMove`; `analysis.captureMoveAnalysis`; `MoveApplicationService.applyMove(actual, move)`; `MoveHistoryService.addMainlineMove`; `position.appendLivePath`; assign clock; `moveCommitted(game)` |
| Existing caller -> `_finaliseLiveMove(game, actualPosition, isLivePositionRendered)` | Existing actual result and live/analysis state update |
| **New insertion**, after result/state update -> `_revalidatePremoves(game)` | No FIFO -> return; terminal -> clear. Otherwise one ordered feasibility pass on the changed actual board, as expanded below. Trust queue seat/raw shape; no owner/equality/schema validation or head submission |
| Existing finaliser -> `void _refreshRenderedAnalysis(game, isLivePositionRendered)` -> `clock.refreshRuntimeRegistrations(game)` -> `playerTurn.requestPlayerMoveIfNeeded(game)` | Keep order; publication refreshes changed selected analysis or calls `timestampGame` for independent selection. Successor sees only valid FIFO |

Neither opponent nor local commit shifts a head; PRE-F07 already does that at request. An invalid second entry after the opponent reply clears a still-legal queued first entry **before** local submission. Background execution never changes selection to make a move look live.

| `_revalidatePremoves` call sequence | Responsibility after actual board change |
| --- | --- |
| `position.getLivePosition(game)` -> `MoveApplicationService.genPosition(actual, [])` -> local `preview` | One detached board/rights copy for the entire validation pass; never clone each step |
| For each raw entry: read `preview.board[raw.from]?.colour`, then `genCandidateMovesForPiece(preview, raw.from)` | Opponent may have removed/replaced a source or changed geometry/occupancy/rights. Require local source colour and matching raw destination/promotion. This is the sole whole-queue feasibility check |
| No source/match -> `clearPremoves(game)` -> return | Clear entire remainder before any local head is submitted; no partial prefix |
| Valid step -> `position.applyPremoveProjection(preview, raw)` | Advance same detached preview in place. Shared internal application method makes no board copy, temporary queue/array or red set, and no duplicate rule query. It is returned by existing position composable for reuse; no new utility/library |
| End of sequence -> return | Drawing and turn request trust the pass. No cache, validation flag, second pass or future-reply prediction |

### PRE-F07 - Resolve the raw head, then use the existing resolver

| Caller and call | Function work and branch/return |
| --- | --- |
| New `_tryPremove(game)` -> read `game.$!.premoveQueue` | No queue -> ordinary Local turn waits. Runtime/request/queue ownership is supplied by existing caller and actions, not rechecked |
| `_tryPremove` -> `getLivePosition(game)` / `getLiveNode(game)` | Trust registered Local request and PRE-F06's feasible sequence. No projection, seat/mode/pending checks or second whole-queue validation |
| `_tryPremove` -> `genLegalMovesForPiece(actual, head.from, actualNode.move)` -> exact `to/promotionPiece` match | Sole head legality check; legal generator owns actual colour/source/check/capture/promotion rules. No match -> clear FIFO and leave same Local Deferred waiting; no separate source check |
| `_tryPremove` -> `toDetailedMove(actual, legalCandidate)` | Fresh actual capture/en-passant/castle/check/ambiguity/promotion. Use generated raw candidate, not supplied/speculative metadata |
| `_tryPremove` -> `queue.moves.shift()`; if empty, `runtime.premoveQueue = undefined` | Only after checks/conversion succeed. Exactly once at request, never again at commit |
| `_tryPremove` -> `await attemptPlayerMove(game, detailedMove)` | **No await/publication between shift and this call.** Resolve existing Deferred synchronously, then await existing handler. No selected-board `makeMove`, direct `commitLiveMove` or successor request |
| `_tryPremove` after handler settlement | No additional work; commit or the reactive held slot drives drawing. No reinsertion or second dequeue on Resume |

Existing `GameMoveComposable._resolveMove` remains ordinary selected-board acceptance. This small helper uses the same existing rule calls on the **actual** board because selected-board `makeMove` would explore/rewrite during analysis/history.

### PRE-F08 - Observe queue edits without a canonical move

| Caller and call | Function work and branch/return |
| --- | --- |
| `_appendPremove(game, player, rawMove)` -> `moves.push(rawMove)` | Initialise the existing queue with `shallowReactive<IMoveRaw[]>([])` if absent. Push the exact supplied reference; no copy, validation, timestamp or publication call |
| `GamesStore.clearPremoves(game)` -> `game.$.premoveQueue = undefined` | Whole FIFO cleared if present; absent queue is a no-op. No turn/analysis/clock operation |
| Existing `_playerMoveHandler` -> `runtime.deferredPlayerMove = move` | Paused accepted output remains in its existing observable slot. No post-handler publication callback or second dequeue |
| `GameView.game` -> stored canonical reactive game -> `renderedBoard` computed | Track actual canonical data plus queue length/head/tail/held references; unchanged input context preserves its owner |
| `_timestampGame(game)` -> `game.metadata.updatedAt = new RecordTimestamp()` | Metadata only at existing action boundaries. Queue-only edits do not call it |

A shifted head can reach rendering before handler commit. Keep the pending-Local boundary: show canonical pieces until commit or held output, rather than projecting a remainder whose source is not placed yet. Preserve the original resolver/handler order and canonical serialization.

### PRE-F09 - Cancel the whole queue from the board

| Caller and call | Function work and branch/return |
| --- | --- |
| Existing `Chessboard._onContextMenu(boardId)` | Board edit keeps `chessPieceDeleted`; eligible live-premove branch `_clearSelection` -> new `premovesCancelled` event, for any board square |
| New `Chessboard._onPointerDown(boardId, event)` | Clear prior touch gesture; on eligible touch of an occupied premoved square, retain this pointer's `{ pointerId, boardId }` as component-local `touchCancellation`. No queue mutation yet |
| New `Chessboard._onPointerUp(boardId, event)` / `_onPointerCancel()` | Up on another square/pointer or pointer-cancel clears the captured touch gesture; same-pointer/square release leaves it for its ensuing click. No completed queue entry or async token is stored here |
| New `Chessboard._onClick(boardId)` -> `_clearSelection()` and Vue `premovesCancelled`, OR existing `_selectSquare(boardId)` | Consume a matching captured touch tap, clear gesture/selection and emit cancellation once, then return without selection/submission. Otherwise use normal mouse/keyboard square selection. Input-context replacement/unmount clears this pointer state through `_clearSelection` |
| New `Chessboard._onKeyDown(event)` | Escape with unfinished selection/drag -> `_clearSelection`, return. Otherwise eligible queue -> cancellation event. Mounted promotion owns first Escape via existing modal lifecycle |
| New `GameView.inputActions.cancelPremoves` -> `_runInputAction(owner, game => gamesStore.clearPremoves(game))` | Trust board eligibility to emit cancellation. Reuse only existing owner checks before/after playback cancellation, since that await can replace context. Do not repeat seat, result, pause or mode predicates in the callback |
| New `GamesStore.clearPremoves(game)` -> `runtime.premoveQueue = undefined` | Whole FIFO only. No Takeback, engine cancellation, history or Undo-last. Empty -> return |

Store primitive is context-independent for structural/close callers; board permissions belong to guarded event. After synchronous shift/submission, cancellation affects remaining raw entries only; accepted head follows ordinary input settlement.

### PRE-F10 - Enter Analyse, review history and return

| Caller and call | Existing function work, retained |
| --- | --- |
| `GameView.inputActions.analyse` -> `_runInputAction(owner, game => gamesStore.enterInGameAnalysis(game))` | Existing playback/continuation cancellation and owner recheck before explicit Analyse |
| `enterInGameAnalysis` -> `getLivePosition`; `MoveApplicationService.genPosition(getRenderedPosition(game), [])`; `setRenderedPath(game, [...renderedPath], detachedCache)` | Detach selected canonical board even if paths have equal values; select existing live-analysis state preserving genuine pause; `_refreshRenderedAnalysis(game, false)`. No pause/turn clear/FIFO snapshot |
| `_navigateToNode(node)` -> `playback.cancel`; `_closeContinuation`; `gamesStore.navigateToNode(game, node)` | Existing membership/paused-exploration checks, `getPathToNode`, selected-path/state publication. History selection alone does not enter Analyse |
| Analysis `makeMove` -> `_commitLiveAnalysisMove` -> `_advanceRenderedAnalysisBranch` -> `MoveApplicationService.applyMove` / `MoveHistoryService.addAnalysisMove` / `setRenderedPath` | Selected branch only; no FIFO edit or actual clock transition |
| `inputActions.exit` -> `exitInGameAnalysis` -> `_returnToLiveNode` | Select latest actual live cache/path, preserve genuine pause/result, publish. Keep existing guarded request, no queue replay/Resume |
| `_returnToLivePosition` -> `_navigateToNode(latestLiveNode)` | Same canonical return for history; PRE-F03 draws current remainder |

PRE-F04-F07 continues from actual commits independently. Historical-anchor branches remain history through Exit; existing current-parent prune only.

### PRE-F11 - Real Pause and final Resume

| Caller and call | Existing function work, retained |
| --- | --- |
| Store alias -> `GameClockComposable.pauseGame(game, reason)` | Reconcile expiry, add Manual/Menu. First pause -> `TimeControlService.pauseClock`, paused state, `timestampGame`, `refreshRuntimeRegistrations`. Further owners do not restart work |
| Accepted move -> `_playerMoveHandler` -> `runtime.deferredPlayerMove = move` | Existing detailed held-output slot, no actual node/increment. Pending fields clear; original handler-completion semantics |
| Store alias -> `resumeGame(game, reason)` | Remove named owner only. Another remains -> `timestampGame`, return without flush/shift |
| Final Resume -> `TimeControlService.resumeClock` -> state -> `timestampGame` -> `refreshRuntimeRegistrations` | Actual clock resumes independently of selected board |
| Existing `resumeGame` -> `await flushDeferredPlayerMove(game)` | Take/clear held detailed output; actual readiness -> `commitLiveMove`; PRE-F06 revalidates remainder and retains successor request |
| Existing `resumeGame` -> `requestPlayerMoveIfNeeded(game)` | Keep this final call. Already-registered successor hits existing pending guard |

Pause before request prevents shift. Pause after shift but before handler microtask holds that head; only tail stays queued. Resume flushes without shifting again. Paused analysis calls PRE-F10 and never removes Manual/Menu. Actual expiry still wins.

### PRE-F12 - Actual rewrites, changed seats, setup and results

| Entry and specific calls | Queue insertion point and branch/return |
| --- | --- |
| `_requestMoves` -> `modal.open(ConfirmationModal)` -> `_confirmContinuation(pending, signal)` -> `_applyMoves` -> `makeMove` | Existing signal/game/node/mode/pause/result/Takeback checks before submission; cancelled/obsolete confirmation preserves FIFO |
| `_commitHistoryRewriteMove` -> capture selected node/position/path -> `await playerTurn.clearPlayerTurnRuntime(game)` -> existing context recheck | **After successful recheck**, `clearPremoves(game)` immediately before `setLivePath`. Failed recheck retains FIFO and requests eligible existing actual work. Generic turn cleanup does not clear queue |
| Accepted rewrite -> `setLivePath` -> `clock.startClock` -> `clock.reconcileTimeout` -> `_applyLiveMove` -> `_finaliseLiveMove` | Existing rewrite keeps old sibling variation; do not call `commitLiveMove` or alter pruning |
| `takeBack` -> existing exploration/pause/allowTakeback/count handling -> actual `getLiveNode` | Keep existing no-op/count handling, without an extra predecessor validator. Await existing `clearPlayerTurnRuntime` / `stopEngine`; clear FIFO immediately before `MoveHistoryService.takeBack`, then selectors/clock/state/publication/existing request |
| `reassignPlayer` -> `createPlayerSnapshot` -> existing schema-equal/BoardEdit handling -> existing turn cleanup/optional `stopEngine` | Equal/forbidden keeps existing return/throw. After awaited cleanup, call `clearPremoves` immediately before seat mutation, then existing state/publication/request. Do not later recheck queue owner |
| `replaceWithAnalysisRoot(game, rootPosition, nextState)` | Clear FIFO before replacing root/tree/selectors; retain clock/result/publication. Existing effective board-edit root replacement calls this function |
| `startGameFromSetup` -> existing `disposeAnalysisForGame` / `clearPlayerTurnRuntime` -> seat/root/time-control transition | After existing awaited cleanup, clear immediately before replacing canonical ownership. Retain actual clock/analysis/start calls; no queue-owner validator |
| `GameStatusComposable.resignGame` / `acceptDrawOffer` | Existing action/offer handling and awaited turn cleanup, then `clearPremoves` immediately before terminal mutation. Retain clock/publication. Offer/decline/withdraw do not clear |
| `_finaliseLiveMove` -> `updateGameResultFromLivePosition` -> `_revalidatePremoves` | Actual mate/draw retains completed node/final clock, clears remainder; existing readiness blocks successor. Analysis mate does not clear |
| `syncClock` -> `_settleTimeout` -> `_finaliseTimeout`, OR `commitLiveMove` -> `reconcileTimeout` -> `_finaliseTimeout` | Inject `clearPremoves` in `_finaliseTimeout` before terminal publication. Keep expiry/settlement checks and no post-deadline increment |

These are queue-only insertions at named accepted actions. `_clearPendingPlayerTurn`, `_playerMoveHandler`, engine delivery and resource-stop ownership stay unchanged. Independent turn-hardening defects are not silently included.

Queue clearing and the actual seat/root/continuation/result mutation occur together after existing awaits. Any valid old-context input accepted during cleanup is therefore cleared at that mutation; no consumer needs a defensive owner comparison to repair the transition. Keep the existing post-await context/cancellation checks where the action itself can become obsolete.

### PRE-F13 - Navigation, close, save and hydrate

| Caller and call | Function work and branch/return |
| --- | --- |
| `_handleMenuInterruptionRequested(action)` -> `playback.cancel` -> optional `pauseGame(game, Menu)` -> `action()` | Keep FIFO; actual pause only under existing Menu setting |
| `_selectTab` -> `setActiveGame` -> `router.push`; route update -> `_activateGame` | View selection retains completed queue. Existing activation cancels unfinished playback/continuation and completes Menu interruption |
| `_handleMenuInterruptionCompleted(game)` -> `resumeGame(game, Menu)` | Remove only Menu, preserve Manual; return draws current remainder |
| Changed `_closeTab(id)` -> `getGame(id)` -> `clearPremoves(closedGame)` -> existing `uiStateStore.closeTab(id)` -> route | Clear that game's FIFO even inactive/paused. Tab close does not delete game or dispose actual turn |
| Proposed GamesStore `onScopeDispose` callback -> per-game `clearPremoves`, `clearPlayerTurnRuntime`, player `stopEngine`, `analysis.disposeAnalysisForGame`, focus unsubscribe | Use existing cancellation/resource APIs at actual scope disposal, settle/log cleanup failure. No new turn `disposeGame` API; no disposal on view unmount |
| Existing `SavedGamesStore.saveGame` -> `SerializationService.writeGameDocument` -> `serialiseGame` | Schema omits `$`. Saving in memory preserves FIFO; no speculative data persisted |
| `deserialiseGame` -> store `insertGame` -> `_hydrateAndInsertGame` -> `position.hydrateGame` -> `createGameRuntime` | Empty fresh runtime; saved genuine pause reconstructed as Manual; normalise seats/insert canonical reactive game/existing eligible request. No queue restore |

Scope disposal's exact calls are listed to prevent an invented turn-lifecycle abstraction. Single-game changes/close leave another game's queue/resources untouched.

### PRE-F14 - Gestures, suggestions and stale input

| Caller and call | Function work and branch/return |
| --- | --- |
| Existing view context -> Chessboard selection/`:draggable` bindings | Establish selectable colour from `premoveColour` or canonical due colour and existing input-disabled/edit context. Offer drag only for eligible displayed pieces; this input boundary owns selection eligibility |
| `Chessboard._selectSquare` / `_onDragStart` | Selection distinguishes friendly source from destination; drag handler accepts the offered piece and records its square. Do not add another seat/source/candidate validator inside drag, emit or transport. Keep existing board-edit and lifecycle behaviour |
| Changed `legalMoves` computed -> `genCandidateMovesForPiece(displayedPosition, selectedBoardId)` in premove mode | Otherwise existing `genLegalMovesForPiece(position, selectedBoardId, lastMove)`. Same raw targets feed `_isLegalTarget`, `_commitTarget`, `_onDrop` |
| `_commitTarget` -> `modal.open(PromotionModal, { moves, colour, onSelected: _choosePromotion })` | Explicit choice before emission; premove chooser colour is projected source/local colour, not actual engine side |
| Existing `_choosePromotion` -> `_emitMove` -> `inputActions.move` | Choice belongs to current `pendingPromotionMoves`; detached old modal cannot emit. PRE-F01/F02 transports raw intention |
| AnalysisPanel Vue `moveSelected(rawPrefix)` -> `inputActions.line` -> `_playAnalysisLine` | Respect suggestion-playability setting. Own actual turn uses first move; explicit/free/result analysis uses full canonical prefix |
| Changed off-turn `_playAnalysisLine` -> `_requestMoves([moves[moves.length - 1]])` | This PV input boundary offers only a local-colour possible candidate: derive clicked mover from canonical PV side/prefix parity and match the final raw entry against `genCandidateMovesForPiece(displayedPosition, from)`. A non-playable suggestion is not forwarded. Board selection already has its own candidate query; append repeats neither query. Do not enqueue preceding replies |
| Existing `_applyMoves` -> detached canonical preview -> `isMoveLegal`, `toDetailedMove`, `MoveApplicationService.applyMove` for all steps | Due input/history/analysis only, never off-turn speculation. Bad suffix rejects before first submitted move |
| Existing `_applyMoves` -> `playback.run` -> step `abortableDelay` / signal/context checks -> `await gamesStore.makeMove` | Retain delay/selected path/mode/result/capability owner, no FIFO promises |
| Existing board `onBeforeUpdate/onBeforeUnmount` -> `_clearSelection`; route hooks -> `_closeContinuation` / `playback.cancel/dispose` | Extend compared display/colour/queue values. Relevant base/queue/permission/mode/game/result change cancels unfinished input; independent unchanged analysis ignores background queue changes |

### Rule-query calls used by PRE-F06/PRE-F14

| Proposed `genCandidateMovesForPiece` calls | Work and branch/return |
| --- | --- |
| Existing `_genPieceMoves(position, from, source)` for knight/sliders | Geometry/blockers reused; filter friendly targets/opposing king capture. Source piece supplies colour, not actual side due |
| Existing `_genPawnMoves` plus `_genPawnAttackMoves` | Keep empty-path pushes/start-rank double; add feasible empty diagonals, expand last-rank promotions to existing four choices, deduplicate. No new public pawn API |
| Existing `_genOffsetMoves`, `_hasCastlingAvailability`, `_findCastleRook`, `_isCastlePathClear` for king/castle | Occupancy/rights/rook/path, without attack/king-safety filtering. Earlier projected movement cannot restore rights |
| Return raw `IMoveRaw[]` | No detailed metadata, actual-turn gate, queue or red IDs; no premove library. Actual due legality stays in PRE-F07 |

The PRE-S01-PRE-S25 matrix below names entry/decisive function calls and their PRE-F references. Tests use actual owners/actions, not a parallel test-side queue engine.


## Presentation

- Derive displayed squares by applying the queue to a copy of canonical `renderedPosition` only while displaying live gameplay. Keep canonical rendered input unchanged for analysis, engines, FEN, saves and move validation. During review/explicit analysis show that selected canonical board; return to live reapplies the **current remainder** over the latest live position.
- Move normal piece artwork to its final projected destination and empty its projected origin. No duplicate source piece or marker-only substitute. Selecting the projected destination extends a chain such as `g1-f3-g5`.
- Red-fill the union of every pending `from`/`to`, including empty intermediate squares. Repeated squares use one opacity. Actual execution and cancellation rebuild the copied squares and red union; no in-place reversal of speculative captures.
- Speculative capture hides the displayed target without changing actual captured-piece totals. Promotion displays the chosen kind; castling moves both king and rook. Shade all four relocated castling squares.
- When any remaining intention becomes invalid, clear the complete displayed sequence/red union. Do not display a valid prefix with an unavailable tail or resurrect a captured source.
- Use board right-click, touch tap on a premoved piece and Escape cancellation. No queue count/list, Undo/Clear buttons, local-local selector or two-colour queue. Inability to edit during review/analysis never suspends valid queued play.
- Make explicit Analyse available on the selected canonical move. Analysis board/PV input stays independent; history navigation by itself remains review. Takeback remains clearly labelled as actual-game rewind.
- Preserve actual clock/side/result/check/capture labels. Red fill takes precedence over actual-last-move background; retain distinct last-move outline, selection/focus and readable piece/coordinate layers. Never evaluate checkmate on the displaced display.
- Escape cancels unfinished input/promotion first; in live premove context it can clear the queue. In analysis/review it must not silently clear background intentions. Use the premoved piece itself for touch cancellation and retain accessible coordinate labels.
- Dispose unfinished gestures/playback on context changes and keep completed queue ownership per game across remounts. Real clock pauses still block execution; review/analysis/tab selection do not create extra pauses.

Own board/queue styles in [board.css](../src/assets/styles/board.css) without premove styling in the game control panel. Use global CSS only, no scope escapes or inline presentation declarations. Keep derived projection computed and effects in explicit actions/lifecycle hooks; extend the existing `onBeforeUpdate` comparison of actual input props and `onBeforeUnmount` cleanup. All observers remain forbidden.

## Boundary matrix

| Boundary | Queue and actual execution |
| --- | --- |
| Analyse entry, analysis moves, history review, return/exit | Queue remains game-owned and executes in the background. These actions affect selection/input, not the actual clock |
| Temporary menu/game-tab navigation | Preserve the same in-memory queue. Continue actual execution unless an existing Manual/Menu pause really applies |
| Manual/Menu pause or final real Resume | Retain queue/accepted output while paused; keep existing held-output flush and duplicate-guarded turn requests |
| Queue invalidation | Clear every remaining intention, not a suffix. Already played history remains |
| Actual Takeback, confirmed history rewrite, changed seat, setup/root replacement | Close old input, cancel queue, abort/drain actual turn, then change canonical ownership. No-op/cancelled actions preserve it |
| Result/timeout/resignation/draw/abandonment | Clear queue, settle actual work, stop live arming. Analysis remains review-only; exit cannot revive play |
| Explicit tab close | Clear that game's queue and view-owned input; existing `closeTab` removes a session tab, not the actual game/runtime. Other games and the existing actual-game lifecycle remain independent |
| Actual game/store disposal | Clear its queue and abort/drain resources at their actual owner; no new deletion/disposal API is inferred from tab close |
| Save/export | Persist canonical selected/live workspace; omit all queue/display/turn runtime |
| Load/restore | Empty queue and rebuilt actual ownership. Legacy saved pause remains explicit until Resume |

Queue edits never pause running clocks or change actual history. Use actual commit timestamps and existing elapsed/increment policy, with no artificial premove delay or zero-time exemption. A timeout wins over an uncommitted queue head.

## Data-driven unit test specification

The migrated `IMoveRaw[]`/`IPremoveQueue` declaration is the scenario fixture contract. Define examples as plain data, then bind `queue.player` to the constructed game's actual local seat **after** game construction/hydration. The existing actual live selector supplies the validation base; no node reference is stored in the queue fixture.

Use the following common seeds throughout the scenarios:

| Seed | Canonical data |
| --- | --- |
| A | Standard initial root, actual history `e2e4`, White local/Black engine, Black due, rendered follows live. No real pause; provider results are held in integration tests |
| B | Standard initial root, actual history `e2e4 e7e5`, White engine/Black local, White due, rendered follows live |
| B0 | Standard initial root, White engine/Black local, no actual moves yet, White due. Black can queue g8-f6 then f6-g4; no last-own-move anchor exists |
| H | Same actual board/history as A, both players local. Only the due Black side owns fresh live input |
| E | Both seats engines, actual/selected context supplied explicitly; manual premoves are ineligible |
| C | A or B with explicit timestamps, remaining milliseconds and increment `0` or `2000`. No wall-clock waiting |
| R | A custom root/FEN, actual history and castling/en-passant rights for the rule under test. List the exact pieces/rights/last actual move, rather than assume a future reply |

`N1 = { from: 6, to: 21 }` is g1-f3; `N2 = { from: 21, to: 38 }` is f3-g5. The Black counterparts are g8-f6/f6-g4. Use enum values in TypeScript fixtures; the names here abbreviate them.

An example scenario row can be encoded as:

```ts
{
  id: 'PRE-S02',
  localColour: PlayerColour.White,
  actualMoves: ['e2e4'],
  queue: [N1, N2],
  events: [
    { kind: 'providerMove', uci: 'e7e5' }, // existing successor request submits N1
    { kind: 'cancelPremoves' },
  ],
  expected: {
    actualMoves: ['e2e4', 'e7e5', 'g1f3'],
    queue: undefined,
    actualPieces: { f3: 'white knight', g1: undefined },
    displayedPieces: { f3: 'white knight', g5: undefined },
    redSquares: [],
    actualSearchesStarted: 2, // original Black turn, then the next Black turn
  },
}
```

The event interpreter is **test code**, not a new production dispatcher. `providerMove` integration events release a captured controlled provider through the real actual commit route; they must not fake progression by editing live paths or clocks. Chess-rule cases supply board/raw-coordinate data directly and need no engine or Vue mount. Plain projection scenarios feed the mounted board to assert final pieces, red squares and untouched canonical data without inventing a premove utility API.

### Assertions and test owners

| Lane | Proposed test owner | Required assertions |
| --- | --- | --- |
| U-P: pure chess data | Existing `src/utility/__tests__/GameRuleUtility.spec.ts` | Speculative piece candidates and existing due legal moves/details; no queue, UI shading or seat ownership in the rule API. Deep-freeze candidate-query inputs or compare before/after |
| U-S: state data/actions | New `src/state/__tests__/Premove.spec.ts` using existing fixture/rule helpers | Exact queue entries/order, seated player reference, actual/selected paths and FENs, tree identities/records, result, clocks and runtime-only publication. Use actual public actions and meaningful observable failures |
| U-O: actual-turn integration | Premove state tests plus unchanged existing turn/runtime regressions | Existing Deferred is registered before queue submission; shift once and use `attemptPlayerMove`, one commit per turn, original handler completion, pause/timeout ordering and no repeated increment/ponder. Fake only external provider/readiness/time boundaries; keep rules/history/time-control logic real |
| V: mounted input/projection | New `PremoveView.spec.ts`, with existing `GameView.spec.ts` and `Chessboard.spec.ts` regressions | Full copied piece map/red squares from valid queue data. An actual invalidating move clears the FIFO in state before drawing; no malformed-input/getter-fallback contract. Automatic routing/cancellation/input ownership and promotion/playback remain covered |
| J: browser/platform | New premove journey plus affected existing Analysis/History/Clock/engine-race/Promotion checks | Actual gestures, accessible/focus layers, both orientations, visible background progression and native protocol evidence only where executed |

For every state event assert both the changed data and important untouched data. Queue edits preserve serialized canonical bytes, timestamps, history/clock/move count and analysis-search starts. Actual commits advance history, timestamps, clock/increment and recording once, while an independently selected canonical board stays unchanged. Queue cancellation never undoes already committed moves.

Write U-P/U-S cases first and record the failing baseline before premove behaviour changes. The already passing `PremoveData.spec.ts` covers only contract serialization/hydration, and the analysis tests cover only the prerequisite. Missing imports, missing methods or type errors alone are not meaningful behavioural red evidence. Add controlled U-O tests before adding the local-turn hook; add V/J tests for their presentation boundaries. Keep rules real in rule/board/progression tests; a call-boundary test may use a failing projection spy to establish that append never calls it. Never mock the append action under test.

### Raw-contract test migration

First complete PRE-RAW's tests-first submission refactor. Then write the small raw queue/serialization assertions and migrate the declaration/imports without premove gameplay changes. Once this data boundary is green, revise and execute premove behaviour tests before developing premove behaviour.

- Replace the custom entry imports/fixtures with `IMoveRaw` and bare `{ from, to, promotionPiece? }`. Remove the fixture helper's expected-kind argument and queue `movingPiece` fields; retain piece kinds on canonical pieces/actual move expectations.
- Replace impossible "wrong stored expected kind" checks with source geometry/colour, missing sources and invalid promotion cases. Do not retain a hidden field merely to keep an obsolete assertion green.
- The append correction supersedes the `invalid new append preserves...` scenario and the invalid-append/unfinished-promotion store rejection parameterisations. Move these examples to candidate/board/PV input tests, where impossible moves are never offered/emitted. Store append tests supply possible stable moves and assert object identity, order, ownership, publication and zero copying/projection/rule calls. Keep separate tests for actual replies invalidating accepted entries. This documentation edit leaves existing tests in place; update those superseded assertions before the next implementation rather than writing validation to satisfy them.
- The wider contract audit also supersedes drawing tests that inject impossible queues and expect silent fallback, injected cloned-seat rejection tests and new turn-helper tests that repeat full revalidation. Test actual seat/root actions establishing ownership instead; test an opponent reply invalidating a real queue at PRE-F06. Assert valid drawing makes no candidate query and local turn execution makes no projection/whole-queue query. Wrong-colour drag and unavailable cancellation cases should assert what the input surface offers, rather than bypassing it with a forged event and expecting every downstream helper to reject it. Keep existing asynchronous stale-input tests at their actual owner boundary.
- Replace button/count/Undo cases with whole-queue cancellation. Cover right-click on empty/ordinary/premoved squares, touch tap versus mouse selection, Escape priority, board-edit deletion, no-op cancellation and stale callbacks.
- Exercise real public store actions with raw fixtures, not a cast to `IMove` or a test-side queue implementation. Assert the same supplied move references reach the FIFO and consumers do not mutate coordinates/promotion; actual accepted details still come from the canonical board. Keep rules, clocks, history and serialization real; fake only external providers/time.
- Retain PRE-S01-PRE-S25 and existing analysis/pause/runtime regressions. Add raw promotion dependencies, Black queuing before its first actual move and cancellation before/after actual commit.
- Refresh counts from executed runs. Missing imports/type errors alone are not meaningful behavioural failures; do not skip/expected-fail assertions to manufacture a green report.

The copying correction also supersedes tests asserting distinct raw objects, dropped extra fields, or isolation after a producer mutates submitted coordinates. Replace them before implementation with reference-identity/no-consumer-mutation assertions across board, PV, view, confirmation and FIFO. Assert one board clone per revalidation pass, and no castle board snapshot or per-entry clone; keep required canonical-isolation assertions. Existing tests remain unchanged in this planning turn.

### Rule fixtures required in addition to the scenario sequence

| Input data | Candidate/input or projection expectation | Due-turn expectation |
| --- | --- | --- |
| Empty/opponent source, geometry incompatible with the real source, friendly target, opposing king target, non-integer/out-of-range coordinates | Rule/input boundary offers/emits no such premove. Append trusts its caller and has no rejection test for injected impossible input. An actual board change invalidating accepted data clears the whole FIFO on rebase | Never create an actual node or resolve another seat's turn |
| Knight or king currently pinned/in check or targeting an attacked square | Speculative geometry may project; no claim of actual king safety | Resolve only if an actual legal candidate exists; otherwise clear all remaining entries |
| Bishop/rook/queen blocker introduced at an early or later step | Whole existing sequence becomes invalid; no displayed valid prefix | No due head executes if a later entry is already unprojectable |
| Pawn single/double push, blocked intermediate square, wrong direction/rank | Respect own projected movement/start rank and empty path | Recompute actual legal candidate after the reply |
| Pawn diagonal onto empty/enemy square | Allow possible capture geometry without inventing a future victim or captured-material total | Require a real capture or current en-passant candidate; otherwise whole clear |
| Castling with missing rights/rook/path; king/rook projected away and back | Missing rights/path rejects projection; preceding intentions cannot restore lost rights | Also require actual safe king/path/destination |
| Each queen/rook/bishop/knight promotion followed by that piece moving; also missing/King/Pawn promotion choices | Require a completed valid choice; derive promoted kind from the copy; unfinished choice stays outside the queue | Match exact chosen kind and regenerate actual capture/check/notation |
| Same-square repeat, repeated intermediate square and multiple pieces | Geometry rejects null moves; legitimate shared squares produce one red fill | Preserve FIFO dependency order; no entry IDs or speculative nodes |
| Actual seat/root replacement, including equal coordinates/FEN | Accepted structural action clears the queue at mutation. Creation binds the actual local seat; consumers trust this invariant without cloned-owner rejection branches | No old queue survives replacement or changes actual turn ownership |

## Concrete scenarios for unit tests

These retain all **PRE-S01-PRE-S25** from the conflict record with explicit seeds, events, function paths and assertions. Their raw-move test specifications have now been executed as a failing baseline, not passing feature acceptance. The additional rule table above supplies the per-piece and invalid-input parameterisation. Scenario IDs remain in test names so omissions are visible.

| ID | Given / when | Function path | Required data and effects |
| --- | --- | --- | --- |
| PRE-S01: chained drawing | Seed A; board supplies possible N1 then N2 during the same held Black turn | `makeMove -> _appendPremove -> moves.push`; separately `renderedBoard -> getPremoveProjection` (F01-F03/F08) | FIFO `[N1,N2]`, player is actual White seat; append pushes the exact supplied references and updates reactive data, without copying or reading/projecting the board. Rendering separately displays Ng5, empty g1/f3; red `{6,21,38}`. Canonical knight stays g1; live/rendered paths, history, clock, timestamp and engine-search count unchanged |
| PRE-S02: consumption and cancellation | A with `[N1,N2]`; release e7e5, request/shift/submit N1, then cancel before another reply | `_playerMoveHandler -> commitLiveMove -> _finaliseLiveMove -> _requestPlayerMove -> _tryPremove -> attemptPlayerMove`; `clearPremoves` (F04-F09) | Actual line e4/e5/Nf3; N1 shifted once at local request, not again at commit. N2 alone projects on actual Nf3 with red `{21,38}`. Cancellation removes remainder/red; actual Nf3/history and once-started Black successor remain |
| PRE-S03: marks, orientation and board cancellation | A with chained/shared-square sequence; flip orientation; right-click empty/ordinary/premoved squares or touch a premoved piece | `getPremoveProjection -> applyPremoveProjection`; `_onContextMenu/_onClick/_onKeyDown -> inputActions.cancelPremoves -> clearPremoves` (F03/F09) | Same displaced pieces/unique red set in both orientations. Whole clear restores canonical artwork with no actual move/clock/search effect. Mouse selection still chains; touch tap cancels. No counts/buttons/Undo-last; empty cancellation is a no-op |
| PRE-S04: special drawing | R fixtures for speculative capture, promotion with a following promoted-piece step, and castling | `_appendPremove -> moves.push`; separately `getPremoveProjection -> applyPremoveProjection -> MoveApplicationService.applyMove`; due `_tryPremove -> genLegalMovesForPiece -> toDetailedMove` (F02/F03/F07) | Projection hides a target without adding actual captures; displays exact chosen promotion and both castle pieces; red includes rook endpoints. Input supplies completed promotion; append does not recheck it. Clear restores canonical pieces. Actual rights/check/result and canonical FEN never come from projection; due resolution uses real legality |
| PRE-S05: explicit analysis entry | A with `[N1,N2]`, held actual search; press Analyse, then in a separate case only select history | `inputActions.analyse -> _runInputAction -> enterInGameAnalysis`; separately `_navigateToNode -> navigateToNode` (F10) | Analyse uses selected canonical node/position without displacement or red fill; queue/actual owner/search/clock preserved. Plain history selection does not enable exploration or edit the queue. Analysis entry itself consumes nothing |
| PRE-S06: independent exploration | S05; make legal analysis moves including coordinates that match queued intentions, while releasing actual replies | `makeMove -> _commitLiveAnalysisMove -> _advanceRenderedAnalysisBranch`; independently `_playerMoveHandler -> commitLiveMove` (F05/F06/F10) | Analysis changes only its selected branch. Actual commits alone consume/rebase queue, update actual clock and start successor searches. Selected board/evaluation stays on its analysis node, including when actual and selected sides differ |
| PRE-S07: Exit before reply | A with queue; enter/Exit before delivering e7e5; repeat Exit | `inputActions.exit -> exitInGameAnalysis -> _returnToLiveNode -> getPremoveProjection` (F03/F10) | Return displays canonical actual board plus unchanged current remainder; no premature local move, clock resume, duplicate search or replay. Later reply still consumes one legal head through its original owner |
| PRE-S08: successive background turns | A/C with N1, N2, then f1-c4; enter Analyse or ordinary review. Release e7e5, b8c6, g8f6 in order, repeating wake/delivery attempts | `_playerMoveHandler -> commitLiveMove -> _revalidatePremoves -> requestPlayerMoveIfNeeded -> _tryPremove -> attemptPlayerMove`, repeated by existing finaliser (F04-F07) | Actual line alternates Black reply/one White intention three times before Exit. FIFO drains in order; one provider per Black turn and one increment per mover at its commit timestamp. Selected canonical board/path remains fixed. After the subsequent Black reply, the now-empty local queue leaves a waiting actual local turn |
| PRE-S09: background invalidation | R with a queue; legal actual reply captures its intended source, adds a blocker or makes the due head illegal through check/pin | `commitLiveMove -> _revalidatePremoves -> genCandidateMovesForPiece -> clearPremoves`; or due-head `genLegalMovesForPiece -> clearPremoves` (F06/F07) | Opponent move commits once; whole queue/red union disappears before publication. Local turn waits; its clock runs. No invalid local node/increment, retained suffix or drawing fallback. Selected independent board survives |
| PRE-S10: genuine paused analysis | A/C with queue; enter Analyse; add Manual/Menu in both orders; deliver actual reply; remove non-final then final owner | `pauseGame`; `_playerMoveHandler -> deferredPlayerMove`; `resumeGame -> flushDeferredPlayerMove -> commitLiveMove -> requestPlayerMoveIfNeeded` (F11) | Queue and accepted reply retained; paused analysis moves/history still work. No actual commit/consumption/increment/successor while any real owner remains. Final Resume commits reply/head and starts successor once without requiring Exit; repeated Resume is ineffective |
| PRE-S11: ordinary review | A with queue; select an old/sibling node, release multiple actual replies, then return live | `_navigateToNode -> navigateToNode`; actual `_finaliseLiveMove -> requestPlayerMoveIfNeeded`; `_returnToLivePosition` (F04/F10) | No queue editing from review, but valid queued moves continue. Canonical selected node remains stable, actual status/progression may update. Return projects current remainder only, never entry-time consumed entries |
| PRE-S12: selected historical anchor | Actual line has several plies; queue belongs to the actual live game. Select earlier node and explicitly Analyse with Takeback allowed and disabled | `_navigateToNode -> navigateToNode`; `inputActions.analyse -> enterInGameAnalysis -> setRenderedPath` (F10) | Analysis anchor is that historical canonical node. Exploratory board/PV moves do not open rewrite confirmation or append/clear queue. Queue validation still uses the actual live position, not selected history; actual progression continues |
| PRE-S13: confirmed rewrite | A progressed beyond selected historical prefix with queue; request allowed history continuation, cancel, reopen/confirm; also deliver stale confirmation after mode/node change | `_requestMoves -> modal.open -> _confirmContinuation -> _applyMoves -> makeMove -> _commitHistoryRewriteMove -> clearPlayerTurnRuntime -> recheck -> clearPremoves -> setLivePath` (F01/F12) | Cancel/stale/disabled confirmation preserves queue and actual game. Valid confirmed rewrite cancels FIFO and old actual provider before replacing selectors, retains played variation, relocates selection safely and starts only eligible replacement actual work. Old callback cannot commit |
| PRE-S14: actual Takeback | Analyse away from actual live node with a queue; try disabled/paused Takeback, then an allowed live Takeback during thinking and after a reply | `inputActions.takeBack -> takeBack -> getLiveNode -> clearPremoves -> clearPlayerTurnRuntime -> MoveHistoryService.takeBack` (F12) | Blocked action leaves queue intact. Allowed action clears queue and rewinds actual history/count/clock, never just the selected analysis branch. Pending output is drained; invalid selected path/input relocates. Board cancellation remains PRE-F09 and cannot remove played history |
| PRE-S15: suggestion routing | Move-enabled/score-only fixtures; choose own-colour suggestion on own turn, opponent turn, history and explicit Analyse; try engine-colour input | `inputActions.line -> _playAnalysisLine -> _requestMoves -> makeMove -> _appendPremove/attemptPlayerMove/_commitLiveAnalysisMove` (F01/F14) | Own due input commits one move, off-turn input appends one intention, explicit analysis plays selected legal prefix, ordinary history retains confirmed rewrite policy. Reject engine-colour raw prefixes by source-side/parity even when their source square overlaps a projected local piece. No opponent PV replies enqueued, implicit replacement or theft of engine turn; visibility preference stays independent |
| PRE-S16: active branch lifetime | From current actual parent, enter Analyse/explore descendants; actual reply/head advances while selected; Exit, navigate, save/reload. Separate case exits before any actual advance | `enterInGameAnalysis -> _advanceRenderedAnalysisBranch`; actual `commitLiveMove -> isPathPrefix -> optional pruneFutureMoves`; `exitInGameAnalysis` (F06/F10) | Selected analysis descendants are protected while actual siblings append. Once anchor is historical, branch remains through Exit/navigation/persistence. Existing current-parent temporary prune applies only to its already-defined next actual move case; no release/Exit cleanup registry or ancestor blanket prune |
| PRE-S17: seat/first-move ownership | H in both colours/orientations; retain old click/drop/promotion/Analyse callbacks across handoff; repeat E and B0 | `_selectSquare/_onDragStart -> legalMoves -> _emitMove -> _requestMoves -> makeMove` context routing (F01/F02/F14) | Input/caller ownership excludes H/E premoves and stale previous-side callbacks; append repeats no checks. Fresh hotseat input belongs to newly due side. B0 permits raw Black intentions before Black has played; source colour comes from board/seat, not an anchor |
| PRE-S18: unfinished input | A/R with drag or unfinished promotion; change actual base, queue via cancellation/rebase, mode or route; separately publish only evaluations. During delayed analysis prefix Exit/receive actual result | `Chessboard.onBeforeUpdate/onBeforeUnmount -> _clearSelection`; `playback.cancel/dispose`; captured `inputActions` owner check (F09/F10/F14) | Obsolete gesture/promotion/PV cannot append or commit into new ownership; incomplete choice never entered queue. Completed entries survive non-invalidating navigation/analysis. Mere evaluation behind unchanged selected board preserves valid input; result/context replacement stops delayed playback |
| PRE-S19: navigation and close | Two games with separate queues; visit Settings with Menu pause on/off, switch tabs/return, then explicitly close one tab | `_handleMenuInterruptionRequested/_activateGame/_selectTab`; `_closeTab -> clearPremoves -> UiStateStore.closeTab`; actual `onScopeDispose` cleanup (F13) | Temporary navigation retains/executes queues unless a genuine pause applies. Return draws surviving remainder without replay. Explicit close clears only that game's FIFO/view input; existing `closeTab` is not game disposal. Other queue/actual work unaffected; actual game disposal additionally drains its real resources |
| PRE-S20: later dependency invalid | R where the changed actual board still permits the head but blocks a later intended step; release that reply | `_finaliseLiveMove -> _revalidatePremoves`: candidate check then trusted single-step application; failure -> `clearPremoves`, before turn request (F06) | One whole-queue feasibility pass clears all remaining entries before the local head is submitted; no valid-prefix node/increment or later revival. Drawing and request do not repeat this pass |
| PRE-S21: terminal or structural change | Queue with provider pending; timeout, actual mate/draw, accepted resignation/draw, changed seat, unassignment or setup/root replacement. Also cancelled/no-op actions and late old output | `reassignPlayer/startGameFromSetup/replaceWithAnalysisRoot/resignGame/acceptDrawOffer/_finaliseTimeout -> clearPremoves`; actual result via `_revalidatePremoves` (F12) | Real invalidating transition clears queue and closes old acceptance before replacement; terminal actual move/clock/result remain final and no successor starts. Repeated/late output cannot affect replacement. No-op reassignment/cancelled action and exploratory mate preserve queue. Other game's data is unchanged |
| PRE-S22: engine/save isolation | A/R with FIFO/projection and independent analysis seats; edit queue, save/export, continue in memory, then load/import a separate game | `moves.push/clearPremoves/getPremoveProjection`; `saveGame -> serialiseGame`; `insertGame -> _hydrateAndInsertGame -> hydrateGame` (F03/F08/F13) | Queue edits do not restart analysis or change canonical rendered FEN, captures, history or timestamp. Available actual-parent analysis is recorded once; unrelated selected output is not copied. Save preserves original in-memory FIFO, serialized schema omits runtime/projection, loaded game starts empty |
| PRE-S23: equal-path race | A with queue; enter Analyse and make no exploratory move; release e7e5 immediately | `enterInGameAnalysis -> genPosition -> setRenderedPath`; actual `_playerMoveHandler -> commitLiveMove -> _tryPremove` (F04-F07/F10) | Actual e5/head and successor progress with no Exit; selected canonical entry snapshot/path/cache stays independent even though path values initially matched. Queue validation uses the current actual live position; selected picture has no red displacement |
| PRE-S24: actual clock in analysis | C on local turn with no queue; enter Analyse; explore without committing actual move; advance explicit timestamp to expiry, then deliver stale Exit/Resume/input. Repeat expiry racing a queued head | `syncClock -> _settleTimeout -> _finaliseTimeout`; or `commitLiveMove -> reconcileTimeout -> _finaliseTimeout` (F12) | Actual human clock keeps running and expires once. Exploratory moves add no time/increment. Timeout clears queue/actual ownership; stale actions cannot revive result or rescue an uncommitted head at deadline |
| PRE-S25: legacy paused restore | Load old paused live-analysis save, visit/cancel Menu, explicitly Resume while still analysing | `insertGame -> _hydrateAndInsertGame -> hydrateGame`; `resumeGame -> flushDeferredPlayerMove -> requestPlayerMoveIfNeeded` (F11/F13) | Empty queue after restore, selected canonical node preserved and Manual-only reconstructed pause ownership. Menu cannot clear Manual. Final Resume permits actual work without an extra Analysis owner/Exit; no old runtime entry is restored |

### Deterministic ordering checks

Pair the scenario rows with these controlled event orders; test both sides of an atomic commit rather than depending on arbitrary delays:

- Append completes before a provider reply versus a retained gesture delivered after that reply: the first enters the FIFO; the second fails its old selected-input owner and cannot become a fresh intention.
- Cancellation before local request versus after its synchronous shift/submission: the first prevents the queued move; the second cancels only remaining raw entries. An already submitted move follows the same settlement rules as ordinary input; no new rollback window is introduced.
- Pause before request leaves the head queued. Pause after synchronous shift/submission but before the existing handler resumes leaves that head in `deferredPlayerMove` and only the tail queued; Resume flushes once. Compare with pause after commit; no order repeats a shift/commit/increment/search. Include paused following-live projection of held local output plus remainder.
- Structural cancellation before readiness/result versus after completed actual move: old work cannot start/commit after cancellation; an already committed node is retained until the actual rewrite/Takeback policy changes it.
- Repeated calls while the existing Deferred is pending hit the existing guard; no extra shift or provider start. Successor registration remains in `_finaliseLiveMove`, and promise settlement supplies the existing asynchronous boundary.
- Keep existing provider/ponder regression contracts. Retained tests exposing independent duplicate-callback, cancelled-readiness or retry-cleanup gaps are listed separately below; do not satisfy them by changing turn resolution. Report native execution separately.

No arbitrary queue limit, hotseat premoving, review suspension, analysis-entry clear or invalid-tail retention is restored from superseded drafts. Those conflict with the user's settled choices. The queue/data structure alone still does not make any scenario above pass.

### Tests to align with the retained turn mechanism

Keep the data-driven PRE-S01-PRE-S25 specifications and real rule/store/modal owners. Revert the regression-test migrations to `playerTurn`, `completion`, `provider` and `controller`; those belong to the rejected replacement runtime. Remove the test demanding provider acknowledgement before commit: it asserted the rejected completion redesign, not a product requirement. Retain disposal, released-rewrite and wrong-colour drag scenarios; control released-rewrite cleanup through the existing handler promise.

Before implementation, add focused tests through returned `useGamePlayerTurn` actions using the existing runtime fields:

| Scenario | Observable boundary assertion |
| --- | --- |
| Valid local request, including both colours | Immediately after `requestPlayerMoveIfNeeded`, the ordinary Deferred/handler/controller are registered and one head is shifted. Await that captured Deferred and assert freshly resolved actual details; await its handler and assert one normal commit |
| Empty FIFO or actual-illegal due head | Same Local Deferred remains pending; an illegal head clears the queue. Feasibility was already established by PRE-F06. Direct input can resolve the same request; no repeated owner/whole-queue validation |
| Duplicate request before the handler settles | Existing pending guard returns; same Deferred/handler/controller, no second shift or commit |
| Pause before request | Readiness prevents registration/shift; final Resume uses existing request path |
| Pause after request, before its handler microtask | One shifted head becomes existing `deferredPlayerMove`, only tail stays queued, handler completion settles without Resume. Paused drawing includes held local head and tail; final Resume commits once, no re-shift |
| Timeout or accepted structural action after submission | Existing commit/cancellation semantics prevail, no fabricated node/increment or reinsertion; clear remaining FIFO at the accepted action boundary |

These assertions test the existing flow with data, not a substitute test-side queue engine. They are required tests before the next implementation; this rollback/replan does not implement the new hook.

### Turn-contract test assumptions

Earlier runs labelled three failures as independent turn-hardening findings. The subsequent user-requested test cleanup traced their assumptions against the real engine service. `startPlayerTurn` awaits one result and delivers it once; an already-aborted call returns before starting a search; the existing retry may fire after reassignment and must leave the game unchanged. Tests must exercise these boundaries rather than demand replayed provider callbacks, cancellation at a particular layer or immediate timer removal. No turn/provider/retry production change is needed. See [the cleanup verification](#test-contract-cleanup---23-october-2026); earlier failing counts below remain historical evidence.

## Implementation sequence

| Step | Work | Completion gate |
| --- | --- | --- |
| PRE-00 | Complete and verify the separate background analysis plan | Its tests were written/failed before implementation and now pass; actual clocks/turns and selected boards have an independent verified contract |
| PRE-RAW | Board-interaction raw-submission refactor: RAW-S01-RAW-S10 tests written first, observed failing, then canonical acceptance implemented | Complete: [implementation and executed verification](ArchivedPlans/RawMoveSubmissionDesign.md#implementation-and-verification). Queue implementation remains pending |
| PRE-01 | After PRE-RAW passes, write raw queue data-boundary tests, migrate the declaration/imports, revise all raw scenario fixtures/assertions, then run premove behaviour tests before implementation | Complete on 23 October: five data-boundary tests pass; all 25 scenario IDs execute in the compiling raw/no-buttons baseline below. Behaviour remains unimplemented |
| PRE-02 | Add local `_tryPremove` after existing registration; preserve engine branch/handler/completion/successor/Resume | Trust registered request and feasible FIFO; resolve actual head once, shift then `attemptPlayerMove`. No repeat projection, owner checks or new turn runtime/driver |
| PRE-03 | Revalidate remaining FIFO before the existing successor request; add queue clearing at accepted invalidation/lifecycle boundaries | Multiple queued local/engine turns progress behind stable selection; no analysis, pause, provider, retry or pruning redesign |
| PRE-04 | Add raw opponent-turn enqueue, whole-queue projection/clear and due-turn legal resolution | Every accepted off-turn local move appends; any invalid sequence clears completely |
| PRE-05 | Derive displaced artwork/red squares and board cancellation; reuse Analyse and context cleanup | Pending: both orientations, mouse chaining, real touch/right-click/Escape, no counts/buttons, hotseat exclusion and current-remainder return |
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
| PRE-A07: history and navigation | Review/temporary menu/tab changes do not create queue suspension; actual progress continues under real clock-pause policy |
| PRE-A08: invalidating actions | Actual Takeback, rewrite, changed seat/root, terminal result and disposal drain old work and never restore old intentions on exit |
| PRE-A09: turn mechanism | Registered existing Deferred receives the shifted head through `attemptPlayerMove`; existing handler/engine/Resume/ponder behaviour and regression tests stay unchanged. Record independent hardening failures separately |
| PRE-A10: clocks/effects | Queue/display changes create no clock transition, increment, recorded analysis or autosave count; actual commits do so once, with timeout reconciliation during analysis |
| PRE-A11: drawing/input | Final displaced pieces/red union, chaining, partial consumption, board cancellation, both orientations, accessible labels and context-cancelled promotion/drag agree |
| PRE-A12: isolation/persistence | Canonical rendered/live boards, engine FEN, other games and saves never receive speculative pieces; restore has no queue and honours saved pause |
| PRE-A13: active branch lifetime | Background actual commits cannot remove/reindex the selected analysis branch or re-alias its board. A branch left at a historical anchor stays history through Exit/navigation; pruning remains limited to the existing own-current-move case |

The historical four-test paused-analysis baseline is in [BackgroundAnalysisPlan](ArchivedPlans/BackgroundAnalysisPlan.md); it is not queue evidence. The old premove run below used the superseded entry/control contract. A new red baseline and subsequent passing evidence are required; no execution is claimed by this planning edit.

During implementation run `npm run check:code`, affected unit/integration tests, `npm run build` and the focused browser scenarios. Preserve Manual/Menu pause, UCI pondering, cancellation and independent analysis-seat regressions; replace obsolete Analysis-freeze expectations. Record exact executed counts, platforms and failures; browser evidence is not native NW.js acceptance.

Update [GamesStore architecture](LowLevel/Architecture/StateManagement/GamesStore.md), [Game runtime](LowLevel/Architecture/DataInterface/Game.md), [Chessboard](LowLevel/Architecture/Presentation/Components/Chessboard.md), [state model](HighLevel/state_model.md), [engine runtime](HighLevel/engine_runtime.md), [scenarios](HighLevel/scenarios.md) and [persistence](HighLevel/persistence_contract.md) when implementation changes. Add the new flow to the [journey plan](ArchivedPlans/JourneyTestPlan.md) without relabelling old execution evidence. [Q-PLAY-001](questions/play/Q-PLAY-001-LiveProgressDuringAnalysis.md) now records the resolved background policy.

### PRE-01 unit-test baseline

**Historical, superseded contract:** this run used the previous custom entry type, expected-kind fixtures and Undo/Clear controls. Preserve it as history only, not evidence for `IMoveRaw[]` or board-only cancellation. This historical run predates the 23 October raw-contract migration and is not its test evidence.

Executed on 22 October 2026 before premove behaviour or presentation edits. All PRE-S01–PRE-S25 IDs appear in the specifications; tests remain ordinary executable assertions, with no skips, expected-failure markers, dummy production exports or test-side queue algorithms.

| Test owner | Cases | Baseline | Scope |
| --- | --- | --- | --- |
| [Premove.spec.ts](../src/state/__tests__/Premove.spec.ts) | 66 | 50 fail, 16 pass | Real store actions, held engine providers, actual/selected histories, clocks, analysis/review, both local colours, pauses, structural invalidation, persistence, readiness, duplicate delivery and retry cancellation |
| Existing [GameRuleUtility.spec.ts](../src/utility/__tests__/GameRuleUtility.spec.ts) | 19 added | 4 fail, 15 pass | Frozen speculative piece-candidate queries in the existing rule owner; actual legality and detail generation reuse the existing rule functions for king safety, castling, en passant, captures and all promotions |
| [PremoveView.spec.ts](../src/views/__tests__/PremoveView.spec.ts) | 54 | 28 fail, 26 pass | 33 plain projection cases plus 21 mounted input cases. Compare actual piece components/accessibility labels, full displaced piece maps and exact red squares; cover both orientations, input/PV routing, controls, stale gestures, hotseat, rewrite confirmation and tab close |

[PremoveScenario.ts](../src/state/__tests__/PremoveScenario.ts) holds the state scenario/event/expectation table; [PremoveProjectionScenario.ts](../src/state/__tests__/PremoveProjectionScenario.ts) holds board/intent/output examples; [PremoveFixture.ts](../src/state/__tests__/PremoveFixture.ts) holds raw intentions and sparse rule positions. State events invoke existing public actions and captured provider callbacks rather than editing actual paths to imitate queue execution. The runner checks expected actual/selected move sequences with the real legal generator before executing each fixture. Canonical clocks, history, serialization and chess rules are real; only external engine/platform providers and time are controlled. Mounted tests isolate view delegation from store behaviour, which the state suite tests separately. Frozen queue entries and canonical-board comparisons prevent projection getters from editing accepted intentions or canonical pieces.

Of the **82 failures**, **six** are explicitly identified missing planned boundaries: four speculative-candidate assertions against `GameRuleUtility` and two queue-edit action assertions. The other **76** expose behaviour: three rejected off-turn submissions, 26 missing queued commits, 16 missing whole-queue cancellations, 28 drawing/input/control failures, and one each for duplicate provider delivery, startup after readiness cancellation and an uncancelled retry timer. The planned candidate function is looked up from the existing `GameRuleUtility` module, so its absence does not prevent module loading. No fixture-legality, TypeScript or setup failures were observed. The 57 passing new cases cover existing due-move rules, canonical fallback, analysis, permissions and persistence; they do not establish queue execution.

The same run passed all **146 existing regression tests**: the original 40 GameRuleUtility cases plus 106 in PremoveData, BackgroundAnalysis, GamePositionComposable, SerializationService, EngineRuntimeService, GameView and Chessboard. Overall: **285 tests, 203 passed, 82 failed**, with no skipped/todo cases. The JSON execution report is generated at `test-results/PremoveScenarioRed.json` (ignored test output). `npm run type-check`, `npm run check:code` and `git diff --check` pass. Production sources and APIs are unchanged.

To rerun the new specifications and existing rule regressions:

```sh
npm run test:unit -- run src/state/__tests__/Premove.spec.ts src/utility/__tests__/GameRuleUtility.spec.ts src/views/__tests__/PremoveView.spec.ts --maxWorkers=2
```

This is the intended focused command after the raw-contract/test migration. The fresh raw-contract run is recorded separately below. Browser gestures/focus and visible background progression require separate actual journey evidence. Native NW.js engine/ponder acceptance requires its own real platform run; mocked protocol tests cannot establish it.

### Raw-move scenario baseline - 23 October 2026

The user requested the flow update and unit tests, then clarified that "markRaw" meant the **raw move refactor**. No Vue `markRaw` change or premove behaviour implementation was requested or made. The only production change is replacing the obsolete `IPremove` declaration with `IPremoveQueue.moves: IMoveRaw[]`. Existing raw submission, canonical acceptance and game APIs remain unchanged.

The fixtures now use bare coordinates/explicit promotion, without an expected-kind argument, full-move cast or duplicate union. Obsolete wrong-stored-kind cases now test actual source geometry. Whole-queue board right-click/touch/Escape replaces all Undo/count/button requirements. Mounted tests use the actual modal provider and body-mounted chooser/confirmation, preserving input lifecycle and canonical board identity.

| Test owner | Cases | Executed baseline | Scope |
| --- | --- | --- | --- |
| `PremoveData.spec.ts` | 5 | 5 pass | Exact shared raw-array type, no wrapper/anchor, exact seated-player reference, save exclusion and hydration isolation |
| `Premove.spec.ts` / `PremoveScenario.ts` | 85 | 30 pass, 55 fail | Raw append/copy/frozen metadata, both local colours/Black's first move, cancellation around commits, promotion dependencies, due special moves, whole invalidation, background analysis/review, real layered pauses, Takeback/rewrite, clocks/results, provider ownership/retry and persistence |
| `GameRuleUtility.spec.ts` additions | 37 | 17 pass, 20 fail | Plain frozen source/geometry/pawn/castling candidates in the existing rule owner, and actual legal/detail resolution including every promotion choice. Its 40 pre-existing tests all pass |
| `PremoveView.spec.ts` / `PremoveProjectionScenario.ts` | 79 | 36 pass, 43 fail | Complete displaced piece maps/red unions, canonical fallback without getter mutation, both orientations, raw gestures/PV source parity, whole board cancellation, mounted promotion/history cancellation, stale input, current-remainder ownership and tab close |

All **PRE-S01-PRE-S25** appear in the executed specifications. Of **118 failures**, **96 expose missing behaviour**, **20 identify the missing generic candidate query**, and **two identify the missing `clearPremoves` boundary**. The missing APIs are queried through existing owners, so they do not prevent module loading. No missing imports, TypeScript/setup/fixture failures, skipped/todo/expected-failure tests or unhandled errors establish this baseline. The passing permission/invalidation-input/canonical-fallback cases do not prove queue execution.

The same run passes **203 existing regression tests** across the original chess-rule cases, RawMove, BackgroundAnalysis, GamePositionComposable, EngineRuntimeService, SerializationService, GameView and Chessboard. Including five data-boundary cases and 201 scenario/rule specifications, the total is **409 tests: 291 pass, 118 fail, zero skipped/todo**. The report is `node_modules/.tmp/premove-verification/PremoveRawScenarioFinal.json`; the adjacent `.log` records the invocation. `npm run type-check`, `npm run check:code` and `git diff --check` pass. Browser/native engine acceptance remains pending behaviour implementation.

```sh
npm run test:unit -- run src/state/__tests__/PremoveData.spec.ts src/state/__tests__/Premove.spec.ts src/utility/__tests__/GameRuleUtility.spec.ts src/views/__tests__/PremoveView.spec.ts src/state/__tests__/BackgroundAnalysis.spec.ts src/state/game/__tests__/GamePositionComposable.spec.ts src/state/__tests__/RawMove.spec.ts src/domain/__tests__/SerializationService.spec.ts src/domain/__tests__/EngineRuntimeService.spec.ts src/views/__tests__/GameView.spec.ts src/components/__tests__/Chessboard.spec.ts --maxWorkers=2 --reporter=json --outputFile=node_modules/.tmp/premove-verification/PremoveRawScenarioFinal.json
```

## Rollback and revised-plan verification - 23 October 2026

The user requested rollback because premoves should answer an ordinary turn request through the existing API. Restored every production change from the rejected implementation to the pre-implementation baseline, including `GamePlayerTurnComposable`, `GameMoveComposable`, `GameClockComposable`, `GamesStore`, contracts, rules and UI. The completed raw-move refactor and `IPremoveQueue.moves: IMoveRaw[]` are part of that baseline and remain. No premove production behaviour was developed for this revision. The separate staged dependency-restructuring plan was left untouched.

Retained scenario/rule/mounted/browser specifications. Removed only the additional provider-acknowledgement-before-commit test that required the rejected resolver design. The released-rewrite test now holds the existing pending-handler settlement boundary, and passes without changing production code. The retained browser case is marked partial/pending; earlier browser passes apply only to the reverted implementation. Browsers were not rerun against this unimplemented design.

| Executed lane | Result | Evidence/limits |
| --- | --- | --- |
| Existing raw-move, background-analysis, store, result, clock, player-assignment, recovery and registry regressions, plus FIFO data boundary | 131 distinct tests pass after registry correction | `node_modules/.tmp/premove-verification/RevertedTurnRegression.json`: 130/131 initially passed; the sole failure was retained JRN-RACE-09 referencing absent SCN-MOVE-04. Added the planned scenario, marked the case partial and reran registry 2/2 green in `RevertedJourneyRegistry.json` |
| Retained premove/rule/mounted/data specifications | 250 tests: 131 pass, 119 fail, no skips or unhandled errors | `RevertedPremoveScenario.json`: state 31/87 pass, mounted 38/81, rules 57/77, data 5/5. Includes known missing feature boundaries/behaviour and the three independent original-turn hardening failures listed above; this is a red baseline, not feature acceptance |
| Static checks | Pass | `npm run type-check`, `npm run check:code`; production turn/move/clock/runtime sources match the pre-implementation baseline |

The additional request/shift/paused-handler tests listed above are part of the next tests-first implementation step, before production edits. This plan does not claim they have been written or executed.

## Definition of done

Completion requires behaviour implementation approval to implement behaviour, the completed PRE-RAW prerequisite, a subsequent meaningful failing premove baseline, and passing affected unit/browser/static checks after implementation. Canonical positions exclude premoves; copied artwork shows final destinations/red endpoints. Eligible off-turn input appends, actual play continues during analysis/review, real pauses retain output without commits, Takeback affects actual play and invalid accepted dependencies clear the whole queue. Board cancellation uses right-click/touch/Escape with no counts/buttons. Record exact executed evidence and limits; this planning edit is not completion.


## Implementation verification - 23 October 2026

Implemented after the user's explicit approval. `_appendPremove` initialises/pushes the supplied raw reference and publishes. `_tryPremove` is a small Local dispatch after existing request registration: actual legal matching, fresh details, one shift and immediate `attemptPlayerMove`. Existing pending/deferred types, handler, engine branch, successor requests, Resume flush and retry/ponder implementation remain intact.

Rendering uses canonical selected state plus one detached queue projection, with red source/destination endpoints and castle rook endpoints. Analysis/history retain canonical input and background progression. Right-click, owned Escape and touch cancel the whole queue; no count/list/buttons. Actual commits revalidate the whole remainder before successor dispatch; accepted structural/terminal boundaries clear it. Temporary navigation retains it; save omits it; scope disposal cleans owned resources.

Tests were adjusted to the approved trust/reference contracts before production implementation. Removed append-time movement/owner rejection and drawing-time invalid-data rejection requirements; producers own those boundaries. Kept chess candidate/actual legality checks, post-commit whole-queue rejection, raw canonical enrichment and all 25 scenario IDs. Stable move objects now remain identical through panel/view/confirmation/playback/queue. The final coverage audit restored pause/history rows removed by an overbroad test edit. No skipped/todo/expected-failure tests mask the three retained hardening findings.

| Executed scope | Result | Evidence |
| --- | --- | --- |
| Selected pre-implementation state/turn/mounted run | 126 tests: 30 pass, 96 fail | `node_modules/.tmp/premove-verification/before.json`; includes missing behaviour and the new internal projection API. The earlier compiling raw/rule baseline above remains separate evidence |
| Initial implementation unit/application suite | **857/860 across 97 files**, zero pending | Historical: `node_modules/.tmp/premove-verification/final-unit.json`. All PRE-S01-PRE-S25 IDs occur in executed tests. State 69/72, mounted premove 61/61, FIFO data 5/5, internal turn/projection 4/4, chess rules 77/77; other regressions pass. Superseded by test cleanup below |
| Final mounted view and raw transport checks | 89/89 | `node_modules/.tmp/premove-verification/final-view.json`; direct single offered off-turn move and shared raw references |
| Real browser journeys | **48/48** broader regression, plus **6/6** final premove rerun, zero failed/skipped/flaky, no retries | Broader report: `node_modules/.tmp/premove-verification/final-browser-regression.json`; final rerun: `test-results/JourneyResults.json`. Ports 5573/5574, one worker. All engine-races cases including six JRN-RACE-09 cases, analysis Suggestion, promotion Gesture and Cancellation. Scripted UCI clients exercise production browser/runtime flow; native NW.js is not claimed |
| Audit, TypeScript and production build | Pass | `npm run build`, including `npm run check:code`; no observers/counters/component styles introduced |

The initial run retained three failures concerning duplicate mocked callback delivery, readiness completion after cancellation and the registered retry timer. They predated implementation and were reported without changing the approved resolver/provider/retry mechanism. The subsequent test-contract review below corrects their assumptions; these initial results do not describe the current suite.

The browser initially exposed a render between opponent publication and shifted-head handler settlement. A focused mounted test first reproduced the exception; `renderedBoard` now waits for the existing Local handler before projecting its tail, as recorded in PRE-F03. Subsequent browser reruns are clean. No recovery validation was added to the pure projection and no turn runtime/API changed.

## Test-contract cleanup - 23 October 2026

The user requested cleanup of the three failing tests. Review against `EngineRuntimeService.startPlayerTurn` corrected the earlier classification: these were unsupported test assumptions, not demonstrated production defects. Production files, turn resolution and timer ownership were left unchanged. All three cases remain executable tests, with no skip/expected-failure markers.

| Earlier assumption | Corrected test |
| --- | --- |
| An engine-service test double may replay its completed callback into the following Local turn | The real service awaits one result and delivers once; existing real-service coverage verifies that contract. The state case now exercises repeated wake actions on the waiting Local turn, retaining its Deferred and proving ordinary input still commits once |
| Cancelling readiness must prevent every call to `startPlayerTurn` | The service accepts an already-aborted signal and returns before starting a search. The mock now honours that boundary. The test asserts the old owner is aborted, no search starts, the replacement Deferred/snapshot survives late readiness, and a normal local move still works |
| Removing an engine must immediately unregister the existing retry timer | Advance the already-scheduled retry after removal; assert it drains without another readiness attempt/search or any game change |

The focused premove, internal turn and real engine-service run passes **109/109**, in `node_modules/.tmp/premove-verification/test-cleanup-focused.json`. The failing state baseline remains in `test-cleanup-before.json` (69/72). The code audit and all TypeScript projects pass. Earlier browser evidence remains applicable because this cleanup changes only tests and documentation; browsers were not rerun.

The complete rerun passes **860/860 tests across 97 files**, including **72/72 state premove cases** and all **PRE-S01-PRE-S25** IDs, with zero pending tests. Report: `node_modules/.tmp/premove-verification/test-cleanup-unit.json`. No failing-test exception or pending turn-hardening work remains from these three assumptions.


## Reactive workspace follow-up - 23 October 2026

The approved [workspace counter removal](WorkspaceRevisionRemovalPlan.md) supersedes the publication mechanism in historical verification above. The current function flows now use canonical reactive games and shallow-reactive move arrays, preserving exact supplied entries. Queue/held-output writes drive drawing; timestamping only records metadata. No post-handler publisher or turn-resolution change is required. All **PRE-S01-PRE-S25** still execute in the final **866/866** unit run across 98 files; the linked record includes browser/static verification.
