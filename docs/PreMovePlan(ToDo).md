# Premove and player-turn flow plan

Updated on 22 October 2026. **Status: background analysis and the [premove data structure](PremoveDataStructure.md) are implemented separately; premove behaviour/presentation implementation has not started.** The runtime data contract now supports plain-data fixtures for the test-first work below. See the [background analysis verification record](BackgroundAnalysisPlan.md#implementation-and-verification) for its executed checks. The [decision/scenario record](questions/play/Q-PLAY-002-PremoveAnalysisConflicts.md) retains the resolved product choices. Follow [AGENTS.md](../AGENTS.md) and the [code cleanup plan](CodeCleanupPlan.md).

The [function flow](#function-flow) and [25 concrete scenarios](#concrete-scenarios-for-unit-tests) are restored in this plan, rather than requiring the reader to reconstruct them from the separate analysis plan or conflict record. The [data-driven test specification](#data-driven-unit-test-specification) defines fixture inputs, events and assertions. This revision changes documentation only; the flows below describe subsequent premove implementation, not existing behaviour or executed premove acceptance.

## Prerequisite and tests-first order

The [background analysis plan](BackgroundAnalysisPlan.md) has delivered analysis clocks, selected-position isolation, actual background-turn scheduling, active-branch pruning, analysis controls and old paused-state compatibility. This plan consumes those verified actions. Explicit analysis moves/history also remain permitted during genuine pauses, while actual commits stay paused, as confirmed in [Q-PLAY-003](questions/play/Q-PLAY-003-PausedAnalysisEntry.md).

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
| [Game runtime](../src/contracts/Game.ts) | Runtime premove FIFO data contract, three pending-turn fields and one `deferredPlayerMove` slot | Integrate the FIFO with one current-turn owner; no speculative future-turn promises |
| [Player turn](../src/state/game/GamePlayerTurnComposable.ts) | Existing shared local/engine current-turn delivery; analysis prerequisite already removed the selected-board arming gate | Add ordered future local input while preserving one actual-turn owner and the verified background API |
| [Game view](../src/views/GameView.vue) | Explicit analysis/review are already distinguished; no premove drawing/input exists | Enable own-piece off-turn queue gestures and derive displaced pieces/red squares |
| [Engine runtime](../src/domain/EngineRuntimeService.ts) | Validates actual/ponder moves at the searched position | Preserve legality/protocol ownership and bind result delivery to the captured actual turn |
| Pause/recovery | Prerequisite owns real pause/old saved-analysis compatibility | Retain the new queue across genuine pauses without another pause policy |

The old note's pending-promise equality guard was already removed by the cleanup. Do not reintroduce it. Duplicate-turn prevention, owned cancellation/draining and the queue replace that concern.

The former analysis mismatch and four-test baseline are historical prerequisite evidence. The implemented queue contract and its save/hydration boundary tests do not establish enqueue, consumption, projection or cancellation behaviour. Specify these against the concrete flows below before implementing them.

## Position, queue and input ownership

Keep the existing concepts small:

- `livePosition`/`livePath`: the actual game and its current turn.
- `renderedPosition`/`renderedPath`: the canonical selected live/history/analysis board, without premoves.
- Displayed pieces/red squares: a pure derived result of the rendered board plus the queue when showing the live gameplay board. A small helper returning copied squares and highlight IDs is sufficient; no third persisted game position or separate engine position is needed.
- Runtime queue: one FIFO for the human seat in a human-versus-engine game, bound to the actual continuation and seat. Local-local and engine-engine games have no human premove queue.
- Current turn: captures actual parent node, colour/player, abort controller, completion and provider work before asynchronous startup begins.
- Input/analysis session: owns the selected node, unfinished drag/promotion or playback and the explicit mode. Queue entries outlive component remounts; unfinished gestures do not.

The implemented [data contract](PremoveDataStructure.md) is `game.$.premoveQueue?: IPremoveQueue`: an exact seated `player` and ordered `moves: IPremove[]`. Its base is always the game's current actual live position; there is no duplicated node/path/FEN anchor to synchronise. Entries contain raw `from`, `to`, optional promotion and expected own piece kind; queue ownership supplies colour and FIFO order supplies dependencies on preceding intentions. Do not store future capture/check/notation metadata as an accepted `IMove`. The eventual opponent replies are unknown; an intention's target is its next actual local turn on the same continuation, not a predicted exact FEN. Structural invalidation belongs to the existing explicit action boundaries.

Replace `pendingPlayerTurnPromise`, `pendingPlayerTurnHandlePromise`, `pendingPlayerTurnAbortController` and `deferredPlayerMove` together. A single internal `Deferred` may still represent current-turn completion. Accepted paused engine output belongs to that actual turn; it is not an editable local premove or a competing resolver.

Publish runtime queue changes through the existing raw-game rendering boundary without changing persisted `metadata.updatedAt` or the move/autosave count just for preview edits. A computed projection must preserve identity across unrelated evaluation publications so new scores do not cancel an unfinished gesture.

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

## Function flow

Names without a qualifier below are existing functions in the linked source owners. Names prefixed with `_` and the three pure chess functions are **planned implementation responsibilities** where they do not already exist; none is claimed implemented by the data-structure work. Keep the existing move/analysis/clock/history entry points and add only the raw-input/edit boundaries needed by premoves. No new `GameState`, persisted field, watcher, invalidation counter or future-turn promise is needed.

### Planned call boundaries

| Boundary | Contract for writing tests |
| --- | --- |
| Existing `GamesStore.makeMove` / `GameMoveComposable.makeMove` | Keep the action name and immediate-move completion. Plan the smallest additive input union, `IMove \| IPremove`, so off-turn input can carry raw intent without invented capture/check/notation. Current callers supplying `IMove` remain valid. This extension is planned, not present in the current signature |
| Planned `undoPremove(game)` / `clearPremoves(game)` | Queue-only store actions for explicit controls. They publish runtime changes and never invoke actual Takeback. Internal invalidation calls the same private clearing operation without requiring a visible live board |
| Planned `projectPremoves(position, colour, moves)` | Pure whole-sequence projection: copied piece array plus unique `redSquares`, or `undefined` if any intention cannot project. Empty input returns canonical pieces/no red squares. No canonical position/queue mutation |
| Planned `genPremoveTargets(position, colour, moves, from)` | Pure own-piece speculative targets after projecting the existing FIFO; raw intentions include expected piece kind and explicit promotion alternatives. Does not change canonical `sideToMove` or relax normal legal-move generation |
| Planned `resolvePremoveMove(position, colour, intent, lastMove?)` | Pure due-turn resolution: matching actual legal detailed `IMove`, or `undefined`. Uses actual turn, expected source kind/colour, last actual move and exact promotion |
| Existing `requestPlayerMoveIfNeeded` / `attemptPlayerMove` | Retain current-turn entry responsibilities while moving scheduling to one private serial drain. Provider delivery is bound to the captured turn; ordinary local input still observes its actual commit |
| Existing `commitLiveMove`, pause/resume, analysis/history and structural actions | Reuse their canonical effects. Add explicit queue validation/consumption/cancellation at the boundaries below; do not rewrite the completed analysis feature |

The raw-intent union, queue-edit actions and pure helpers are the small premove-specific additions to plan against. They are distinct from the earlier API-preserving analysis prerequisite. Do not write tests requiring a new review mode, speculative `IMove` records, per-colour queues or a replacement serialization API.

### PRE-F01 - Classify input before submitting it

`Chessboard moveAttempted / AnalysisPanel moveSelected -> GameView._makeMove/_playAnalysisLine -> _requestMoves -> GamesStore.makeMove -> GameMoveComposable.makeMove`.

1. Reject stale selected-input owners before routing. Read explicit analysis from existing game state, actual turn from `getLivePosition`, selection following from `renderedPath === livePath`, and human/engine seats from the game.
2. Free/terminal analysis and explicit Analyse use existing legal analysis routes. Explicit paused analysis remains enabled. Neither branch reads, appends, consumes or clears the background FIFO.
3. Ordinary history input keeps `_requestMoves -> pendingContinuation -> _confirmContinuation -> _commitHistoryRewriteMove` only when Takeback is allowed. Otherwise it stays disabled/rejected until Analyse. Never reinterpret a historical source as live premove input.
4. Following-live ordinary input must be ongoing and genuinely unpaused. A local seat due now submits one actual move; human-versus-engine input during the engine turn goes to PRE-F02. Local-local input is only for the due side; engine-engine input cannot create a queue.
5. A due queued head takes priority through PRE-F04; stale direct input cannot replace it or resolve the next actual turn. There is no off-turn replace/Play now choice.

**Assertions:** routing changes only the intended actual board, selected branch or queue; forbidden modes/colours have no canonical or queue side effects. The store repeats capability checks rather than trusting a disabled control.

### PRE-F02 - Append raw intention to the FIFO

`PRE-F01 off-turn branch -> planned Turn._appendPremove -> Position.getLivePosition -> projectPremoves/genPremoveTargets -> queue mutation -> runtime publication`.

1. Verify ongoing ordinary following-live gameplay, no real pause, exactly one local and one engine seat, the engine due, and a completed raw move from the local projected piece. Copy only `from/to/movingPiece/promotionPiece`; discard any supplied detailed-move/runtime metadata.
2. For an existing queue, require its `player` to be the exact seated local object and validate its existing sequence on the current actual live position. Ownership mismatch or an already-invalid sequence clears that entire queue and rejects the obsolete submission; it does not silently rebind it.
3. Validate the candidate **with the existing sequence** on the current actual board before mutating it. An invalid new target/promotion rejects that candidate and preserves a valid old queue. This differs from discovering that already-accepted entries became invalid in PRE-F06.
4. On first append set `game.$.premoveQueue = { player: localSeat, moves: [copiedIntent] }`; on later append push onto the same FIFO. No per-entry ID, node anchor, predicted FEN, extra colour or dependency graph is stored.
5. Publish the runtime change and acknowledge immediately. Leave the current engine provider, actual turn owner, actual/rendered positions, history, clock and move/autosave count untouched. No future completion is awaited.

**Assertions:** append twice preserves FIFO order and the exact seated-player binding. The second source may be the first destination. Canonical serialization and actual search count remain unchanged.

### PRE-F03 - Derive displaced pieces, targets and red squares

`GameView selected-board projection -> projectPremoves(canonicalPosition, queue.player.colour, queue.moves) -> Chessboard piece artwork + red squares`; next own-piece gesture uses `genPremoveTargets` on the same canonical base and complete FIFO.

1. Copy the canonical piece array; walk intentions in order with private speculative piece/castling state. At each step require the expected local kind/colour and allowed geometry, destination and blockers. Move the projected piece, apply the chosen promotion, and move the rook for castling. Track local king/rook moves so rights cannot revive later in the sequence.
2. Pawn empty diagonals express a possible future capture. Do not invent an en-passant victim or capture metadata where the actual base supplies no such fact. Slider paths/friendly occupancy remain real projection constraints; future opponent replies are not simulated. King safety/check is resolved only when due.
3. Collect the union of every pending source/destination at one opacity, including vacated intermediate squares. Include the rook's source/destination for castling. Return the final copied pieces and unique absolute board IDs; orientation only changes drawing order.
4. Show that result only when the selected board follows live gameplay. Explicit analysis/review shows canonical selected pieces with no premove red fill. Queue execution is independent of this display condition.
5. An invalid projection returns `undefined`, with no partial public prefix and no mutation from a computed getter. PRE-F02/PRE-F06 validate and clear at explicit action boundaries. Defensive rendering uses the canonical board if invalid fixture data reaches it.
6. Preserve display/input identity across unrelated score publications when canonical selected board, queue contents and input capability are unchanged. Queue edit, actual base change, mode/permission/result change replaces the input context and cancels unfinished gestures through the existing external-prop reset boundary.

**Assertions:** `g1-f3-f3-g5` leaves the knight on g5 and red IDs `{6,21,38}`; canonical FEN/caches, captures and engine positions remain unchanged. A later invalid dependency yields no partial display result.

### PRE-F04 - Wake and drain the actual turn once

`activation / accepted actual input / provider result / actual commit / final real Resume / eligible retry -> requestPlayerMoveIfNeeded -> planned Turn._drainTurns -> commitLiveMove -> next iteration`.

1. Join owned drain work rather than start a competing loop. Serialise explicit state-changing actions and preserve a wake arriving while a drain finishes. This is action/work ownership, not a generation counter or polling loop. Never hold the action lane while waiting for an engine result.
2. Reconcile actual expiry. Stop for ended/disposed/transitioning context. Attach one current-turn owner from the actual parent node, colour and seated player before any asynchronous readiness/provider start; its accepted result and completion belong to that actual turn.
3. If a genuine Manual/Menu pause applies, retain the owner/result/queue and stop without consuming any intention. Analyse, history and another displayed game are not pause predicates.
4. Validate any queue's human-versus-engine capability and exact seated-player binding. For an eligible local turn, call `projectPremoves` on the entire current queue using the current actual live position, then resolve its head using PRE-F07. Invalid data clears the queue and leaves the local turn waiting. With no queue/result, wait for normal local input; its clock continues. An ineligible queue never blocks an actual engine turn from starting.
5. For an engine seat, start its captured provider once, then return while it thinks. Provider delivery uses PRE-F05. Duplicate wake requests cannot start another search.
6. Commit an accepted actual move synchronously through `commitLiveMove` while its owner remains attached. Apply queue post-commit changes in PRE-F06 **before** evaluating the successor. Stop on terminal result; otherwise retire/drain the old delivery owner and iterate for the next actual turn.

Remove independent successor arming from `_finaliseLiveMove` and the separate resume flush path when this driver is integrated. Entry/Exit never become scheduler/flush actions. Existing immediate `makeMove` calls still complete after their actual commit; enqueued input completes after append only.

**Assertions:** a sequence produces `engine reply -> one local head -> next engine search`, including behind analysis/review, with one actual node/increment per committed move and one provider per actual engine turn.

### PRE-F05 - Deliver an engine reply to its captured actual owner

`Turn._requestPlayerMove/_requestEngineMove -> EngineRuntimeService.ensureReady/startPlayerTurn -> awaitPlayerTurnMove(searchedPosition) -> planned Turn._acceptProviderMove(capturedTurn, move) -> PRE-F04`.

Capture/retain actual parent, player, position and abort ownership before readiness. After readiness, an aborted/replaced owner cannot begin its provider. Preserve `EngineRuntimeService.awaitPlayerTurnMove` as the actual engine/ponder legality boundary; selected analysis and speculative pieces never supply its position.

Accept one result for that captured turn. A duplicate or cancelled delivery does nothing and cannot claim the successor. The callback acknowledges acceptance without awaiting a future Resume/commit of the same provider; the drain settles delivery outside the callback, avoiding a cycle where each awaits the other. During a real pause the result stays owned and uncommitted.

Long-lived pondering remains engine-owned. Current `startPlayerTurn` ends by awaiting its `pondering` work; inspect/separate that private completion responsibility if necessary so retiring the delivered actual turn does not wait for an ongoing ponder search. Keep the existing engine-client stop/hit/miss ordering, handle failures and avoid repeated pondering on Resume.

**Assertions:** release a reply before/after pause, deliver it twice, abort during readiness and release it after reassignment; only the current captured owner may cause one actual commit. Native ponder acceptance needs its own executed platform lane.

### PRE-F06 - Rebase or consume after a real commit

`commitLiveMove -> _applyLiveMove/_finaliseLiveMove canonical effects -> planned Turn._rebasePremoveQueue(game, consumedHead?) -> getLivePosition/projectPremoves -> runtime publication -> PRE-F04 successor`.

1. Read the game's current actual live position and require any queue's player to remain its exact eligible local seat. Structural changes clear the queue at PRE-F12; queue revalidation does not reconstruct or compare a stored continuation anchor.
2. If this was its due local head, remove **that head only after successful actual commit**. Remove the queue if now empty. Do not reproject the consumed entry from its now-vacated source.
3. For an opponent commit, remove no entry. For either commit type, project the whole remaining sequence from the **new actual board** before letting another local intention execute. If the new state is terminal, clear all remaining entries instead.
4. If any remaining source/dependency/path fails, remove the whole queue immediately, including an otherwise-valid head. Keep every move already committed. Otherwise retain the same queue, exact local seat and remaining order; no queue-side node bookkeeping is needed.
5. A rebase does not use or change `renderedPath` to decide eligibility. An independently selected canonical board/analysis branch stays selected; only following-live aliases advance with actual play.

**Assertions:** revalidation uses the new actual live position; failed actual commit/timeout consumes no head, terminal cleanup never restores one, and an invalid second entry prevents the otherwise-legal first entry from being played next.

### PRE-F07 - Resolve the next due intention on the actual board

`PRE-F04 local turn -> resolvePremoveMove(actualPosition, localColour, head, actualNode.move) -> genLegalMovesForPiece -> exact raw/promotion match -> toDetailedMove(actualPosition, candidate) -> current-turn acceptance -> commitLiveMove`.

Require the actual side due and expected source kind/colour. Match legal candidates for `from/to` and exact promotion; never default a queued underpromotion to a queen. A missing candidate clears the whole queue through the caller and leaves the actual turn waiting. Do not skip to a later intention.

Actual candidates determine capture, en-passant victim, castle legality, check/pin/king safety, ambiguity and notation. The speculative picture supplies no accepted move metadata. Reconcile clock expiry at commit so a legal queued move cannot rescue an expired turn or acquire an increment at the deadline.

**Assertions:** intended diagonal succeeds only if an actual legal capture/en-passant exists; opponent king attacks/check can invalidate a projected king/castle move; every promotion kind resolves exactly; actual capture changes are recorded from this board.

### PRE-F08 - Publish a queue edit without a canonical move

`append / Undo / Clear / rebase / invalidation -> planned GamesStore._publishRuntimeChange -> workspaceRevision`.

Extract the existing shallow publication increment from `_touchGame` into one private runtime publication helper; canonical `_touchGame` continues updating `metadata.updatedAt` and publishing. Queue-only actions use the runtime helper, not `_moveCommitted`, analysis refresh, clock operations or autosave thresholds. A real commit retains its established history/clock/recording/autosave effects once; any combined queue publication does not duplicate those effects.

**Assertions:** queue-only edits preserve canonical serialized bytes, metadata timestamp, clock, actual history and search starts while making the new copied pieces/count/red union visible.

### PRE-F09 - Undo last intention or clear the queue

`live queue control -> planned undoPremove/clearPremoves -> current queue-edit capability check -> moves.pop() or remove runtime queue -> PRE-F08 -> PRE-F03`.

Editing requires the live gameplay context, eligible local seat, genuine unpaused state and current input owner; analysis/review has read-only queue status. Internal cancellation does not require edit capability. Last-entry removal normalises to no queue; empty operations are no-ops. Rebuild the derived picture from the canonical base and remaining FIFO instead of reversing a speculative capture. Escape cancels unfinished gesture/promotion first and only clears the queue when the live premove context owns that action.

Coordinate edit versus head claim/commit through the same action ordering: an edit accepted before claim prevents that intention from committing; once actual commit completes, later Undo affects only the remaining tail. It never invokes `takeBack` or removes a played node.

**Assertions:** after Nf3 actually commits, Undo of the remaining f3-g5 leaves the actual knight on f3 and its actual history intact. Undo/Clear while review/analysis owns input cannot silently cancel the background queue.

### PRE-F10 - Analyse, navigate history and return

`GameView input action -> playback.cancel -> existing enterInGameAnalysis/navigateToNode/exitInGameAnalysis -> canonical selection publication`; actual queue processing independently continues via PRE-F04-PRE-F07.

Do not snapshot, move or rebind the queue on entry. Analysis begins at the selected canonical move, even when live references have equal values or the live drawing was displaced by premoves. Legal exploratory moves/PV prefixes change only the selected branch. Genuine paused analysis retains its existing exploration/history permission and actual pause ownership.

Exit/Live selection uses existing `_returnToLiveNode`, selects the latest actual state, then PRE-F03 derives only the **current** remainder. No clock resume, queue replay, consumed-entry restoration or second provider start. An actual sibling appended below a selected analysis parent keeps the existing selected-branch protection; once that anchor is historical, Exit/navigation never prunes it retrospectively.

**Assertions:** queue identity survives entry and may shrink/clear while away; selected canonical board/evaluation stays anchored; return draws only surviving intentions. Background current-turn arming does not depend on rendered equality.

### PRE-F11 - Real Pause and final Resume

`pauseGame(Manual/Menu) -> existing pauseClock/state/owner set`; `provider result -> PRE-F05 retains accepted output`; `resumeGame(reason) -> remove named owner -> remaining owners? return : resumeClock/state -> PRE-F04`.

Retain the queue while paused. Do not start new off-turn submissions or execute/consume queued moves. Removing a non-final owner, Analyse entry and Exit never deliver held output. Final Resume drains the held actual result once, rebases the queue and can execute its due head/start the successor with analysis still displayed. Repeated Resume cannot replay a move or increment. An actual expiry still wins before an accepted move commits.

**Assertions:** Manual, Menu and layered owners in both removal orders; paused exploration remains legal; no actual move/search successor/increment until final Resume; one held reply is retained rather than lost to an early flush.

### PRE-F12 - Actual rewrites, changed seats, setup and results

`Takeback / confirmed rewrite / changed reassignment / root or setup replacement / result finalisation -> cancel selected unfinished input/playback as applicable -> close actual acceptance -> clear FIFO -> abort/drain old actual turn -> existing canonical action -> request eligible actual work through PRE-F04`.

Preserve no-op/cancelled actions: blocked or disabled Takeback, cancelled/stale rewrite confirmation and schema-equal reassignment do not clear a valid queue. Confirmed historical rewrite still cancels actual work before replacing its selectors; actual Takeback always chooses the live node/count even if another branch is selected. Root replacement explicitly clears the old queue before discarding the tree.

For a mate/draw caused by a real committed move, preserve that completed node and its final clock snapshot, then clear the remainder and stop successor scheduling. Timeout settles once and prevents a not-yet-committed head. Exploratory mate/draw is not an actual result and leaves the queue alone. Do not restore old intentions on later Exit, takeback-after-result or a return to equal coordinates.

**Assertions:** test cancellation before commit and after completed commit separately; stale provider/input cannot mutate a replacement; one game's structural action leaves another game's queue untouched.

### PRE-F13 - Navigation, close, save and hydrate

`menu/route/tab selection -> existing view playback cancellation and Menu policy -> retain game.$.premoveQueue`; `return -> canonical selection + PRE-F03 current remainder`.

Menu return removes only Menu; switching the displayed game alone is not a runtime queue cancellation or execution pause. Explicit tab close clears that game's FIFO and view input before `UiStateStore.closeTab`; this existing function removes only a session tab, not the canonical game. Preserve the existing actual-game lifecycle instead of inventing a game deletion/disposal API. Actual game/store disposal additionally aborts/drains resources at their real owner.

`SerializationService.serialiseGame/export -> existing schema omits $`; `deserialiseGame/insertGame -> hydrateGame creates fresh runtime -> no queue`. In-memory save/export preserves the original queue. A restored paused game reconstructs Manual ownership only, and actual work resumes solely through its existing eligible activation/Resume path.

**Assertions:** queued/consumed state stays isolated across games and remounts; close clears only the closed queue; loaded queues are absent; actual saved paths, canonical FEN, clock/result and analysis records contain no speculative data.

### PRE-F14 - Gestures, suggestions and stale input

`own-piece click/drag/keyboard -> genPremoveTargets -> complete raw IPremove -> PRE-F01/PRE-F02`; live own-turn legal targets retain the normal actual route; explicit-analysis legal targets retain the full-prefix route.

For PV targets, apply existing visibility/playability preferences. Normal due-local input keeps the existing first-actual-PV-move behaviour. In eligible off-turn input, use the clicked own-colour suggestion (the last move in the existing selected-prefix payload) as **one raw intention** and validate it against the current projected FIFO. Do not apply preceding opponent PV replies, assume they will happen, enqueue them or play a future prefix. An engine-colour clicked suggestion cannot steal that seat. Explicit Analyse retains canonical full-prefix preview validation and owned playback.

Incomplete promotion is not queued until a kind is chosen. A queue/base/mode/game/result/capability change invalidates selection, drag and pending promotion before a retained callback can submit. Unrelated evaluation and background changes behind an unchanged independent analysis board preserve its selected input. Delayed analysis playback remains owned/cancelled at its existing boundaries and never becomes queued gameplay.

**Assertions:** both colours/orientations and supported gestures agree; stale drops, promotion choices and action callbacks cannot append or commit for a new context; suggestion input follows exactly the same capability policy as board input.

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
| Explicit tab close | Clear that game's queue and view-owned input; existing `closeTab` removes a session tab, not the actual game/runtime. Other games and the existing actual-game lifecycle remain independent |
| Actual game/store disposal | Clear its queue and abort/drain resources at their actual owner; no new deletion/disposal API is inferred from tab close |
| Save/export | Persist canonical selected/live workspace; omit all queue/display/turn runtime |
| Load/restore | Empty queue and rebuilt actual ownership. Legacy saved pause remains explicit until Resume |

Queue edits never pause running clocks or change actual history. Use actual commit timestamps and existing elapsed/increment policy, with no artificial premove delay or zero-time exemption. A timeout wins over an uncommitted queue head.

## Data-driven unit test specification

The implemented `IPremove`/`IPremoveQueue` are the fixture contract. Define examples as plain data, then bind `queue.player` to the constructed game's actual local seat **after** game construction/hydration. The existing actual live selector supplies the validation base; no node reference is stored in the queue fixture.

Use the following common seeds throughout the scenarios:

| Seed | Canonical data |
| --- | --- |
| A | Standard initial root, actual history `e2e4`, White local/Black engine, Black due, rendered follows live. No real pause; provider results are held in integration tests |
| B | Standard initial root, actual history `e2e4 e7e5`, White engine/Black local, White due, rendered follows live |
| H | Same actual board/history as A, both players local. Only the due Black side owns fresh live input |
| E | Both seats engines, actual/selected context supplied explicitly; manual premoves are ineligible |
| C | A or B with explicit timestamps, remaining milliseconds and increment `0` or `2000`. No wall-clock waiting |
| R | A custom root/FEN, actual history and castling/en-passant rights for the rule under test. List the exact pieces/rights/last actual move, rather than assume a future reply |

`N1 = { from: 6, to: 21, movingPiece: Knight }` is g1-f3; `N2 = { from: 21, to: 38, movingPiece: Knight }` is f3-g5. The Black counterparts are g8-f6/f6-g4. Use enum values in TypeScript fixtures; the names here abbreviate them.

An example scenario row can be encoded as:

```ts
{
  id: 'PRE-S02',
  localColour: PlayerColour.White,
  actualMoves: ['e2e4'],
  queue: [N1, N2],
  events: [
    { kind: 'providerMove', uci: 'e7e5' }, // drain also commits the due N1
    { kind: 'undoPremove' },
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

The event interpreter is **test code**, not a new production dispatcher. `providerMove` integration events release a captured controlled provider through the real actual commit route; they must not fake progression by editing live paths or clocks. Pure projection/resolution cases supply board/intent data directly and need no promises, timers, engine processes or Vue mounts.

### Assertions and test owners

| Lane | Proposed test owner | Required assertions |
| --- | --- | --- |
| U-P: pure chess data | New `PremoveUtility.spec.ts` beside chess utility tests | Expected copied piece map, exact red-square set, target candidates and due legal move/details. Deep-freeze inputs or compare before/after; invalid suffix returns no partial projection |
| U-S: state data/actions | New `src/state/__tests__/Premove.spec.ts` using existing fixture/rule helpers | Exact queue entries/order, seated player reference, actual/selected paths and FENs, tree identities/records, result, clocks and runtime-only publication. Use actual public actions and meaningful observable failures |
| U-O: actual-turn integration | Premove state tests plus existing turn/runtime regressions | Deterministic provider acceptance/start/cancellation traces, one commit per turn, acknowledgements, pause/timeout ordering and no repeated increment/ponder. Fake only external provider/readiness/time boundaries; keep rules/history/time-control logic real |
| V: mounted input | Existing `GameView.spec.ts` and `Chessboard.spec.ts` | Automatic routing, projected artwork/targets/red IDs, controls, selected-input ownership, unfinished promotion/drag and full-prefix analysis cancellation |
| J: browser/platform | New premove journey plus affected existing Analysis/History/Clock/engine-race/Promotion checks | Actual gestures, accessible/focus layers, both orientations, visible background progression and native protocol evidence only where executed |

For every state event assert both the changed data and important untouched data. Queue edits preserve serialized canonical bytes, timestamps, history/clock/move count and analysis-search starts. Actual commits advance history, timestamps, clock/increment and recording once, while an independently selected canonical board stays unchanged. Queue cancellation never undoes already committed moves.

Write U-P/U-S cases first and record the failing baseline before premove behaviour changes. The already passing `PremoveData.spec.ts` covers only contract serialization/hydration, and the analysis tests cover only the prerequisite. Missing imports, missing methods or type errors alone are not meaningful behavioural red evidence. Add controlled U-O tests before replacing the actual-turn flow; add V/J tests for their presentation boundaries. Do not mock the projection, legal resolver or store action being tested.

### Rule fixtures required in addition to the scenario sequence

| Input data | Projection/append expectation | Due-turn expectation |
| --- | --- | --- |
| Empty source, wrong expected kind/colour, friendly destination, opposing king target, out-of-range coordinates | Reject a new candidate without corrupting an existing valid FIFO; accepted stale data detected on rebase clears the whole FIFO | Never create an actual node or resolve another seat's turn |
| Knight or king currently pinned/in check or targeting an attacked square | Speculative geometry may project; no claim of actual king safety | Resolve only if an actual legal candidate exists; otherwise clear all remaining entries |
| Bishop/rook/queen blocker introduced at an early or later step | Whole existing sequence becomes invalid; no displayed valid prefix | No due head executes if a later entry is already unprojectable |
| Pawn single/double push, blocked intermediate square, wrong direction/rank | Respect own projected movement/start rank and empty path | Recompute actual legal candidate after the reply |
| Pawn diagonal onto empty/enemy square | Allow possible capture geometry without inventing a future victim or captured-material total | Require a real capture or current en-passant candidate; otherwise whole clear |
| Castling with missing rights/rook/path; king/rook projected away and back | Missing rights/path rejects projection; preceding intentions cannot restore lost rights | Also require actual safe king/path/destination |
| Promotion to each queen/rook/bishop/knight, followed by a move of that kind | Require completed explicit choice; project its kind; unfinished choice is outside the queue | Match exact chosen kind and regenerate actual capture/check/notation |
| Same-square repeat, repeated intermediate square and multiple pieces | Geometry rejects null moves; legitimate shared squares produce one red fill | Preserve FIFO dependency order; no entry IDs or speculative nodes |
| Equal-looking cloned player or actual seat/root replacement | Reject a different player object; seat/root replacement explicitly invalidates the whole queue even if coordinates/FEN match | Whole clear, with no provider/actual mutation from the old queue |

## Concrete scenarios for unit tests

These restore all **PRE-S01-PRE-S25** from the conflict record with explicit seeds, events, function paths and assertions in the implementation plan. They are planned acceptance cases, not executed/passing premove tests. The additional rule table above supplies the per-piece and invalid-input parameterisation. Keep scenario IDs in test names so omissions are visible.

| ID | Given / when | Function path | Required data and effects |
| --- | --- | --- | --- |
| PRE-S01: chained drawing | Seed A; submit N1 then N2 during the same held Black turn | PRE-F01 -> F02 -> F08 -> F03 | FIFO `[N1,N2]`, player is actual White seat; validation reads the current live e4 position. Display Ng5, empty g1/f3; red `{6,21,38}`. Canonical knight stays g1; live/rendered paths, history, clock, timestamp and engine-search count unchanged |
| PRE-S02: consumption and Undo | A with `[N1,N2]`; release e7e5, drain N1, then Undo before another reply | PRE-F05 -> F04 -> F07 -> F06 -> F09 -> F03 | Actual line e4/e5/Nf3; one remaining N2 validated on actual Nf3 with red `{21,38}` before Undo. Afterwards no queue/red and displayed actual Nf3; played Nf3 remains history. Black successor starts exactly once |
| PRE-S03: marks, orientation and Clear | A with chained/shared-square sequence; flip orientation; Clear | PRE-F03 -> F09/F08 -> F03 | Same absolute displaced pieces/unique red set in both orientations. Clear removes queue, restores canonical drawing and does not change actual turn/history/captures/clock. Empty Clear/Undo are no-ops |
| PRE-S04: special drawing | R fixtures for speculative capture, promotion with a following promoted-piece step, and castling | PRE-F02 -> F03; F09 to cancel; F07 when due | Projection hides a target without adding actual captures; displays exact chosen promotion and both castle pieces; red includes rook endpoints. Clear restores canonical pieces. Actual rights/check/result and canonical FEN never come from projection; due resolution uses real legality |
| PRE-S05: explicit analysis entry | A with `[N1,N2]`, held actual search; press Analyse, then in a separate case only select history | PRE-F10 with PRE-F03 display switch | Analyse uses selected canonical node/position without displacement or red fill; queue/actual owner/search/clock preserved. Plain history selection does not enable exploration or edit the queue. Analysis entry itself consumes nothing |
| PRE-S06: independent exploration | S05; make legal analysis moves including coordinates that match queued intentions, while releasing actual replies | PRE-F10 independently of F05/F04/F06 | Analysis changes only its selected branch. Actual commits alone consume/rebase queue, update actual clock and start successor searches. Selected board/evaluation stays on its analysis node, including when actual and selected sides differ |
| PRE-S07: Exit before reply | A with queue; enter/Exit before delivering e7e5; repeat Exit | PRE-F10 -> F03; later F05/F04 | Return displays canonical actual board plus unchanged current remainder; no premature local move, clock resume, duplicate search or replay. Later reply still consumes one legal head through its original owner |
| PRE-S08: successive background turns | A/C with N1, N2, then f1-c4; enter Analyse or ordinary review. Release e7e5, b8c6, g8f6 in order, repeating wake/delivery attempts | PRE-F05 -> F04 -> F07 -> F06 for each turn | Actual line alternates Black reply/one White intention three times before Exit. FIFO drains in order; one provider per Black turn and one increment per mover at its commit timestamp. Selected canonical board/path remains fixed. After the subsequent Black reply, the now-empty local queue leaves a waiting actual local turn |
| PRE-S09: background invalidation | R with a queue; legal actual reply captures its intended source, adds a blocker or makes the due head illegal through check/pin | PRE-F05 -> F04 -> F06/F07 -> F08 | Opponent move commits once; whole remaining queue/red union disappears, local actual turn waits and its clock runs. No invalid local node/increment or retained suffix. Selected independent analysis/history board survives |
| PRE-S10: genuine paused analysis | A/C with queue; enter Analyse; add Manual/Menu in both orders; deliver actual reply; remove non-final then final owner | PRE-F10 -> F11 -> F05 -> F11/F04 | Queue and accepted reply retained; paused analysis moves/history still work. No actual commit/consumption/increment/successor while any real owner remains. Final Resume commits reply/head and starts successor once without requiring Exit; repeated Resume is ineffective |
| PRE-S11: ordinary review | A with queue; select an old/sibling node, release multiple actual replies, then return live | PRE-F10 + F04-F07 -> F03 | No queue editing from review, but valid queued moves continue. Canonical selected node remains stable, actual status/progression and read-only remainder may update. Return projects current remainder only, never entry-time consumed entries |
| PRE-S12: selected historical anchor | Actual line has several plies; queue belongs to the actual live game. Select earlier node and explicitly Analyse with Takeback allowed and disabled | PRE-F01 -> F10 | Analysis anchor is that historical canonical node. Exploratory board/PV moves do not open rewrite confirmation or append/clear queue. Queue validation still uses the actual live position, not selected history; actual progression continues |
| PRE-S13: confirmed rewrite | A progressed beyond selected historical prefix with queue; request allowed history continuation, cancel, reopen/confirm; also deliver stale confirmation after mode/node change | PRE-F01 -> existing confirmation -> F12 | Cancel/stale/disabled confirmation preserves queue and actual game. Valid confirmed rewrite cancels FIFO and old actual provider before replacing selectors, retains played variation, relocates selection safely and starts only eligible replacement actual work. Old callback cannot commit |
| PRE-S14: actual Takeback | Analyse away from actual live node with a queue; try disabled/paused Takeback, then an allowed live Takeback during thinking and after a reply | PRE-F12 -> existing live-node/count rewind | Blocked action leaves queue intact. Allowed action clears queue and rewinds actual history/count/clock, never just the selected analysis branch. Pending output is drained; invalid selected path/input relocates. Undo last intention remains PRE-F09 and cannot remove played history |
| PRE-S15: suggestion routing | Move-enabled/score-only fixtures; choose own-colour suggestion on own turn, opponent turn, history and explicit Analyse; try engine-colour input | PRE-F14 -> F01 -> F02/F04/F10/F12 | Own due input commits one move, off-turn input appends one intention, explicit analysis plays selected legal prefix, ordinary history retains confirmed rewrite policy. No opponent PV replies enqueued, implicit replacement or theft of engine turn; visibility preference stays independent |
| PRE-S16: active branch lifetime | From current actual parent, enter Analyse/explore descendants; actual reply/head advances while selected; Exit, navigate, save/reload. Separate case exits before any actual advance | PRE-F10 + F04/F06; existing prune boundary | Selected analysis descendants are protected while actual siblings append. Once anchor is historical, branch remains through Exit/navigation/persistence. Existing current-parent temporary prune applies only to its already-defined next actual move case; no release/Exit cleanup registry or ancestor blanket prune |
| PRE-S17: hotseat exclusion | H; White commits e4 and Black becomes due; retain White-owned click/drop/promotion/Analyse callbacks, then send fresh Black input; repeat colours/orientations. Also use E | PRE-F14 -> F01; F02 capability rejection | No queue in H/E. Old context callbacks have no effect; fresh hotseat input/Analyse belongs to currently due side. Direct state-action tests also reject off-turn wrong-colour intents; no person-authentication or two-colour queue is introduced |
| PRE-S18: unfinished input | A/R with drag or unfinished promotion; change actual base, queue via Undo/Clear/rebase, mode or route; separately publish only evaluations. During delayed analysis prefix Exit/receive actual result | PRE-F14 -> selected-input reset/cancel; F09/F10/F12/F13 | Obsolete gesture/promotion/PV cannot append or commit into new ownership; incomplete choice never entered queue. Completed entries survive non-invalidating navigation/analysis. Mere evaluation behind unchanged selected board preserves valid input; result/context replacement stops delayed playback |
| PRE-S19: navigation and close | Two games with separate queues; visit Settings with Menu pause on/off, switch tabs/return, then explicitly close one tab | PRE-F13 with F11 as applicable | Temporary navigation retains/executes queues unless a genuine pause applies. Return draws surviving remainder without replay. Explicit close clears only that game's FIFO/view input; existing `closeTab` is not game disposal. Other queue/actual work unaffected; actual game disposal additionally drains its real resources |
| PRE-S20: later dependency invalid | R where the new actual board still permits the head but blocks a later intended step; release that reply | PRE-F05 -> F06 -> whole-sequence project failure | Clear all remaining entries immediately **before** the local head commits; no valid-prefix move/node/increment, unavailable tail or later revival. Actual opponent move remains; local turn waits |
| PRE-S21: terminal or structural change | Queue with provider pending; timeout, actual mate/draw, accepted resignation/draw, changed seat, unassignment or setup/root replacement. Also cancelled/no-op actions and late old output | PRE-F12 with F05/F04 ownership | Real invalidating transition clears queue and closes old acceptance before replacement; terminal actual move/clock/result remain final and no successor starts. Repeated/late output cannot affect replacement. No-op reassignment/cancelled action and exploratory mate preserve queue. Other game's data is unchanged |
| PRE-S22: engine/save isolation | A/R with FIFO/projection and independent analysis seats; edit queue, save/export, continue in memory, then load/import a separate game | PRE-F08/F03 -> F13; existing recording boundary | Queue edits do not restart analysis or change canonical rendered FEN, captures, history or timestamp. Available actual-parent analysis is recorded once; unrelated selected output is not copied. Save preserves original in-memory FIFO, serialized schema omits runtime/projection, loaded game starts empty |
| PRE-S23: equal-path race | A with queue; enter Analyse and make no exploratory move; release e7e5 immediately | PRE-F10 -> F05/F04/F06 | Actual e5/head and successor progress with no Exit; selected canonical entry snapshot/path/cache stays independent even though path values initially matched. Queue validation uses the current actual live position; selected picture has no red displacement |
| PRE-S24: actual clock in analysis | C on local turn with no queue; enter Analyse; explore without committing actual move; advance explicit timestamp to expiry, then deliver stale Exit/Resume/input. Repeat expiry racing a queued head | PRE-F10 -> existing syncClock/commit expiry -> F12 | Actual human clock keeps running and expires once. Exploratory moves add no time/increment. Timeout clears queue/actual ownership; stale actions cannot revive result or rescue an uncommitted head at deadline |
| PRE-S25: legacy paused restore | Load old paused live-analysis save, visit/cancel Menu, explicitly Resume while still analysing | PRE-F13 -> F11 -> F04 | Empty queue after restore, selected canonical node preserved and Manual-only reconstructed pause ownership. Menu cannot clear Manual. Final Resume permits actual work without an extra Analysis owner/Exit; no old runtime entry is restored |

### Deterministic ordering checks

Pair the scenario rows with these controlled event orders; test both sides of an atomic commit rather than depending on arbitrary delays:

- Append completes before a provider reply versus a retained gesture delivered after that reply: the first enters the FIFO; the second fails its old selected-input owner and cannot become a fresh intention.
- Undo/Clear before due-head claim versus after committed head: the first prevents that queued move; the second edits only the remainder, preserving actual history.
- Pause before reply versus after completed reply/head: held output waits only in the former case; neither order repeats a commit/increment/search.
- Structural cancellation before readiness/result versus after completed actual move: old work cannot start/commit after cancellation; an already committed node is retained until the actual rewrite/Takeback policy changes it.
- An append/wake arriving as the current drain exits is processed by the owned action lane; there is no lost wake, recursive unbounded drain, duplicate provider or future-turn promise.
- Duplicate provider success, late failure after replacement, eligible retry and disposal during owned retry cannot mutate or restart a successor incorrectly. Use existing ponder hit/miss regression boundaries and report native execution separately.

No arbitrary queue limit, hotseat premoving, review suspension, analysis-entry clear or invalid-tail retention is restored from superseded drafts. Those conflict with the user's settled choices. The queue/data structure alone still does not make any scenario above pass.

## Implementation sequence

| Step | Work | Completion gate |
| --- | --- | --- |
| PRE-00 | Complete and verify the separate background analysis plan | Its tests were written/failed before implementation and now pass; actual clocks/turns and selected boards have an independent verified contract |
| PRE-01 | Write queue/capability/projection unit tests against existing data/actions, then run them before premove production edits | Record meaningful failing assertions for append, interleaving, full-clear, hotseat exclusion and red-square/piece projection |
| PRE-02 | Integrate the existing FIFO contract with one actual-turn owner and serial driver in Game runtime, PlayerTurn and GamesStore; preserve immediate input completion | One current owner/provider, owned cancellation/retry, no future-turn promises |
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
