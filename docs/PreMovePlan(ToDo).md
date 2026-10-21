# Premove and player-turn flow plan

Expanded on 21 October 2026 against the current source. **Status: proposed; implementation has not started.** Behaviour choices below are proposed defaults, not previously agreed product requirements. This work follows the ownership rules in [AGENTS.md](../AGENTS.md) and the [code cleanup plan](CodeCleanupPlan.md).

## Outcome

Allow a local player to prepare an ordered list of moves before their turns. Each move executes only when that player's next turn becomes playable and the move is legal in the actual position. Ordinary local moves, engine replies and moves retained during a pause use one player-turn flow, with one owner for the current live turn.

For example, while Black's engine is thinking after `e4`, White queues `g1-f3`, then `f1-c4`. After Black replies, White's first intention is validated and committed. Black receives its next turn; White's second intention waits for the following White turn. If Black's reply makes `g1-f3` illegal, neither White intention is played.

This is a gameplay change and an ownership refactor. Complete the ownership refactor with existing behaviour preserved before enabling the new board input.

## Current source and gaps

| Area | Current behaviour | Required change |
| --- | --- | --- |
| [Game runtime](../src/contracts/Game.ts) | Three separate pending-turn fields and one `deferredPlayerMove?: IMove` slot | One current-turn record and a runtime-only ordered intention queue |
| [Player turn](../src/state/game/GamePlayerTurnComposable.ts) | Local input and engine output resolve the same `Deferred<IMove>`; the handler either commits or fills the paused slot | Keep shared delivery, but make ownership, input acceptance, queued work and completion explicit |
| Turn creation | Duplicate private creation throws; public arming returns if a turn already exists | Preserve this invariant through commit, cancellation and provider cleanup |
| Pause/resume | An existing engine search can finish while paused; resume flushes the separate slot directly to `commitLiveMove` | Suspend execution and resume through the same turn driver used after any accepted input |
| [Move actions](../src/state/game/GameMoveComposable.ts) | Live input expects an armed current turn; history and analysis have separate commit paths | Route deliberate future input to the queue without treating analysis/history moves as premoves |
| [Board](../src/components/Chessboard.vue) | Click selection and legal targets use `position.sideToMove`; promotion produces a detailed move immediately | Add an explicit speculative input mode and emit raw intentions for future moves |
| [Game view](../src/views/GameView.vue) | Board input is disabled during an engine turn; `applyMoves` validates suggestions against the rendered position | Derive local-seat input capabilities and give premoves their own explicit submission action |
| [Engine runtime](../src/domain/EngineRuntimeService.ts) | Validates actual and ponder moves against their searched positions | Preserve protocol/legality ownership and bind delivery to the actual turn that requested it |

The original note's `pendingPlayerTurnPromise !== pendingPlayerMove` guard was already removed by the cleanup. Do not reintroduce it. The remaining issues are the separate paused slot, lack of future-input semantics and turn/provider lifetime handling. `flushDeferredPlayerMove` currently commits without a fresh legality check; premove validation must be introduced at its acceptance boundary.

The current handler clears its pending fields before committing, and its unexpected-error retry uses an unowned timeout. Both need explicit treatment when replacing the turn flow; removing the old identity guard alone does not define a queue.

## Proposed user behaviour

| Situation | Behaviour |
| --- | --- |
| Local player, current playable live turn | A normal move commits through the current turn owner |
| Local player, opponent's turn | Selecting that local player's piece enters premove input; completing a target appends an intention |
| More than one queued move | Append in that player's order; consume at most one intention per turn |
| Local versus local | Either colour can prepare future moves; the selected piece's colour identifies the queue. Current-side normal input still takes precedence |
| Engine versus engine | No manual move or premove input; engines retain their assigned seats |
| Manual/Menu pause | Retain existing intentions and accepted engine output. Disable new board submissions and execute nothing until the final applicable pause reason is removed |
| Explicit in-game analysis | Clear local premove intentions on entry; retain the suspended live turn and any accepted engine reply. Analysis moves belong only to the rendered branch |
| History review | Clear local intentions when leaving the live node; preserve the existing policy for an already-running engine reply and background live progress |
| Free analysis, completed game or board edit | Existing move/edit behaviour; no premove creation |

