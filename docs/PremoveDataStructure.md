# Premove data structure

Replanned, approved and implemented on 23 October 2026 after reversing the rejected turn-resolution rewrite. The FIFO retains `IMoveRaw` references; the existing turn runtime receives a shifted head through `attemptPlayerMove`. See the parent plan's [current implementation verification](PreMovePlan%28ToDo%29.md#implementation-verification---23-october-2026). Historical baselines below predate this implementation.

The [parent plan](PreMovePlan%28ToDo%29.md) retains [14 function flows](PreMovePlan%28ToDo%29.md#function-flow), [25 scenarios](PreMovePlan%28ToDo%29.md#concrete-scenarios-for-unit-tests) and the [tests-first specification](PreMovePlan%28ToDo%29.md#data-driven-unit-test-specification). The separately completed analysis prerequisite stays unchanged.

## Completed submission prerequisite

Reusing the type in the FIFO builds on the completed [board-interaction refactor](CodexFollowUp.md#raw-move-submission), [PRE-RAW](PreMovePlan%28ToDo%29.md#pre-raw---raw-move-submission-refactor). Board/PV/modal and view/store submission now remain raw; canonical acceptance supplies `IMove` to history/commit. The [verification](ArchivedPlans/RawMoveSubmissionDesign.md#implementation-and-verification) completes only this prerequisite, not the queue declaration or premove scenarios.

The separate [raw submission API design](ArchivedPlans/RawMoveSubmissionDesign.md) specifies the callable/event signatures, canonical conversion boundary, ownership, completion/error behaviour and tests. It governs the input refactor; this document governs the later plain queue structure.

PRE-RAW selection/promotion/submission assertions were written and failed before implementation. The delivered flow is `legal IMoveRaw -> completed raw promotion -> board event -> raw view/confirmation/playback -> raw store acceptance -> canonical legal resolution/toDetailedMove -> accepted IMove commit/history`. Full types remain for the [audited clock/history/SAN and engine-result consumers](ArchivedPlans/RawMoveSubmissionDesign.md#type-retention-audit-and-justification). Application requires existing `IMoveCandidate`; PV/modal submission and ponder commands use raw input. Saved game schemas and engine behaviour remain unchanged. Temporary detailed PV-preview steps are local look-ahead data, not queued or submitted authority.

The approved off-turn branch intercepts raw input before canonical enrichment; its due turn generates actual details later. The completed raw input refactor supplies the submission prerequisite; this implementation adds the queue behaviour.

## Reuse the existing move contract

Use [IMoveRaw](../src/contracts/Move.ts), not a premove-specific entry interface or alias. Its existing fields are `from`, `to`, optional `promotionPiece` and optional runtime `$`. Do not change this shared chess contract merely to narrow promotion choices or specialise it for queues.

The only queue container is application runtime data:

```ts
import type { IPlayer } from './Game';
import type { IMoveRaw } from './Move';

export interface IPremoveQueue {
  player: IPlayer;
  moves: IMoveRaw[];
}
// Within the existing IGameRuntime:
// premoveQueue?: IPremoveQueue;
```

Keep the existing queue container/location to minimise change; delete the superseded `IPremove` declaration/export and update imports rather than aliasing it or introducing another contract file/library. An absent queue means no intentions; clear the optional queue after its final entry is consumed/cancelled.

| Data | Meaning |
| --- | --- |
| `player` | Actual human seat object supplied at creation; context routing establishes eligibility and structural actions clear the queue when ownership changes. Consumers trust this invariant rather than comparing against cloned owners |
| `moves` | FIFO of existing `IMoveRaw` values. Index zero is for the next actual local turn; later entries depend on earlier intentions in order |
| `from/to` | Absolute board IDs, independent of orientation. A later source may be an earlier destination |
| `promotionPiece` | Explicit chosen promotion when required. Validate queen/rook/bishop/knight through chess rules; `IMoveRaw` itself deliberately remains generic |
| `$` and structural extra fields | Supplied object is retained as `IMoveRaw`; it may already carry PV details or a runtime cache. No sanitising copy. Consumers use coordinates/promotion; actual accepted details come from the actual board |

Trust the producer's possible, completed move and retain its object directly. `_appendPremove(game, player, rawMove)` initialises the FIFO if absent, calls `moves.push(rawMove)` and publishes. No field reconstruction, clone, sanitation or validation. Produced coordinates/promotion remain stable; the queue mutates its own array with push/shift/clear, not its entries. Board/PV/view/confirmation/playback pass the same move references. Existing `IMove` entries are structurally usable as `IMoveRaw`; actual metadata is still generated from the due board.

## No stored expected kind or anchor

Source kind/colour comes from the board at each projected step; actual execution reads the actual board again. A chosen promotion changes the copied piece, so a later raw move naturally uses that promoted kind. Do not add `movingPiece`, source identity, sidecar expected-kind data, entry IDs, signatures or duplicate snapshots to replace the removed type.

Queue ownership supplies the required local colour. The existing live selector supplies the base after every real move, including Black queuing before its first actual move. No `anchorNode`, last-own-move node/path, copied FEN or last-validated node is stored. Takeback, confirmed rewrite, changed seat/root and terminal actions explicitly invalidate the queue before replacing ownership. Equal coordinates or returning to an old position never revive it.

The queue adds no detailed-move wrapper, expected facts, future-turn promises, callbacks, controllers, speculative history, boards or red arrays. Supplied objects may structurally contain PV details; these are not execution authority. Actual asynchronous ownership remains separate.

## Keep the existing actual-turn runtime

Premove entries are plain future input. They do not require replacing actual-turn ownership or changing its completion semantics. Retain the existing fields and types in `IGameRuntime`:

| Existing data | Existing purpose, retained |
| --- | --- |
| `pendingPlayerTurnPromise?: Deferred<IMove>` | Current actual turn's input. `attemptPlayerMove` resolves it for ordinary local input, engine output or a due premove |
| `pendingPlayerTurnHandlePromise?: Promise<void>` | Existing handler settlement, including storing genuinely paused output. It is not a new promise awaiting eventual Resume/commit |
| `pendingPlayerTurnAbortController?: AbortController` | Existing current-request cancellation; retain existing abort and handler-settlement flow |
| `deferredPlayerMove?: IMove` | Existing accepted actual output held during a genuine pause. A shifted local head uses the same slot if pause wins before commit |

`_requestPlayerMove` registers these pending fields as today. Its engine branch stays unchanged; its new Local branch calls `_tryPremove(game)`, trusting the registered request and queue feasibility already established after the actual move. Resolve only the head's actual legality, build fresh `IMove`, shift once and immediately call `attemptPlayerMove`, with no intervening await. Existing handler commits/holds; existing finaliser requests the successor. Empty queue/illegal due head leaves the same Local request waiting. No repeated projection, mode, seat, runtime or whole-queue checks.

Do not add `IPlayerTurn`, `playerTurn`, claimed-head/result/provider fields, a scheduler, delivery acknowledgement, per-entry promise or new public turn API. Do not move successor arming out of `_finaliseLiveMove`, remove `flushDeferredPlayerMove` from final Resume or change engine/provider/retry handling. The [parent flow](PreMovePlan%28ToDo%29.md#pre-f04---request-the-ordinary-actual-turn-and-try-its-premove) gives the exact call order.

If pause happens before the request, the FIFO is unchanged. If pause happens after shift/submission but before the handler commits, the accepted move is held in `deferredPlayerMove`, with only the tail queued. Final Resume flushes that same move, then revalidates the tail; never shift it twice or reinsert it. Paused following-live display may derive held local output plus the tail on a copy, including the held move's red endpoints. Held engine output remains unprojected until actual commit. No additional state is required.

## Concrete call and type boundaries

The [14 function-call tables](PreMovePlan%28ToDo%29.md#function-flow) are the implementation reference. Each lists caller, arguments, work, branch and mutation/await boundary; the [25 scenario rows](PreMovePlan%28ToDo%29.md#concrete-scenarios-for-unit-tests) now name their actual entry and decisive calls. Proposed calls are marked new, so they cannot be mistaken for available APIs.

| Data crossing a call | Specific producer/consumer and lifetime |
| --- | --- |
| Shared `IMoveRaw` | `Chessboard._emitMove -> GameView._requestMoves -> GameMoveComposable._appendPremove(game, player, rawMove)`. Same object reference throughout; no destructuring/rebuilding or field sanitation. Queue array is new only on initialisation |
| Temporary `IMoveCandidate` | Returned internal `GamePositionComposable.applyPremoveProjection` derives application facts from caller-owned preview and calls `MoveApplicationService.applyMove(preview, candidate)` in place. Required semantic enrichment, not payload cloning. Shared by drawing/revalidation; no board copy or candidate query inside this helper |
| Actual accepted `IMove` | `GamePlayerTurnComposable._tryPremove -> genLegalMovesForPiece(actual, head.from, actualNode.move) -> toDetailedMove(actual, legalCandidate) -> moves.shift -> attemptPlayerMove`. Required by the existing actual-turn/clock/history contract. No await between shift and resolver call; existing handler owns the move thereafter |
| Detached projection result | `getPremoveProjection(base, queue?, heldLocalMove?)` creates one board/rights copy for the full pass. Apply optional held reference, then iterate existing queue references. No combined sequence, per-entry board clone or invalid-data fallback; return derived position/red set |
| Runtime-only publication | New `GamesStore._publishRuntime` increments existing `workspaceRevision`; queue append/clear and held-head display use it. Existing `_touchGame` still owns canonical timestamps. New shared `clearPremoves(game)` clears raw FIFO only; it does not cancel the actual Deferred or held output |

The concrete wiring is also recorded in that flow: new `publishRuntime`/`clearPremoves` dependency callbacks, the single Local branch after existing `_requestPlayerMove` registration, revalidation before the existing finaliser's successor request, and clearing at each named accepted structural/result action. There is no implied turn-driver or dependency restructure hidden behind a generic flow label.

## Plain-data fixtures and derived output

After constructing/hydrating the game, bind its actual seated player:

```ts
game.$!.premoveQueue = {
  player: game.whitePlayer!,
  moves: [
    { from: 6, to: 21 }, // g1-f3
    { from: 21, to: 38 }, // f3-g5
  ],
};
```

For a canonical White knight on g1, projection expects Ng5, empty g1/f3 and red IDs `[6, 21, 38]`. Canonical pieces/side, tree, selectors, clock, captured totals and timestamp stay unchanged. Pieces and red squares are derived from a detached board; they are not additional queue authority. No engine, timer or component is needed to construct this data.

A promotion fixture uses `{ from: 48, to: 56, promotionPiece: PieceKind.Knight }`, then `{ from: 56, to: 41 }` for a8-b6 on a board with a White a7 pawn. The second move stores no Knight field; projection/execution derives it after the chosen promotion. An invalid King/Pawn promotion choice rejects without narrowing/replacing `IMoveRaw`.

## Mutation and lifecycle flow

| Action | Data flow |
| --- | --- |
| Eligible off-turn move | Initialise if absent, append supplied reference and publish. Rendering derives its picture separately; no move copy |
| Actual commit | `_revalidatePremoves` owns one feasibility pass before publication/request: clone actual board/rights once, check changed-board source/candidates and advance same preview in place through `applyPremoveProjection`. Failure clears whole queue; no per-entry projection clone, wrapper array or highlight set |
| Actual local turn request | Trust registered Local Deferred and established sequence feasibility; match actual legal head, build details, shift, normalise empty and immediately call `attemptPlayerMove`. No whole-queue projection or repeated ownership/readiness checks |
| Accepted local head | Existing handler owns commit or real-pause holding. No second dequeue at commit. Revalidate only the remainder from the new actual board before the existing successor request |
| Invalid accepted dependency/head | Clear every remaining entry immediately, including a currently legal head if a later dependency is already unprojectable. No skipped prefix/tail or partial history |
| User cancellation | Board right-click anywhere, touch tap on a premoved piece, or owned Escape clears all remaining entries. No Undo-last API, premove buttons, count or list. Preserve actual played history |
| Analyse/history/temporary navigation | Retain the queue; actual commits consume/rebase it in the background. Selected analysis/review stays canonical and unshaded. Return projects only the current remainder |
| Real Manual/Menu pause | No new request shifts a head. Already shifted/submitted local output uses existing `deferredPlayerMove`; tail stays queued. Keep existing final-Resume flush/request path and paused analysis entry/moves/history |
| Actual Takeback/rewrite, changed seat/root, terminal result, explicit tab close/disposal | Clear at the actual mutation boundary, after existing awaited cleanup where applicable, so old-context appends cannot survive replacement. Keep existing cancellation/context handling; add no downstream owner comparison. Cancelled/no-op/blocked actions preserve queue; other games stay independent |
| Save/export and hydration | Existing schema omits runtime `$`; save preserves the in-memory FIFO. A loaded/imported/hydrated game starts empty and retains any genuine saved pause |

All queue edits preserve canonical serialized bytes, move history/count, clock/increment, recorded analysis and timestamp. Raw games publish through existing `workspaceRevision`. Stable input retains queue/head/tail/held-local references with canonical context; unchanged context returns its previous projection before allocating another. Push/shift/clear uses references, without copying entries/arrays or adding counters. Share projection red set through `ReadonlySet<BoardId>`, without array conversion. One actual move produces canonical effects once; Exit neither resumes clocks nor replays entries.

## Test migration and evidence

1. Complete PRE-RAW with its own failing-then-passing tests for legal selection, promotion, view submission/confirmation/playback and canonical enrichment; preserve detailed service/engine/history boundaries. Then write the raw queue data-boundary assertions and migrate the declaration/imports to make that small contract green. Update fixtures/helpers to bare coordinates and promotion choices; no expected-kind argument.
2. Revise data-driven state/rule/mounted tests before gameplay development. Replace obsolete expected-kind tests with real-source geometry/colour/promotion cases, and button/Undo tests with whole-queue board cancellation. No raw-to-detailed casts or test-side queue engine.
3. Record a fresh compiling failing baseline for all PRE-S01-PRE-S25. Missing symbols/types alone are not behavioural evidence. Then implement through the existing owners and verify unit, browser and build/audit boundaries.
4. Assert supplied seat and move object identity, including frozen move inputs and no coordinate/promotion mutation by consumers. Retain promotion dependencies, Black's first move, full invalidation, serialization/hydration isolation. Remove cloned-owner rejection, dropped-field and post-submission caller-mutation isolation requirements; those demanded defensive copies/checks.

The append correction supersedes impossible-input store rejection/trial-projection assertions. Move those to input/rule boundaries; retain changed-board invalidation/due legality. Add an append assertion `queue.moves[0] === suppliedMove`, no mutation, no projection/query. Copy-isolation/raw-field-stripping tests are also superseded. Existing tests remain for the next tests-first migration; historical results predate these responsibility/reference corrections.

Copy boundaries are explicit: one detached simulation board per drawing/revalidation pass; existing independent analysis/full-prefix previews retain required isolation. Share immutable piece and move objects. No full board snapshot for castle shading: read rook endpoints before applying it. A selected-prefix array may name the clicked range once; its move objects and downstream array are retained, not rebuilt. See the [copy/reference audit](PreMovePlan%28ToDo%29.md#copy-and-reference-audit).

The wider flow audit applies the same trust rule to projection, turn execution and cancellation. Move impossible-queue drawing/fallback assertions to actual changed-board revalidation scenarios. Drawing performs no candidate/owner checks; the Local helper performs only due legality. Assert one feasibility pass after each actual commit rather than another inside turn request. Existing after-await cancellation/context checks, real expiry and external engine validation retain their actual owners. See the [14-flow contract audit](PreMovePlan%28ToDo%29.md#contract-audit-for-all-14-flows).

The older 24-case data/serialization/position run and 139-case scenario baseline applied to the superseded declaration. They remain historical records. The later implementation was reverted at the user's request; its passing evidence does not verify this design. Executed rollback verification and retained scenario specifications are recorded in the parent plan.

The migrated declaration uses `IMoveRaw[]`, and all five data-boundary tests pass. The earlier [raw scenario baseline](PreMovePlan%28ToDo%29.md#raw-move-scenario-baseline---23-october-2026) records 409 tests before the rejected implementation. The [rollback verification](PreMovePlan%28ToDo%29.md#rollback-and-revised-plan-verification---23-october-2026) now records retained scenarios separately: 250 tests, 131 pass/119 fail, with no skips or unhandled errors, plus passing existing regressions/static checks. The user's clarification refers to raw **moves**, not changing Vue `markRaw`.
