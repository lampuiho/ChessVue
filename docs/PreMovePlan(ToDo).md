# Premove and player-turn flow plan

Replanned on 22 October 2026 after the user chose to undo the premove implementation. **Status: premove proposal awaiting approval; the separately approved PRE-RAW refactor is implemented and verified.** Queue entries reuse existing `IMoveRaw`. The separately delivered [background analysis prerequisite](BackgroundAnalysisPlan.md#implementation-and-verification) remains the baseline. Carry forward the [resolved decisions](questions/play/Q-PLAY-002-PremoveAnalysisConflicts.md), [AGENTS.md](../AGENTS.md) and [code cleanup rules](CodeCleanupPlan.md).

All [14 premove function flows](#function-flow), [25 premove scenarios](#concrete-scenarios-for-unit-tests) and the [data-driven test specification](#data-driven-unit-test-specification) are retained. [PRE-RAW](#pre-raw---raw-move-submission-refactor) records the completed submission refactor and ten prerequisite scenarios. The [older PRE-01 run](#pre-01-unit-test-baseline) is historical evidence for the superseded contract, not execution of this replan. Premove queue migration and implementation still require approval; the raw-submission approval covers PRE-RAW only.

## Prerequisite and tests-first order

The [background analysis plan](BackgroundAnalysisPlan.md) has delivered analysis clocks, selected-position isolation, actual background-turn scheduling, active-branch pruning, analysis controls and old paused-state compatibility. This plan consumes those verified actions. Explicit analysis moves/history also remain permitted during genuine pauses, while actual commits stay paused, as confirmed in [Q-PLAY-003](questions/play/Q-PLAY-003-PausedAnalysisEntry.md).

After the prerequisite passes, write premove unit tests against game data and existing store actions **before changing production code**. Observe meaningful failures for opponent-turn append, due-turn validation, whole-queue clearing, hotseat exclusion and derived board/red-square projection. Only then implement the queue and presentation, rerun focused unit tests and add browser acceptance. Do not use the prerequisite's passing analysis tests as premove acceptance.

The **board-interaction `IMoveRaw` refactor** in [CodexFollowUp](CodexFollowUp.md#raw-move-submission) is the separately approved and completed **PRE-RAW** prerequisite. Board/PV/modal submission, view confirmation/playback and the store now use raw input; canonical acceptance enriches for history/commit. Its [tests-first verification](RawMoveSubmissionDesign.md#implementation-and-verification) is independent of the pending raw FIFO migration. The remaining queue order follows the completed first two gates: **PRE-RAW tests fail -> raw-submission refactor passes -> raw queue data migration -> premove behaviour tests fail -> premove implementation**.

## PRE-RAW - Raw move submission refactor

The separate [Raw move submission API design](RawMoveSubmissionDesign.md) defines the complete before/after signatures, [per-boundary full-move justifications](RawMoveSubmissionDesign.md#type-retention-audit-and-justification), copying/validation boundary, five function flows, promise/error semantics and implementation migration. It is the API reference for PRE-RAW; this section retains its dependency and test matrix within the premove plan.

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

When premoves are subsequently implemented, add one branch **before canonical enrichment and the view's canonical-prefix preflight**: eligible off-turn input goes raw to the store and appends to `IMoveRaw[]` after speculative projection checks. Do not reject it against the opponent's current legal turn. Resolve its actual details later through PRE-F07. No speculative detailed move crosses into the actual commit path.

| Existing owner | Planned refactor |
| --- | --- |
| `Chessboard.legalMoves`, selection and drag | Continue using existing legal raw candidates. Keep move-list types explicit where needed for inference. Do not add premove candidate rules in PRE-RAW |
| `_commitTarget`, pending promotion and `_choosePromotion` | A completed choice selects a raw candidate with exact `promotionPiece`; no emission while incomplete. Cancel or source/mode replacement discards the attempt; an old choice cannot complete a new chooser |
| `Chessboard._emitMove` / `moveAttempted` | Emit `IMoveRaw` directly. Remove board-side `toDetailedMove` and its import. `lastMove?: IMove` remains because the legal query consumes historical moving colour/check state; highlighting alone would not justify it |
| `GameView.inputActions.move`, `_makeMove`, `_requestMoves` | Accept raw payloads through the existing captured input owner; no conversion back to a detailed payload for transport |
| `pendingContinuation`, `_confirmContinuation` | Keep raw move data with the selected game/node owner. Confirmation rechecks its context; enrichment uses the accepted canonical source. Cancelled/stale confirmation changes neither actual play nor queue |
| `AnalysisPanel.moveSelected`, `_playAnalysisLine`, `_applyMoves` | PV props remain detailed for SAN; the selected-prefix event and view adapters use `readonly IMoveRaw[]`. Copy coordinates/promotion at the event boundary and when owning retained external data. Validate the full prefix on a detached canonical preview before its first move; temporary detailed moves needed to advance that preview stay local and are discarded. Retain raw entries for delayed submission, with the existing playback cancellation/context checks |
| `GamesStore.makeMove`, `GameMoveComposable.makeMove` | Keep the existing action names, widen input to `IMoveRaw`, select the correct canonical board, reject stale/illegal raw moves and generate actual details immediately before the existing commit routes. No `IMove | IMoveRaw` union, raw-to-detailed cast or new public conversion wrapper |
| Actual turn, history and engine-result delivery | Retain `IMove` for accepted transition facts consumed by clock/history/SAN and existing result schemas. The [audit](RawMoveSubmissionDesign.md#full-move-contracts-retained) gives each API's reader or downstream sink; forwarding alone is not a full-type requirement |
| Existing application and protocol inputs | Application/rule replay and its engine validation helpers require existing `IMoveCandidate`; ponder command/expected-reply inputs require only `IMoveRaw`. Keep names, algorithms, engine commands and lifecycle; no full fields are needed by these consumers |
| Legacy Promotion modal payload/schema/handler | Use raw from/to plus the explicit promotion choice through the existing store action. Remove this second UI-side conversion; leave saved game schemas unchanged |

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
| RAW-S08 | Detailed PV display chosen for due-local play or full-prefix analysis | Panel emits a copied raw prefix and view routes raw data; full prefix is preflighted before its first commit. A later illegal prefix step causes no earlier commit; temporary preview details never become authoritative playback data |
| RAW-S09 | Delayed raw playback/gesture/promotion followed by mode, game, path, permission or result replacement | Existing owner rejects obsolete callbacks/suffixes; unrelated evaluation of the same selected position preserves valid unfinished input |
| RAW-S10 | Existing engine reply, paused output, save/load and hotseat handoff regressions | Detailed engine-result/history contracts remain intact; candidate application and raw ponder inputs preserve existing behaviour. No premove capability appears yet; no extra turn/provider, changed persistence or previous-side input after handoff |

Test owners are the existing `Chessboard.spec.ts` for raw selection/promotion, `GameView.spec.ts` for transport/confirmation/PV/playback, mounted existing modal/UiState tests for its raw promotion variant, and store/background-analysis tests for canonical acceptance and unchanged actual effects. Use real chess rules for canonical detail resolution; a store stub is appropriate only for the mounted view's payload assertions. Keep raw-case fixtures data-driven and ordinary-move refactor failures separate from not-yet-implemented premove failures.

After PRE-RAW implementation, require these tests and affected existing regressions to pass, with `npm run check:code`, type checks/build and focused real promotion/playback gestures as appropriate. Record the executed scope separately from premove acceptance. Leave the source follow-up item pending until this stage actually passes; the planning link is not completion.

PRE-RAW preserves the existing actual-handler completion when genuine pause races an already-accepted move; it does not introduce the later actual-commit completion owner. The [API design's completion matrix](RawMoveSubmissionDesign.md#raw-f05---engine-pause-and-completion) separates this baseline from the subsequent PlayerTurn refactor.

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
| Invalid queue | If any accepted dependency no longer projects or the due head is illegal, clear the whole FIFO. An invalid new append preserves an otherwise-valid existing queue |
| Queue data | Existing `IMoveRaw[]`; no duplicate entry type, stored expected kind or node anchor |
| Board cancellation | Right-click anywhere on the live board clears all remaining premoves; touch tap on a premoved piece cancels. Keep Escape access; no count/list or premove control buttons |
| chess.com comparison | Board cancellation interaction only; retain the agreed projection, clocks, background play and queue policies |

Analysis preserves queue ownership, not a frozen snapshot of its entries. Actual play may consume or cancel entries while analysis is open. On exit, display only the remaining valid queue over the latest live board; never replay the entry-time sequence.

## Current implementation and test gaps

| Source boundary | Current behaviour | Planned change |
| --- | --- | --- |
| [Game runtime](../src/contracts/Game.ts) | Runtime premove FIFO data contract, three pending-turn fields and one `deferredPlayerMove` slot | Integrate the FIFO with one current-turn owner; no speculative future-turn promises |
| [Player turn](../src/state/game/GamePlayerTurnComposable.ts) | Existing shared local/engine current-turn delivery; analysis prerequisite already removed the selected-board arming gate | Add ordered future local input while preserving one actual-turn owner and the verified background API |
| [Game view](../src/views/GameView.vue) | Explicit analysis/review are already distinguished; no premove drawing/input exists | Enable own-piece off-turn queue gestures and derive displaced pieces/red squares |
| Raw-submission boundary | PRE-RAW now uses raw board/PV/modal/view/store inputs and canonical enrichment | Completed independently; queue integration must reuse this boundary |
| [Engine runtime](../src/domain/EngineRuntimeService.ts) | Validates actual/ponder moves at the searched position | Preserve legality/protocol ownership and bind result delivery to the captured actual turn |
| Pause/recovery | Prerequisite owns real pause/old saved-analysis compatibility | Retain the new queue across genuine pauses without another pause policy |

The old note's pending-promise equality guard was already removed by the cleanup. Do not reintroduce it. Duplicate-turn prevention, owned cancellation/draining and the queue replace that concern.

The former analysis mismatch/four-test baseline and the older queue declaration/tests are historical evidence. Existing queue tests still use the superseded entry shape; they must be migrated after approval. No old count establishes execution of this raw/no-buttons revision.

## Position, queue and input ownership

Keep the existing concepts small:

- `livePosition`/`livePath`: the actual game and its current turn.
- `renderedPosition`/`renderedPath`: the canonical selected live/history/analysis board, without premoves.
- Displayed pieces/red squares: a pure derived result of the rendered board plus the queue when showing the live gameplay board. A small helper returning copied squares and highlight IDs is sufficient; no third persisted game position or separate engine position is needed.
- Runtime queue: one FIFO for the human seat in a human-versus-engine game, bound to the actual continuation and seat. Local-local and engine-engine games have no human premove queue.
- Current turn: captures actual parent node, colour/player, abort controller, completion and provider work before asynchronous startup begins.
- Input/analysis session: owns the selected node, unfinished drag/promotion or playback and the explicit mode. Queue entries outlive component remounts; unfinished gestures do not.

The revised [data contract](PremoveDataStructure.md) is `game.$.premoveQueue?: IPremoveQueue`, containing only `player: IPlayer` and `moves: IMoveRaw[]`. Copy only `from`, `to` and optional explicit `promotionPiece`; discard `$` and supplied detailed metadata. There is no replacement move-entry interface/alias or stored expected piece kind. Read the source piece and its movement from the board at each projected/actual step; queue ownership supplies the required local colour. Its base is always the current actual live position, with no node/path/FEN anchor. Unknown opponent replies are not predicted; explicit structural actions invalidate the queue.

Replace `pendingPlayerTurnPromise`, `pendingPlayerTurnHandlePromise`, `pendingPlayerTurnAbortController` and `deferredPlayerMove` together. A single internal `Deferred` may still represent current-turn completion. Accepted paused engine output belongs to that actual turn; it is not an editable local premove or a competing resolver.

Publish runtime queue changes through the existing raw-game rendering boundary without changing persisted `metadata.updatedAt` or the move/autosave count just for preview edits. A computed projection must preserve identity across unrelated evaluation publications so new scores do not cancel an unfinished gesture.

## Scope and minimum code

- Preserve the completed analysis/history/pause prerequisite and existing named entry points. No new game state, persisted setting, schema version, arbitrary queue cap or timing penalty.
- Use `IMoveRaw` directly at raw-input boundaries; no redundant `IMove | IMoveRaw` union, raw-to-`IMove` cast or copied entry interface. Actual details come from the canonical rule boundary.
- Keep one `IPremoveQueue` with exact seated player and raw FIFO. Do not reintroduce expected piece kind through sidecars, signatures or snapshots.
- Add only `GameRuleUtility.genCandidateMovesForPiece(position, from)` as a generic chess-rule query. Reuse legal/detail/application functions. No premove utility/library, premove-named rule API, new service or public dispatcher.
- Append, projection, due resolution and rebase stay private/in existing app owners. One store Clear action serves board cancellation; no Undo-last action, queue count/list or premove buttons in GameControlPanel.
- Consolidate actual pending/deferred delivery in PlayerTurn with one current owner and a small serial drain; remove competing successor scheduling, rather than add another scheduler alongside it.
- Global CSS only; extend the existing narrow audited board-prop input-reset boundary if necessary. No new orchestration watcher or async invalidation counter.

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

A successful commit consumes only its own head; background analysis leaves the remainder executing normally. A failed intention clears all remaining entries/red shades without making a partial history node, changing clock ownership or undoing moves already actually played. A brief transient invalidation notice is sufficient; do not add a queue counter or control panel.

## Function flow

Names without a qualifier below are existing source entry points; private names describe responsibilities within their current owners, not new exported APIs. Every flow uses the revised raw queue. This replan authorises no code/test implementation by itself.

### Planned call boundaries

| Boundary | Contract for writing tests |
| --- | --- |
| Existing `GamesStore.makeMove` / `GameMoveComposable.makeMove` | Accept `IMoveRaw`; existing `IMove` callers remain valid because it extends that contract. Classify context first, append off-turn raw data, otherwise resolve canonical legal details. Preserve immediate commit completion versus immediate append acknowledgement |
| Planned `clearPremoves(game)` | One queue-only action for owned board cancellation and internal invalidation. Publish runtime changes; never invoke actual Takeback. No Undo-last, count/list or button API |
| Planned `GameRuleUtility.genCandidateMovesForPiece(position, from)` | Raw `IMoveRaw[]` movement candidates for that piece's geometry, occupancy, castling rights and explicit promotion alternatives, independently of the actual side due/current attacks. Pawn capture diagonals are candidates even when empty; full legality is checked by the existing legal-move functions. No queue, player seat, history, red-square or application-mode input/output. Reuse existing private chess mechanics in this file |
| Planned `GamePositionComposable.getPremoveProjection(position, queue)` | Existing app position owner composes the FIFO on a detached position through `MoveApplicationService` and rule candidates. Return copied pieces/unique red squares, or `undefined` for any invalid dependency. Check exact seat/source colour and queue ordering; derive source kind from the copy. Test observable board output without a new utility export |
| Private `Turn._resolvePremoveMove` responsibility | Require the actual local side and own-colour source, derive its kind from the board, then use `genLegalMovesForPiece`, exact raw/promotion matching and `toDetailedMove`. No cast to detailed move or new public resolver |
| Existing `requestPlayerMoveIfNeeded` / `attemptPlayerMove` | Retain current-turn entry responsibilities while moving scheduling to one private serial drain. Provider delivery is bound to the captured turn; ordinary local input still observes its actual commit |
| Existing `commitLiveMove`, pause/resume, analysis/history and structural actions | Reuse their canonical effects. Add explicit queue validation/consumption/cancellation at the boundaries below; do not rewrite the completed analysis feature |

The existing raw input type, one queue-clear action and generic candidate query are the necessary boundaries. Internal queue composition stays with existing game owners. The earlier analysis prerequisite remains unchanged. Do not require a separate premove library, duplicate raw type/union, new review mode, speculative history `IMove`, per-colour queues or replacement serialization API.

### PRE-F01 - Classify raw input before submitting it

`Chessboard moveAttempted(IMoveRaw) / AnalysisPanel moveSelected -> GameView._makeMove/_playAnalysisLine -> _requestMoves -> GamesStore.makeMove -> GameMoveComposable.makeMove`.

1. Capture the selected input owner; reject obsolete game/node/mode/projection/permission before submission and repeat capability checks in the store.
2. Explicit Analyse, free and terminal analysis use existing canonical branch routes. Paused explicit analysis remains allowed. These routes never append, consume or clear the background FIFO.
3. Ordinary history input preserves `_requestMoves -> pendingContinuation -> _confirmContinuation -> _commitHistoryRewriteMove` when Takeback is allowed. Cancelled/stale confirmation preserves actual game/queue; otherwise require explicit Analyse.
4. Following-live ordinary input requires ongoing, genuinely unpaused gameplay. Human-engine input during the engine turn appends through PRE-F02. A due local move uses the actual owner; hotseat hands input to the newly due side and engine-engine cannot queue.
5. For actual/analysis input, match raw coordinates and exact promotion against existing legal candidates on that canonical board, then build `IMove` with `toDetailedMove`. Do not trust supplied detailed fields or cast raw data to `IMove`. Preserve existing branch routing and immediate actual-commit completion.
6. A due queued head has priority through PRE-F04; stale direct input cannot replace it or settle a successor. Keep full-prefix analysis validation before the first move and owned cancellation between delayed steps.

Steps 1-3 and canonical raw acceptance in step 5 are first established by PRE-RAW without enabling premoves. PRE-F02 adds the later off-turn branch; do not implement the same submission refactor again in queue code.

**Assertions:** bare raw coordinates suffice, existing detailed callers remain compatible, and stale metadata never enters history. Forbidden modes/colours leave actual state and queue unchanged. Retain suggestion-preference and paused-analysis/Takeback regressions.

### PRE-F02 - Append a raw move to the FIFO

`GameMove.makeMove eligible off-turn input -> private PlayerTurn append responsibility -> getLivePosition -> validate existing queue -> trial whole projection -> publish runtime`.

1. Require one human versus one engine, the engine due, genuinely unpaused ordinary following-live input and the exact seated human owner.
2. Copy only `from/to/promotionPiece` from `IMoveRaw`, omitting absent promotion. Drop `$` and any detailed colour/kind/capture/check/notation fields. Do not mutate or retain the caller's object.
3. Read source colour/kind from the projected board at this step. Trial the entire existing sequence plus the new move through PRE-F03; there is no expected-kind field to populate.
4. Reject an invalid new append without damaging an otherwise-valid FIFO. If the already-accepted sequence itself is invalid, clear it completely rather than retaining a prefix.
5. Append in order, publish runtime changes only and acknowledge immediately. No actual turn completion, node, clock transition, increment, recorded analysis or engine search is created.

**Assertions:** `{ from: 6, to: 21 }` followed by `{ from: 21, to: 38 }` suffices. Both local colours work, including Black before its first actual move. Frozen/raw/detailed inputs cannot inject metadata or share mutable queue entries. Invalid coordinates/promotion choices leave a valid queue intact.

### PRE-F03 - Derive displaced pieces and red squares

`GameView computed display -> GamePositionComposable projection -> GameRuleUtility.genCandidateMovesForPiece -> MoveApplicationService on a detached copy -> Chessboard display props`.

1. When following live, derive from its canonical board. During explicit analysis/history show the selected canonical board without the FIFO. Genuine pause may retain the following-live picture but disables queue input/cancellation.
2. Detach the source. For each `IMoveRaw`, require an own-colour source, read its kind from this evolving copy, find matching movement candidates and apply the exact promotion through existing move application. No expected kind or accepted actual metadata is stored on the entry.
3. Candidates are independent of actual side-to-move and king safety; respect projected occupancy, castling rights and promotion choices. Evolving king/rook movement cannot restore lost castling rights.
4. Collect unique source/destination IDs, including castling rook endpoints. Use copied pieces for final artwork/accessibility labels. Captures/promotions affect this copy only.
5. Any invalid dependency returns no partial projection. Explicit state actions own whole-queue invalidation/publication; a computed getter never mutates queue/canonical data.
6. Preserve display/input identity across unrelated score publications. Actual base, queue, permission, mode, game or result replacement cancels obsolete gestures through the retained board boundary.

**Assertions:** g1-f3-f3-g5 displays Ng5, empty g1/f3 and red `{6,21,38}`. Exact copied piece maps/red sets cover both orientations, castling, every promotion and later invalid dependencies; canonical/history/clock/evaluation data is untouched.

### PRE-F04 - Wake and drain the actual turn once

`activation / accepted actual input / provider result / actual commit / final real Resume / eligible retry -> requestPlayerMoveIfNeeded -> planned Turn._drainTurns -> commitLiveMove -> next iteration`.

1. Join owned drain work rather than start a competing loop. Serialise explicit state-changing actions and preserve a wake arriving while a drain finishes. This is action/work ownership, not a generation counter or polling loop. Never hold the action lane while waiting for an engine result.
2. Reconcile actual expiry. Stop for ended/disposed/transitioning context. Attach one current-turn owner from the actual parent node, colour and seated player before any asynchronous readiness/provider start; its accepted result and completion belong to that actual turn.
3. If a genuine Manual/Menu pause applies, retain the owner/result/queue and stop without consuming any intention. Analyse, history and another displayed game are not pause predicates.
4. Validate any queue's human-versus-engine capability and exact seated-player binding. For an eligible local turn, ask `Position.getPremoveProjection` to validate the entire current queue using the current actual live position, then resolve its head using PRE-F07. Invalid data clears the queue and leaves the local turn waiting. With no queue/result, wait for normal local input; its clock continues. An ineligible queue never blocks an actual engine turn from starting.
5. For an engine seat, start its captured provider once, then return while it thinks. Provider delivery uses PRE-F05. Duplicate wake requests cannot start another search.
6. Commit an accepted actual move synchronously through `commitLiveMove` while its owner remains attached. Apply queue post-commit changes in PRE-F06 **before** evaluating the successor. Stop on terminal result; otherwise retire/drain the old delivery owner and iterate for the next actual turn.

Remove independent successor arming from `_finaliseLiveMove` and the separate resume flush path when this driver is integrated. Entry/Exit never become scheduler/flush actions. Existing immediate `makeMove` calls still complete after their actual commit; enqueued input completes after append only.

**Assertions:** a sequence produces `engine reply -> one local head -> next engine search`, including behind analysis/review, with one actual node/increment per committed move and one provider per actual engine turn.

### PRE-F05 - Deliver an engine reply to its captured actual owner

`Turn._requestPlayerMove/_requestEngineMove -> EngineRuntimeService.ensureReady/startPlayerTurn -> awaitPlayerTurnMove(searchedPosition) -> planned Turn._acceptProviderMove(capturedTurn, move) -> PRE-F04`.

Capture/retain actual parent, player, position and abort ownership before readiness. After readiness, an aborted/replaced owner cannot begin its provider. Preserve `EngineRuntimeService.awaitPlayerTurnMove` as the actual engine/ponder legality boundary; selected analysis and speculative pieces never supply its position.

Accept one result for that captured turn. A duplicate or cancelled delivery does nothing and cannot claim the successor. The callback acknowledges acceptance without awaiting a future Resume/commit of the same provider; the drain settles delivery outside the callback, avoiding a cycle where each awaits the other. During a real pause the result stays owned and uncommitted.

Preserve `EngineRuntimeService.startPlayerTurn` and its UCI API. Its awaited pondering operation settles finite startup commands, not the ongoing ponder search. The captured callback acknowledges acceptance without awaiting commit; the driver settles finite provider delivery outside that callback before the successor reuses the client. Do not remove ponder-start awaiting as fire-and-forget or wait for a long-running ponder result. Retain hit/miss/stop ordering, handled failures and no repeated pondering on Resume.

**Assertions:** release a reply before/after pause, deliver it twice, abort during readiness and release it after reassignment; only the current captured owner may cause one actual commit. Native ponder acceptance needs its own executed platform lane.

### PRE-F06 - Rebase or consume after a real commit

`commitLiveMove -> _applyLiveMove/_finaliseLiveMove canonical effects -> planned Turn._rebasePremoveQueue(game, consumedHead?) -> Position.getLivePosition/getPremoveProjection -> runtime publication -> PRE-F04 successor`.

1. Read the game's current actual live position and require any queue's player to remain its exact eligible local seat. Structural changes clear the queue at PRE-F12; queue revalidation does not reconstruct or compare a stored continuation anchor.
2. If this was its due local head, remove **that head only after successful actual commit**. Remove the queue if now empty. Do not reproject the consumed entry from its now-vacated source.
3. For an opponent commit, remove no entry. For either commit type, project the whole remaining sequence from the **new actual board** before letting another local intention execute. If the new state is terminal, clear all remaining entries instead.
4. If any remaining source/dependency/path fails, remove the whole queue immediately, including an otherwise-valid head. Keep every move already committed. Otherwise retain the same queue, exact local seat and remaining order; no queue-side node bookkeeping is needed.
5. A rebase does not use or change `renderedPath` to decide eligibility. An independently selected canonical board/analysis branch stays selected; only following-live aliases advance with actual play.

**Assertions:** revalidation uses the new actual live position; failed actual commit/timeout consumes no head, terminal cleanup never restores one, and an invalid second entry prevents the otherwise-legal first entry from being played next.

### PRE-F07 - Resolve the next due intention on the actual board

`PRE-F04 local turn -> private Turn._resolvePremoveMove responsibility -> GameRuleUtility.genLegalMovesForPiece(actualPosition, head.from, actualNode.move) -> exact raw/promotion match -> toDetailedMove(actualPosition, candidate) -> current-turn acceptance -> commitLiveMove`.

Require the actual local side due and own-colour source; read its kind from the actual board. Match legal candidates for `from/to` and exact promotion; never default a queued underpromotion to a queen. A missing candidate clears the whole queue through the caller and leaves the actual turn waiting. Do not skip to a later intention.

Actual candidates determine capture, en-passant victim, castle legality, check/pin/king safety, ambiguity and notation. The speculative picture supplies no accepted move metadata. Reconcile clock expiry at commit so a legal queued move cannot rescue an expired turn or acquire an increment at the deadline.

**Assertions:** intended diagonal succeeds only if an actual legal capture/en-passant exists; opponent king attacks/check can invalidate a projected king/castle move; every promotion kind resolves exactly; actual capture changes are recorded from this board.

### PRE-F08 - Publish a queue edit without a canonical move

`append / board cancellation / consumption / rebase / invalidation -> private GamesStore runtime publication -> workspaceRevision`.

Extract the existing shallow publication increment from `_touchGame` into one private runtime publication helper; canonical `_touchGame` continues updating `metadata.updatedAt` and publishing. Queue-only actions use the runtime helper, not `_moveCommitted`, analysis refresh, clock operations or autosave thresholds. A real commit retains its established history/clock/recording/autosave effects once; any combined queue publication does not duplicate those effects.

**Assertions:** queue-only edits preserve canonical serialized bytes, metadata timestamp, clock, actual history and search starts while making the new copied pieces/red union visible.

### PRE-F09 - Cancel the whole queue from the board

`right-click a board square / touch tap a premoved piece -> Chessboard cancellation event -> captured GameView input action -> GamesStore.clearPremoves -> runtime publication -> canonical drawing`.

- Use the agreed chess.com interaction: [right-click anywhere on the board](https://www.chess.com/terms/premove-chess) clears every remaining entry. On touch devices, [tap the premoved piece](https://support.chess.com/en/articles/8562432-what-are-pre-moves-and-how-do-they-work). Ordinary mouse selection of that piece still extends a chain. No count/list, Undo/Clear buttons or Undo-last API.
- Require current eligible following-live input ownership, ongoing gameplay and no genuine pause. Analysis/review cannot cancel background intentions. Internal invalidation/explicit tab close needs no visible edit capability.
- Right-click also cancels unfinished selection/drag/promotion. Escape first cancels unfinished input, then clears the queue on the next press in live premove context. Board-edit right-click retains its piece-deletion meaning.
- Cancellation before head commit prevents that intention; after an atomic commit it removes only the remainder. Never call actual Takeback, undo played history or change clock ownership.
- Remove an empty optional queue and rebuild artwork from canonical data; do not reverse speculative captures in place. Empty/repeated cancellation is a no-op.

**Assertions:** empty/ordinary/premoved squares right-click clear the whole queue; real touch taps cancel in both orientations; mouse chaining works. No counts/buttons appear in GameControlPanel. Paused/analysis/history, obsolete callbacks and another game's input cannot cancel this queue. Cancelling after actual Nf3 leaves actual Nf3/history intact.

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

`own-piece click/drag/keyboard -> genCandidateMovesForPiece(projectedPosition, from) -> IMoveRaw -> PRE-F01/PRE-F02`; own-turn and explicit-analysis input use canonical legal targets with the same raw-move contract.

The board emits raw candidates; do not generate speculative detailed moves or add source-kind fields. Promotion must be explicitly chosen before emission. Unfinished selection/drag/promotion stays outside the FIFO.

Keep suggestion visibility/playability preferences independent. Own-turn gameplay uses the existing first actual PV move. The raw selected-prefix event retains the clicked index through its length: derive its mover from the captured canonical PV source side and parity (odd length is that side, even length is the opponent). Off-turn gameplay requires that mover to be the local seat, then takes only the final raw entry as one intention validated against the current FIFO. A projected piece on the same source square must not turn an engine-colour click into local input. Never enqueue preceding opponent replies or a predicted prefix; an engine-colour click cannot steal its turn. Explicit Analyse retains canonical full-prefix validation/playback; ordinary history retains confirmation.

Bind callbacks to the input owner. Cancel selection/drag/promotion/PV on queue/base/mode/game/result/capability replacement. Late callbacks cannot become fresh input. Unrelated evaluation or actual progress behind an unchanged independent analysis board preserves its valid selected input. Delayed analysis playback retains its existing lifecycle owner.

**Assertions:** both local colours/orientations and supported gestures agree; touch tap cancellation is a cancel gesture, not a move submission. Detached promotion choices, old board-action callbacks, stale drops and delayed prefix steps cannot mutate replacement ownership.

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

Own board/queue styles in [board.css](../src/assets/styles/board.css) without premove styling in the game control panel. Use global CSS only, no scope escapes or inline presentation declarations. Keep derived projection computed and effects in explicit actions/lifecycle hooks; reuse only the documented narrow external-prop input-reset observer boundary.

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

The revised `IMoveRaw[]`/`IPremoveQueue` design is the fixture contract after its approved migration. Define examples as plain data, then bind `queue.player` to the constructed game's actual local seat **after** game construction/hydration. The existing actual live selector supplies the validation base; no node reference is stored in the queue fixture.

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
    { kind: 'providerMove', uci: 'e7e5' }, // drain also commits the due N1
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
| U-O: actual-turn integration | Premove state tests plus existing turn/runtime regressions | Deterministic provider acceptance/start/cancellation traces, one commit per turn, acknowledgements, pause/timeout ordering and no repeated increment/ponder. Fake only external provider/readiness/time boundaries; keep rules/history/time-control logic real |
| V: mounted input/projection | New `PremoveView.spec.ts`, with existing `GameView.spec.ts` and `Chessboard.spec.ts` regressions | Full copied piece map and unique red squares from plain projection cases; invalid suffix shows canonical fallback without a partial projection or getter mutation. Automatic routing, board cancellation, selected-input ownership, unfinished promotion/drag and full-prefix analysis cancellation |
| J: browser/platform | New premove journey plus affected existing Analysis/History/Clock/engine-race/Promotion checks | Actual gestures, accessible/focus layers, both orientations, visible background progression and native protocol evidence only where executed |

For every state event assert both the changed data and important untouched data. Queue edits preserve serialized canonical bytes, timestamps, history/clock/move count and analysis-search starts. Actual commits advance history, timestamps, clock/increment and recording once, while an independently selected canonical board stays unchanged. Queue cancellation never undoes already committed moves.

Write U-P/U-S cases first and record the failing baseline before premove behaviour changes. The already passing `PremoveData.spec.ts` covers only contract serialization/hydration, and the analysis tests cover only the prerequisite. Missing imports, missing methods or type errors alone are not meaningful behavioural red evidence. Add controlled U-O tests before replacing the actual-turn flow; add V/J tests for their presentation boundaries. Do not mock the chess rules, actual board projection or store action being tested.

### Raw-contract test migration

First complete PRE-RAW's tests-first submission refactor. Then write the small raw queue/serialization assertions and migrate the declaration/imports without premove gameplay changes. Once this data boundary is green, revise and execute premove behaviour tests before developing premove behaviour.

- Replace the custom entry imports/fixtures with `IMoveRaw` and bare `{ from, to, promotionPiece? }`. Remove the fixture helper's expected-kind argument and queue `movingPiece` fields; retain piece kinds on canonical pieces/actual move expectations.
- Replace impossible "wrong stored expected kind" checks with source geometry/colour, missing sources and invalid promotion cases. Do not retain a hidden field merely to keep an obsolete assertion green.
- Replace button/count/Undo cases with whole-queue cancellation. Cover right-click on empty/ordinary/premoved squares, touch tap versus mouse selection, Escape priority, board-edit deletion, no-op cancellation and stale callbacks.
- Exercise real public store actions with raw fixtures, not a cast to `IMove` or a test-side queue implementation. Assert exact copied fields and dropped incoming `$`/detailed metadata. Keep rules, clocks, history and serialization real; fake only external providers/time.
- Retain PRE-S01-PRE-S25 and existing analysis/pause/runtime regressions. Add raw promotion dependencies, Black queuing before its first actual move and cancellation before/after actual commit.
- Refresh counts from executed runs. Missing imports/type errors alone are not meaningful behavioural failures; do not skip/expected-fail assertions to manufacture a green report.

### Rule fixtures required in addition to the scenario sequence

| Input data | Projection/append expectation | Due-turn expectation |
| --- | --- | --- |
| Empty/opponent source, geometry incompatible with the real source, friendly target, opposing king target, non-integer/out-of-range coordinates | Reject a new candidate without corrupting an existing valid FIFO; accepted stale data detected on rebase clears the whole FIFO | Never create an actual node or resolve another seat's turn |
| Knight or king currently pinned/in check or targeting an attacked square | Speculative geometry may project; no claim of actual king safety | Resolve only if an actual legal candidate exists; otherwise clear all remaining entries |
| Bishop/rook/queen blocker introduced at an early or later step | Whole existing sequence becomes invalid; no displayed valid prefix | No due head executes if a later entry is already unprojectable |
| Pawn single/double push, blocked intermediate square, wrong direction/rank | Respect own projected movement/start rank and empty path | Recompute actual legal candidate after the reply |
| Pawn diagonal onto empty/enemy square | Allow possible capture geometry without inventing a future victim or captured-material total | Require a real capture or current en-passant candidate; otherwise whole clear |
| Castling with missing rights/rook/path; king/rook projected away and back | Missing rights/path rejects projection; preceding intentions cannot restore lost rights | Also require actual safe king/path/destination |
| Each queen/rook/bishop/knight promotion followed by that piece moving; also missing/King/Pawn promotion choices | Require a completed valid choice; derive promoted kind from the copy; unfinished choice stays outside the queue | Match exact chosen kind and regenerate actual capture/check/notation |
| Same-square repeat, repeated intermediate square and multiple pieces | Geometry rejects null moves; legitimate shared squares produce one red fill | Preserve FIFO dependency order; no entry IDs or speculative nodes |
| Equal-looking cloned player or actual seat/root replacement | Reject a different player object; seat/root replacement explicitly invalidates the whole queue even if coordinates/FEN match | Whole clear, with no provider/actual mutation from the old queue |

## Concrete scenarios for unit tests

These restore all **PRE-S01-PRE-S25** from the conflict record with explicit seeds, events, function paths and assertions in the implementation plan. They are planned acceptance cases, not executed/passing premove tests. The additional rule table above supplies the per-piece and invalid-input parameterisation. Keep scenario IDs in test names so omissions are visible.

| ID | Given / when | Function path | Required data and effects |
| --- | --- | --- | --- |
| PRE-S01: chained drawing | Seed A; submit N1 then N2 during the same held Black turn | PRE-F01 -> F02 -> F08 -> F03 | FIFO `[N1,N2]`, player is actual White seat; validation reads the current live e4 position. Display Ng5, empty g1/f3; red `{6,21,38}`. Canonical knight stays g1; live/rendered paths, history, clock, timestamp and engine-search count unchanged |
| PRE-S02: consumption and cancellation | A with `[N1,N2]`; release e7e5, drain N1, then cancel before another reply | PRE-F05 -> F04 -> F07 -> F06 -> F09 -> F03 | Actual line e4/e5/Nf3; N2 alone projects on actual Nf3 with red `{21,38}`. Board cancellation removes the remainder/red; actual Nf3/history and the once-started Black successor remain |
| PRE-S03: marks, orientation and board cancellation | A with chained/shared-square sequence; flip orientation; right-click empty/ordinary/premoved squares or touch a premoved piece | PRE-F03 -> F09/F08 -> F03 | Same displaced pieces/unique red set in both orientations. Whole clear restores canonical artwork with no actual move/clock/search effect. Mouse selection still chains; touch tap cancels. No counts/buttons/Undo-last; empty cancellation is a no-op |
| PRE-S04: special drawing | R fixtures for speculative capture, promotion with a following promoted-piece step, and castling | PRE-F02 -> F03; F09 to cancel; F07 when due | Projection hides a target without adding actual captures; displays exact chosen promotion and both castle pieces; red includes rook endpoints. Clear restores canonical pieces. Actual rights/check/result and canonical FEN never come from projection; due resolution uses real legality |
| PRE-S05: explicit analysis entry | A with `[N1,N2]`, held actual search; press Analyse, then in a separate case only select history | PRE-F10 with PRE-F03 display switch | Analyse uses selected canonical node/position without displacement or red fill; queue/actual owner/search/clock preserved. Plain history selection does not enable exploration or edit the queue. Analysis entry itself consumes nothing |
| PRE-S06: independent exploration | S05; make legal analysis moves including coordinates that match queued intentions, while releasing actual replies | PRE-F10 independently of F05/F04/F06 | Analysis changes only its selected branch. Actual commits alone consume/rebase queue, update actual clock and start successor searches. Selected board/evaluation stays on its analysis node, including when actual and selected sides differ |
| PRE-S07: Exit before reply | A with queue; enter/Exit before delivering e7e5; repeat Exit | PRE-F10 -> F03; later F05/F04 | Return displays canonical actual board plus unchanged current remainder; no premature local move, clock resume, duplicate search or replay. Later reply still consumes one legal head through its original owner |
| PRE-S08: successive background turns | A/C with N1, N2, then f1-c4; enter Analyse or ordinary review. Release e7e5, b8c6, g8f6 in order, repeating wake/delivery attempts | PRE-F05 -> F04 -> F07 -> F06 for each turn | Actual line alternates Black reply/one White intention three times before Exit. FIFO drains in order; one provider per Black turn and one increment per mover at its commit timestamp. Selected canonical board/path remains fixed. After the subsequent Black reply, the now-empty local queue leaves a waiting actual local turn |
| PRE-S09: background invalidation | R with a queue; legal actual reply captures its intended source, adds a blocker or makes the due head illegal through check/pin | PRE-F05 -> F04 -> F06/F07 -> F08 | Opponent move commits once; whole remaining queue/red union disappears, local actual turn waits and its clock runs. No invalid local node/increment or retained suffix. Selected independent analysis/history board survives |
| PRE-S10: genuine paused analysis | A/C with queue; enter Analyse; add Manual/Menu in both orders; deliver actual reply; remove non-final then final owner | PRE-F10 -> F11 -> F05 -> F11/F04 | Queue and accepted reply retained; paused analysis moves/history still work. No actual commit/consumption/increment/successor while any real owner remains. Final Resume commits reply/head and starts successor once without requiring Exit; repeated Resume is ineffective |
| PRE-S11: ordinary review | A with queue; select an old/sibling node, release multiple actual replies, then return live | PRE-F10 + F04-F07 -> F03 | No queue editing from review, but valid queued moves continue. Canonical selected node remains stable, actual status/progression may update. Return projects current remainder only, never entry-time consumed entries |
| PRE-S12: selected historical anchor | Actual line has several plies; queue belongs to the actual live game. Select earlier node and explicitly Analyse with Takeback allowed and disabled | PRE-F01 -> F10 | Analysis anchor is that historical canonical node. Exploratory board/PV moves do not open rewrite confirmation or append/clear queue. Queue validation still uses the actual live position, not selected history; actual progression continues |
| PRE-S13: confirmed rewrite | A progressed beyond selected historical prefix with queue; request allowed history continuation, cancel, reopen/confirm; also deliver stale confirmation after mode/node change | PRE-F01 -> existing confirmation -> F12 | Cancel/stale/disabled confirmation preserves queue and actual game. Valid confirmed rewrite cancels FIFO and old actual provider before replacing selectors, retains played variation, relocates selection safely and starts only eligible replacement actual work. Old callback cannot commit |
| PRE-S14: actual Takeback | Analyse away from actual live node with a queue; try disabled/paused Takeback, then an allowed live Takeback during thinking and after a reply | PRE-F12 -> existing live-node/count rewind | Blocked action leaves queue intact. Allowed action clears queue and rewinds actual history/count/clock, never just the selected analysis branch. Pending output is drained; invalid selected path/input relocates. Board cancellation remains PRE-F09 and cannot remove played history |
| PRE-S15: suggestion routing | Move-enabled/score-only fixtures; choose own-colour suggestion on own turn, opponent turn, history and explicit Analyse; try engine-colour input | PRE-F14 -> F01 -> F02/F04/F10/F12 | Own due input commits one move, off-turn input appends one intention, explicit analysis plays selected legal prefix, ordinary history retains confirmed rewrite policy. Reject engine-colour raw prefixes by source-side/parity even when their source square overlaps a projected local piece. No opponent PV replies enqueued, implicit replacement or theft of engine turn; visibility preference stays independent |
| PRE-S16: active branch lifetime | From current actual parent, enter Analyse/explore descendants; actual reply/head advances while selected; Exit, navigate, save/reload. Separate case exits before any actual advance | PRE-F10 + F04/F06; existing prune boundary | Selected analysis descendants are protected while actual siblings append. Once anchor is historical, branch remains through Exit/navigation/persistence. Existing current-parent temporary prune applies only to its already-defined next actual move case; no release/Exit cleanup registry or ancestor blanket prune |
| PRE-S17: seat/first-move ownership | H in both colours/orientations; retain old click/drop/promotion/Analyse callbacks across handoff; repeat E and B0 | PRE-F14 -> F01/F02 | No queue for H/E; stale previous-side callbacks do nothing, fresh hotseat input belongs to the newly due side. B0 permits raw Black intentions before Black has played; source colour comes from the board and seat, not a node anchor |
| PRE-S18: unfinished input | A/R with drag or unfinished promotion; change actual base, queue via cancellation/rebase, mode or route; separately publish only evaluations. During delayed analysis prefix Exit/receive actual result | PRE-F14 -> selected-input reset/cancel; F09/F10/F12/F13 | Obsolete gesture/promotion/PV cannot append or commit into new ownership; incomplete choice never entered queue. Completed entries survive non-invalidating navigation/analysis. Mere evaluation behind unchanged selected board preserves valid input; result/context replacement stops delayed playback |
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
- Cancellation before due-head claim versus after committed head: the first prevents that queued move; the second clears only the remainder, preserving actual history.
- Pause before reply versus after completed reply/head: held output waits only in the former case; neither order repeats a commit/increment/search.
- Structural cancellation before readiness/result versus after completed actual move: old work cannot start/commit after cancellation; an already committed node is retained until the actual rewrite/Takeback policy changes it.
- An append/wake arriving as the current drain exits is processed by the owned action lane; there is no lost wake, recursive unbounded drain, duplicate provider or future-turn promise.
- Duplicate provider success, late failure after replacement, eligible retry and disposal during owned retry cannot mutate or restart a successor incorrectly. Use existing ponder hit/miss regression boundaries and report native execution separately.

No arbitrary queue limit, hotseat premoving, review suspension, analysis-entry clear or invalid-tail retention is restored from superseded drafts. Those conflict with the user's settled choices. The queue/data structure alone still does not make any scenario above pass.

## Implementation sequence

| Step | Work | Completion gate |
| --- | --- | --- |
| PRE-00 | Complete and verify the separate background analysis plan | Its tests were written/failed before implementation and now pass; actual clocks/turns and selected boards have an independent verified contract |
| PRE-RAW | Board-interaction raw-submission refactor: RAW-S01-RAW-S10 tests written first, observed failing, then canonical acceptance implemented | Complete: [implementation and executed verification](RawMoveSubmissionDesign.md#implementation-and-verification). Queue implementation remains pending |
| PRE-01 | After PRE-RAW passes, write raw queue data-boundary tests, migrate the declaration/imports, revise all raw scenario fixtures/assertions, then run premove behaviour tests before implementation | Pending: a fresh compiling failing baseline for the raw/no-buttons design. Old 139-case counts do not satisfy this gate |
| PRE-02 | Integrate the existing FIFO contract with one actual-turn owner and serial driver in Game runtime, PlayerTurn and GamesStore; preserve immediate input completion | One current owner/provider, owned cancellation/retry, no future-turn promises |
| PRE-03 | Integrate queue consumption/cancellation with the verified actual-turn, analysis and invalidation actions | Multiple queued local/engine turns progress behind the stable selected board; no new analysis, pause, cache or pruning redesign |
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
| PRE-A09: provider/ponder/retry | Immediate and duplicate output, late success/error, cancellation, retry and ponder hit/miss preserve one actual turn and bounded cleanup |
| PRE-A10: clocks/effects | Queue/display changes create no clock transition, increment, recorded analysis or autosave count; actual commits do so once, with timeout reconciliation during analysis |
| PRE-A11: drawing/input | Final displaced pieces/red union, chaining, partial consumption, board cancellation, both orientations, accessible labels and context-cancelled promotion/drag agree |
| PRE-A12: isolation/persistence | Canonical rendered/live boards, engine FEN, other games and saves never receive speculative pieces; restore has no queue and honours saved pause |
| PRE-A13: active branch lifetime | Background actual commits cannot remove/reindex the selected analysis branch or re-alias its board. A branch left at a historical anchor stays history through Exit/navigation; pruning remains limited to the existing own-current-move case |

The historical four-test paused-analysis baseline is in [BackgroundAnalysisPlan](BackgroundAnalysisPlan.md); it is not queue evidence. The old premove run below used the superseded entry/control contract. A new red baseline and subsequent passing evidence are required; no execution is claimed by this planning edit.

During implementation run `npm run check:code`, affected unit/integration tests, `npm run build` and the focused browser scenarios. Preserve Manual/Menu pause, UCI pondering, cancellation and independent analysis-seat regressions; replace obsolete Analysis-freeze expectations. Record exact executed counts, platforms and failures; browser evidence is not native NW.js acceptance.

Update [GamesStore architecture](LowLevel/Architecture/StateManagement/GamesStore.md), [Game runtime](LowLevel/Architecture/DataInterface/Game.md), [Chessboard](LowLevel/Architecture/Presentation/Components/Chessboard.md), [state model](HighLevel/state_model.md), [engine runtime](HighLevel/engine_runtime.md), [scenarios](HighLevel/scenarios.md) and [persistence](HighLevel/persistence_contract.md) when implementation changes. Add the new flow to the [journey plan](JourneyTestPlan.md) without relabelling old execution evidence. [Q-PLAY-001](questions/play/Q-PLAY-001-LiveProgressDuringAnalysis.md) now records the resolved background policy.

### PRE-01 unit-test baseline

**Historical, superseded contract:** this run used the previous custom entry type, expected-kind fixtures and Undo/Clear controls. Preserve it as history only, not evidence for `IMoveRaw[]` or board-only cancellation. Revised tests have not been written/run in this planning turn.

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

This is the intended focused command after the raw-contract/test migration. It was not executed in this replan. Browser gestures/focus and visible background progression require separate actual journey evidence. Native NW.js engine/ponder acceptance requires its own real platform run; mocked protocol tests cannot establish it.

## Definition of done

Completion requires approval of this design, the pending PRE-RAW submission refactor tested first and completed, a subsequent meaningful failing premove baseline, and passing affected unit/browser/static checks after implementation. Canonical positions exclude premoves; copied artwork shows final destinations/red endpoints. Eligible off-turn input appends, actual play continues during analysis/review, real pauses retain output without commits, Takeback affects actual play and invalid accepted dependencies clear the whole queue. Board cancellation uses right-click/touch/Escape with no counts/buttons. Record exact executed evidence and limits; this planning edit is not completion.