Premoving is available for assigned local seats at the live board without a new persisted setting in the first release. Start with a maximum of eight pending intentions per colour; reject further appends with visible feedback. Do not silently replace the oldest move. Treat the limit as a product default that can change without changing the ownership model.

Queues are transient: saving, exporting and restoring a game never serialises intentions, turn promises, controllers or preview state. This plan does not add conditional reply trees, opponent-move prediction, background premove editing or a new chess variant.

## Ownership and data model

Names below describe proposed responsibilities; final interfaces should follow repository naming and remain small.

| Owner/record | Responsibility and lifetime |
| --- | --- |
| `IGameRuntime.turnFlow` | Per-game runtime owner of the current turn, queued intentions and serialised driver/transition work; created during hydration and disposed with the workspace game/store |
| `IPlayerTurn` | Captures the game, actual live parent node, moving colour and assigned player; owns its abort controller, one completion and any provider startup/delivery work |
| `IDeferredMoveIntent` | Raw `from`, `to`, optional promotion choice, expected colour/piece, and provenance. Distinguishes a local future intention from an accepted current-turn result |
| Accepted current-turn result | Belongs to its captured `IPlayerTurn`; retains the accepted move while execution is paused. At most one exists for that turn |
| Local future intention | Belongs to the game's current live continuation and a local seat, with dependencies on earlier intentions for that seat. It does not create a future turn or promise |
| Board input session | Owns selection, drag and unfinished promotion against the displayed game/node and input mode. It may submit once and is cleared when that context changes |

Replace `pendingPlayerTurnPromise`, `pendingPlayerTurnHandlePromise`, `pendingPlayerTurnAbortController` and `deferredPlayerMove` together. A `Deferred` may remain an internal one-shot completion primitive; it must not become a list of speculative turn promises. Expose read-only queue/capability projections and store actions rather than controllers or mutable arrays to presentation.

Use one ordered deferred list with explicit entry kinds. Ordering is FIFO **within each colour**: the driver selects that colour's earliest eligible entry. An intention for White cannot block Black's actual engine reply. Never skip an illegal head to try a later intention for the same colour. A current-turn result is already claimed by its turn; later input cannot replace it by appending another result.

An intended position is the position at the next owned turn on the same live continuation, after that seat's preceding intentions have executed. It is not an exact predicted FEN: opponent replies are unknown. Store actual node/seat ownership and expected source-piece information. Rewrites and seat changes explicitly cancel this ownership; matching coordinates, FENs or a return to an old node do not revive it.

Keep runtime queue publication separate from move commits. Publish queue changes through the existing raw-game rendering boundary, extracting a runtime-only publication helper from `touchGame` if needed so preview edits do not change persisted `metadata.updatedAt`. Only committed moves invoke the move-count/autosave hook.

### Invariants

- At most one current-turn owner and one provider delivery may be active for a game. Attach the owner before starting any engine work, including readiness.
- A turn owns the actual live parent and seat, independent of which historical board is rendered. Existing background engine completion during history review remains possible.
- Keep the owner attached through its atomic commit. Retire it before starting the successor; do not clear shared ownership in an old handler's `finally` after replacement is allowed to start.
- Cancellation closes input synchronously, aborts owned work and settles/drains it before a replacement starts. Concurrent invalidating actions join the same transition and then re-evaluate their preconditions.
- Future intentions have no waiting callers. Submission returns an acknowledgement of queuing; it must not leave a UI or engine callback awaiting an eventual resume or future turn.
- No new watchers, polling loops, generation/epoch/sequence counters or promise-identity invalidation guards. Computed values derive capabilities; explicit actions and lifecycle hooks drive effects.

## Shared turn driver

Keep one guarded driver per game and call it from explicit actions: turn activation, accepted input, live commit completion, resume, return to live and eligible recovery. Repeated calls join existing work rather than starting a competing driver. Serialise wake requests with the action lane so input arriving as a drain exits gets another pass rather than being lost. Use a small iterative drain; do not recursively arm and commit a long queue on the JavaScript stack.

1. Reject work for a disposed, transitioning or ended game. Reconcile clock expiry before accepting an executable move.
2. Retain the current owner if its live parent/seat still belong to the game. When a new turn is eligible under the existing scheduling policy, attach its owner before starting its provider.
3. If a pause or explicit-analysis owner blocks execution, retain the turn/result/queue and return. A plain history review still follows the existing background-completion policy; rendered/live equality is not a new blanket commit requirement.
4. For the moving local seat, select its earliest intention, resolve it against the actual live position and claim it as the turn's result. A fresh normal submission can provide the result when no intention has already been claimed. An engine seat gets its result only from its bound provider.
5. If no accepted result exists, leave the local turn waiting or start the engine provider once. Starting a provider and waiting for its result must not block the action lane needed for pause or cancellation.
6. Reconcile timeout again at the commit timestamp. Commit exactly once through `commitLiveMove`, retaining the established history, clock, recorded-analysis, analysis-refresh and autosave behaviour.
7. Finish and detach that turn, remove its consumed result/intention, publish queue state and evaluate the next turn. Stop if the result ends the game or scheduling policy requires waiting.

Separate ordinary input acknowledgement from the internal completion used to drain a turn. Existing immediate `makeMove` callers must still observe the completed move before advancing playback; the new queue action acknowledges immediately. An engine callback only submits its result and wakes the driver, acknowledging acceptance without waiting for commit or resume. Drain its delivery task outside that callback before retiring the turn and starting a replacement provider. Avoid a completion cycle where cancellation or commit waits for a provider that is itself awaiting the same turn.

Refactor `_finaliseLiveMove` and its callback wiring so successor scheduling is owned by this driver. Resume and `exitInGameAnalysis` also invoke it; remove their independent flush-and-request paths. Analysis/history commit routes retain their current ownership and never enter the premove drain by accident.

Queue creation and editing do not pause a running clock. Use each actual commit's timestamp and existing elapsed-time/increment policy; add no artificial premove delay, minimum deduction or zero-time exemption. A paused result receives its increment only on actual commit after resume, and a turn that has already expired cannot be rescued by queued input.

### Input arbitration

- A current input session is bound to its captured turn/node. If an engine reply or another move changes the board before the gesture/promotion finishes, discard that unfinished session; do not reinterpret its eventual event as a new future intention.
- Accept only one current-turn result. Duplicate delivery from the same completed gesture/provider is ineffective and cannot move the next turn.
- A deliberate local move that replaces an unclaimed queue clears that seat's intentions first. Once an intention has been claimed for commit, cancellation is subject to the same action ordering as any accepted move.
- Cancellation accepted before commit prevents that commit. A completed atomic commit remains part of history before a later cancellation/rewrite action proceeds. Test both orders with controlled barriers rather than adding delayed stale-result checks.

## Validation and speculative targets

Store future input as raw intentions, not complete `IMove` objects. `movingColour`, `movingPiece`, capture kind, castling/en-passant kind, check state, ambiguity and notation depend on the eventual position. A preview must not supply these fields to the actual commit.

At a local intention's turn:

1. Confirm ongoing live ownership, the expected local seat and side to move, and the expected source piece in the actual live position.
2. Find the matching legal raw move with the existing rule utilities, including the exact promotion choice. Do not mutate `sideToMove` on the real position to simulate legality.
3. Generate a fresh detailed move using `toDetailedMove` and the actual legal candidates, then commit it through the shared turn owner.
4. If resolution fails, remove that intention and all later intentions for that colour, publish the cleared preview and show a brief reason such as `Premove cancelled: the move is no longer legal`. Leave the current local turn waiting for manual input. Preserve the opponent's independent queue.

The illegal head is not retained until it becomes legal on a later turn. A missing/captured source, blocked path, changed capture, check, lost castling rights, expired en-passant opportunity or ended game must never result in a partial move or history node.

Engine output remains validated at `EngineRuntimeService.awaitPlayerTurnMove`, against the position searched by the captured turn. A paused result can retain that validated detailed move while its parent remains unchanged; no second engine search is needed. Ownership changes cancel it rather than transplanting it to a different parent. Future local intentions always require fresh validation. Leave normal current-board validation at its existing acceptance boundaries rather than adding repeated checks throughout the commit stack.

### Preview rules

`genLegalMovesForPiece` only supports the side to move and full current legality. Add a separately named pure utility for **speculative targets** and a pure projection of a seat's preceding intentions. Do not export/relax the existing legal-move API or run ordinary legal move application on a knowingly speculative position.

The proposed initial target policy is conservative about occupancy, but does not claim future king safety:

| Piece/case | Queue-time target policy | Actual-turn requirement |
| --- | --- | --- |
| Knight/king | Movement geometry; reject friendly occupied destinations and captures of the opposing king. Ignore current attacked-square/check restrictions for this preview | Full legal move, including king safety |
| Bishop/rook/queen | Movement geometry with paths blocked by the current projected occupancy | Recheck the actual path and king safety |
| Pawn push | Correct direction; currently projected empty destination/path; double push only from its starting rank | Full current pawn legality |
| Pawn diagonal | Allow an enemy-occupied or empty diagonal, excluding the enemy king, because a capture or en-passant opportunity may arise | A legal capture/en-passant move must actually exist |
| Castling | King/rook present, existing castling right and projected clear path; ignore attacked-square restrictions in the preview | All actual castling conditions still hold |
| Promotion | Request queen/rook/bishop/knight before appending; apply the chosen kind only to the speculative projection | Exact chosen promotion is legal; never silently substitute a queen |

This first policy does not offer slider paths through pieces that an unknown opponent reply might move away. It does allow preparing a check response that is not currently safe. Document these limits in the input help.

For chained moves such as `g1-f3`, then `f3-g5`, project only that seat's earlier intentions in order. Keep the opponent's pieces at their last known squares except speculative captures; do not invent opponent moves or copy this projection into canonical state. Rebuild the projection from the actual board and the remaining intentions after each actual commit. If a future dependency no longer projects, mark that suffix unavailable for editing; its first due intention is still resolved/cancelled at the actual-turn boundary, unless an explicit ownership change clears it sooner.

## Pause, cancellation and engine lifecycle

| Boundary | Local intentions | Current turn/result and execution |
| --- | --- | --- |
| Add Manual/Menu pause | Preserve | Freeze commits immediately; an already-started engine may finish and retain one accepted result |
| Remove one of several pause reasons | Preserve | Remain suspended; no move, increment or new search |
| Remove final applicable reason at live board | Preserve | Resume clock, reconcile expiry and invoke the driver; consume a retained result once |
| Enter explicit in-game analysis | Clear | Keep the suspended live owner/result; exploratory moves cannot consume it |
| Exit explicit analysis | Already cleared | Remove only Analysis ownership; resume only when other pause reasons permit |
| Navigate from live board into history | Clear | Preserve existing scheduling/background-result behaviour; reviewed positions are never queue targets |
| Takeback, history rewrite, setup restart or board replacement | Clear both colours before changing paths | Close input, abort/drain the old turn/provider, then establish the new live/analysis context |
| Any player reassignment, including Local to Engine/Unassigned | Clear both colours | Drain the old owner before replacing the assignment; late delivery cannot target the replacement |
| Timeout, resignation, accepted draw, rule-resolved end or abandonment | Clear | Settle ownership and prevent all further delivery/arming; synchronous timeout reconciliation must also initiate owned cleanup |
| Leave GameView, switch game or close its tab | Clear the departing game's local intentions via explicit route/close actions | Preserve the application's current Menu-pause/background-engine policy; returning never restores cancelled intentions |
| Save/export | Preserve in memory only | Serialised document contains no queue or turn runtime |
| Restore/hydrate | Empty | Build one fresh eligible turn after hydration, with no replay of saved pending input |
| Workspace game/store disposal | Clear | Abort/drain turn work and dispose retry resources; late provider success/error has no consumer |

Pause is suspension, not cancellation. Reuse the existing pause-reason set and clock semantics, including the current restrictions on Manual/Menu pauses for untimed games. Do not turn pause into an engine stop/restart policy as part of this feature.

Capture the searched live position at turn creation, before asynchronous readiness. Audit `ensureReady`/`startPlayerTurn`/callback wiring so delivery uses that captured parent instead of looking up whichever turn is current after an await. Keep the engine callback bound to the real turn owner and abort signal; it must not call an unqualified current-game resolver that could settle a replacement turn.

Provider cancellation must drain the relevant client search/stop boundary, not merely reject a move promise. Preserve browser/NW.js UCI ordering and isolate other games and analysis seats. Long-lived pondering belongs to the engine runtime, not to a turn's completion: retiring a committed turn must not wait indefinitely for pondering. Feed actual premoves into the existing ponder hit/miss path and test immediate replies, mismatches and interruption while pondering.

Replace the anonymous 500 ms retry timeout with an owned, cancellable retry resource. Preserve delayed recovery where currently supported, but allow at most one retry, cancel it at turn/seat/game invalidation and re-enter the same arming gate. Cancellation is expected settlement; a genuine provider failure remains visible/logged. No tight retry loop or new automatic reconnect policy.

## Board and control presentation

- Derive an explicit input capability/mode for current local move, local premove, analysis, edit or disabled. During an engine turn, permit only the opposing assigned local seat's premove input. Apply the same permission rules to click, drag, drop and keyboard entry.
- Keep the actual live board and last-move indication authoritative. Show queued origins/destinations with distinct numbered markers and a labelled `Premove preview` for the selected seat. Chained input selects projected pieces in that preview; switching back restores the actual board without committing anything.
- Show an ordered queue list, `Undo last premove` and `Clear premoves` for the selected local seat. Undo removes the tail; clearing removes that seat's queue. If later removal of an earlier entry is added, remove its dependent suffix too.
- Escape cancels the unfinished gesture/promotion first; Escape with no unfinished input clears that seat's queue. An explicit clear control provides the same action for touch users. Cancelling intentions never discards the opponent engine's accepted reply.
- Promotion selection belongs to the captured board input session. Board/mode change, route leave or Escape closes it; no append occurs until a piece is chosen. A late promotion click cannot submit to a new turn.
- Announce queued, removed, cancelled and executed moves through accessible text; include colour and promotion choice. Distinguish queue markers from legal current targets and last-move highlights without relying only on colour.
- Own board/preview presentation in [board.css](../src/assets/styles/board.css) and shared control variants in their existing global owner. Use no Vue style blocks, scope escapes or inline presentation bindings.

Queue clearing, input-session disposal and route handling must be explicit actions. Reuse the documented Chessboard external-prop reset boundary only where external input really changes; any necessary input-contract change must update its narrow reason and audit policy. Do not add a gameplay watcher or use remount counters as cancellation.

## Implementation sequence

| Step | Work and owning files | Completion gate |
| --- | --- | --- |
| PRE-01 | Characterise existing turn, pause, background history, engine delivery/retry and terminal cleanup in focused store/runtime tests. Review the above defaults before enabling UI | Tests assert public moves/searches/clocks and settlement, with controlled async barriers |
| PRE-02 | Introduce the turn-flow runtime and serial driver in `Game.ts`, `GamePlayerTurnComposable.ts` and `GamesStore.ts`; migrate all four old fields together | One owner survives through commit; cancellation drains before replacement; immediate callers retain completion semantics |
| PRE-03 | Route pause/resume, analysis exit and move finalisation through that driver in `GameClockComposable.ts`/`GameMoveComposable.ts`; integrate provider lifetime and retry cleanup | Existing pause/analysis race tests still pass; no separate deferred flush or replacement-turn delivery |
| PRE-04 | Add raw local-intention enqueue/cancel actions, bounded per-colour ordering, legal resolution and pure speculative projection/target utility | Single and multiple premoves work through store actions; illegal heads clear their suffix; no canonical mutations during preview |
| PRE-05 | Add GameView capabilities, Chessboard premove gestures/promotion, queue controls, route cleanup and global styles | Both orientations and all supported input methods use the same intent contract; engine-seat input remains blocked |
| PRE-06 | Extend journey fixtures/browser coverage and update architecture/product documentation | Acceptance matrix below passes and verification is recorded with its actual scope |

Keep helpers focused and normally under 35 lines, using meaningful private functions for turn activation, validation, commit and cancellation. Preserve UK spelling, interface naming and TypeScript semicolons. Do not reuse `OperationOwner.run` as an append queue: its current contract supersedes existing work. Reuse it only at a boundary whose actual policy is replacement.

## Verification and acceptance

Use real chess-rule utilities for position-dependent tests. Existing `GamesStore.spec.ts` mocks help test orchestration but cannot prove premove legality; add focused store/rule integration coverage with actual positions. Use deferred/barrier-controlled provider results and fake time for races/retries, with assertions on settled tasks and search/listener cleanup.

| Case | Required evidence |
| --- | --- |
| PRE-A01: one/multiple intentions | Queue a local move during an engine turn; nothing changes early. Each legal intention commits on its own next turn, once, with one corresponding engine search per engine turn |
| PRE-A02: ordering and ownership | Chained same-piece moves, independent piece moves, both-colour queues, bounded append and duplicate delivery; neither colour blocks or consumes the other's entries |
| PRE-A03: illegal head | Captured source, new blocker, friendly target, check/pin and lost right/opportunity cancel that colour's suffix with no history/clock mutation and leave manual input available |
| PRE-A04: canonical move details | Capture becomes quiet/quiet becomes capture, en passant appears/expires, castling succeeds/fails, all four promotions and check/ambiguity are resolved from the actual position |
| PRE-A05: pause ownership | Existing engine output and local intentions survive Manual, Menu and layered pauses; removing a non-final reason commits nothing. Final resume commits one retained result without another search |
| PRE-A06: analysis/history | Exploration never queues live input; analysis entry and route/history departure clear intentions. Retained live replies preserve current background/analysis policies and never move the explored board |
| PRE-A07: invalidating actions | Takeback, history rewrite, setup replacement, seat reassignment, result/timeout and disposal settle all old work. Test move-first/cancel-first orders and returning to the same game/node/seat |
| PRE-A08: provider lifecycle | Pause during readiness/search, immediate output, late success/error, duplicate callbacks, owned retry cancellation and stop draining cannot arm a second turn or deliver into replacement ownership |
| PRE-A09: ponder interaction | Immediate premove hit, miss, illegal/cancelled premove and interruption during pondering preserve protocol ordering and exactly one actual move |
| PRE-A10: clocks and commit effects | Queue/undo/clear performs no clock transition, increment, history node, recorded analysis or autosave count; running time continues normally. Each actual move applies existing clock policy once; an expired clock wins over an uncommitted intention |
| PRE-A11: input and accessibility | Both colours/orientations, click/drag/keyboard, chained preview selection, queue limit, undo/clear/Escape and promotion cancellation; externally changed context discards unfinished input |
| PRE-A12: persistence and isolation | Saves/exports omit runtime; restore starts empty. Another game's queue and independent engine seats remain unaffected by clears, provider failures or disposal |

Run `npm run check:code`, the affected unit/integration suites, `npm run build` and focused browser journeys. Existing regressions include [engine pause/analysis races](../e2e/journeys/engine-races/Pause.spec.ts), the remaining engine-race cases, clocks, history, promotion, fresh-engine play and browser/desktop UCI pondering. Extend the existing journey structure with owned premove cases/fixtures; do not claim native NW.js execution from browser tests alone.

Use the portable Node/npm paths from the workspace instructions when running checks. Record exact commands, executed case counts and failures; this plan itself claims no new passing premove tests.

Update [GamesStore architecture](LowLevel/Architecture/StateManagement/GamesStore.md), [Game runtime](LowLevel/Architecture/DataInterface/Game.md), [Chessboard interaction](LowLevel/Architecture/Presentation/Components/Chessboard.md), [engine runtime](HighLevel/engine_runtime.md), [scenarios](HighLevel/scenarios.md) and the [persistence contract](HighLevel/persistence_contract.md) with the implemented behaviour. The [journey baseline](JourneyTestPlan.md) currently excludes premoves because they have no current flow; add the new acceptance scope when that flow exists, without relabelling historical test results.

## Definition of done

Multiple local premoves can be queued, inspected and cancelled; each is freshly resolved at its actual turn. Pauses and ordinary moves share the same driver, one current owner controls every commit, invalidation settles old work, and no queue data enters persistence. Existing history, clock, engine and analysis behaviour has passing regression evidence, and the documented defaults match the shipped UI and tests.
