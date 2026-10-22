# Premove data structure

Replanned on 22 October 2026. **Proposed design, awaiting approval.** This revision updates documentation only, following the user's instruction to undo the premove implementation and reuse `IMoveRaw`. The current declaration/tests still describe the superseded entry contract until an approved migration. No new implementation or passing raw-queue test run is claimed.

The [parent plan](PreMovePlan%28ToDo%29.md) retains [14 function flows](PreMovePlan%28ToDo%29.md#function-flow), [25 scenarios](PreMovePlan%28ToDo%29.md#concrete-scenarios-for-unit-tests) and the [tests-first specification](PreMovePlan%28ToDo%29.md#data-driven-unit-test-specification). The separately completed analysis prerequisite stays unchanged.

## Required pending submission refactor

Reusing the type in the FIFO depends on the still-pending [board-interaction refactor](CodexFollowUp.md#still-pending), now explicitly planned as [PRE-RAW](PreMovePlan%28ToDo%29.md#pre-raw---pending-move-submission-refactor). The existing type does not mean the submission chain has already been refactored: Chessboard currently converts a raw selection into `IMove`, while GameView and the store still transport detailed moves.

The separate [raw submission API design](RawMoveSubmissionDesign.md) specifies the callable/event signatures, canonical conversion boundary, ownership, completion/error behaviour and tests. It governs the input refactor; this document governs the later plain queue structure.

Write PRE-RAW's selection/promotion/submission assertions first, then complete the existing legal-move path before queue behaviour. Target flow is `legal IMoveRaw -> completed raw promotion -> board event -> raw view/confirmation/playback -> raw store acceptance -> canonical legal resolution/toDetailedMove -> accepted IMove commit/history`. Full types remain for the [audited clock/history/SAN and engine-result consumers](RawMoveSubmissionDesign.md#type-retention-audit-and-justification). Application requires existing `IMoveCandidate`; PV/modal submission and ponder commands use raw input. Saved game schemas and engine behaviour remain unchanged. Temporary detailed PV-preview steps are local look-ahead data, not queued or submitted authority.

Only after this prerequisite passes should the raw FIFO declaration and premove scenario tests migrate. The future off-turn branch intercepts raw input before canonical enrichment; its due turn generates actual details later. No queue type alias or partial board-only event change completes the pending refactor.

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
| `player` | Exact actual human seat object in this game, not an equal-looking clone. Its colour supplies source ownership. Eligibility still requires human versus engine |
| `moves` | FIFO of existing `IMoveRaw` values. Index zero is for the next actual local turn; later entries depend on earlier intentions in order |
| `from/to` | Absolute board IDs, independent of orientation. A later source may be an earlier destination |
| `promotionPiece` | Explicit chosen promotion when required. Validate queen/rook/bishop/knight through chess rules; `IMoveRaw` itself deliberately remains generic |
| `$` and detailed fields on incoming objects | Not copied into accepted entries. Existing detailed `IMove` callers are compatible with `IMoveRaw`, but their metadata is not queue authority |

At intake copy only `{ from, to, promotionPiece? }`, omitting an absent promotion. Do not retain the caller's object or mutate frozen raw inputs. Coordinates must be integer board IDs. Invalid promotion kinds, missing required choices, friendly targets, opponent/empty sources and impossible source geometry reject through existing rule candidates.

## No stored expected kind or anchor

Source kind/colour comes from the board at each projected step; actual execution reads the actual board again. A chosen promotion changes the copied piece, so a later raw move naturally uses that promoted kind. Do not add `movingPiece`, source identity, sidecar expected-kind data, entry IDs, signatures or duplicate snapshots to replace the removed type.

Queue ownership supplies the required local colour. The existing live selector supplies the base after every real move, including Black queuing before its first actual move. No `anchorNode`, last-own-move node/path, copied FEN or last-validated node is stored. Takeback, confirmed rewrite, changed seat/root and terminal actions explicitly invalidate the queue before replacing ownership. Equal coordinates or returning to an old position never revive it.

The queue does not contain `IMove` metadata, future turn promises, callbacks, abort controllers, speculative history nodes, copied boards or red-square arrays. An actual turn's asynchronous owner remains separate; queued entries are plain data.

## Separate current actual-turn owner

When the approved behaviour integration replaces the existing pending/deferred slots, keep one optional `playerTurn` on game runtime. This is current actual work, not an anchor or future-turn record stored with each raw entry. Its minimum responsibilities are:

| Current-turn data | Purpose |
| --- | --- |
| `player`, `node`, `position` | Capture the actual seated player, actual parent and canonical searched-position reference before readiness. They never refer to a selected analysis board or speculative projection |
| `controller` | Close acceptance synchronously and abort owned readiness/provider/retry work before replacement |
| `completion` | Settle this actual commit/cancellation once; immediate move callers can observe their own commit. No promise exists per queued entry |
| `provider` | Owned engine startup/result-delivery task; acknowledge accepted delivery before commit, then settle finite ponder-start commands before client reuse |
| `move?` | One fully resolved actual `IMove`, retained if a genuine pause prevents commit. A held engine reply is independent of the editable raw FIFO |
| `premove?: IMoveRaw` | Reference to a claimed current FIFO head, if any. Cancellation can release that uncommitted head without cancelling an independent engine reply. Remove the queue entry only after successful commit |
| `retryTimer?` | Existing failure-retry timeout with an explicit owner; cancel on transition/disposal and never revive an old seat/game |

Retire this owner before a successor starts. Cancellation closes input, clears the FIFO/claimed head, aborts and settles provider work, and stops actual-player engine resources at one existing lifecycle boundary. Consolidate existing duplicate stop responsibilities rather than stopping the same client from competing owners. Analysis engine seats retain their independent lifecycle. Do not add a generation/token counter, queue-entry controller, second scheduler or exported turn-dispatch API.

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
| Eligible off-turn move | Copy raw fields, trial-project the whole FIFO plus candidate, then append and publish runtime only. Reject a bad new candidate without damaging a valid queue |
| Actual opponent move | Commit it once; reproject the whole accepted FIFO from the new actual board. No head is consumed for the opponent |
| Actual local turn | Validate the entire queue, find a fully legal candidate matching the head's exact raw/promotion fields, build fresh details and commit through the current actual-turn owner |
| Successful local head | Remove exactly that head after successful actual commit; project/revalidate the remainder. Normalise empty to no queue |
| Invalid accepted dependency/head | Clear every remaining entry immediately, including a currently legal head if a later dependency is already unprojectable. No skipped prefix/tail or partial history |
| User cancellation | Board right-click anywhere, touch tap on a premoved piece, or owned Escape clears all remaining entries. No Undo-last API, premove buttons, count or list. Preserve actual played history |
| Analyse/history/temporary navigation | Retain the queue; actual commits consume/rebase it in the background. Selected analysis/review stays canonical and unshaded. Return projects only the current remainder |
| Real Manual/Menu pause | Retain queue and accepted actual output, execute nothing. Final real Resume continues once; paused analysis entry/moves/history remain permitted |
| Actual Takeback/rewrite, changed seat/root, terminal result, explicit tab close/disposal | Clear at that existing action boundary; close/drain actual resources where applicable. Cancelled/no-op/blocked actions preserve a valid queue. Another game's data is untouched |
| Save/export and hydration | Existing schema omits runtime `$`; save preserves the in-memory FIFO. A loaded/imported/hydrated game starts empty and retains any genuine saved pause |

All queue edits preserve canonical serialized bytes, move history/count, clock/increment, recorded analysis and `metadata.updatedAt`. Use the existing raw-game publication boundary for redrawing only. One actual move produces the established canonical effects exactly once. Analysis Exit neither resumes clocks nor replays old entries.

## Planned test migration and evidence

1. Complete PRE-RAW with its own failing-then-passing tests for legal selection, promotion, view submission/confirmation/playback and canonical enrichment; preserve detailed service/engine/history boundaries. Then write the raw queue data-boundary assertions and migrate the declaration/imports to make that small contract green. Update fixtures/helpers to bare coordinates and promotion choices; no expected-kind argument.
2. Revise data-driven state/rule/mounted tests before gameplay development. Replace obsolete expected-kind tests with real-source geometry/colour/promotion cases, and button/Undo tests with whole-queue board cancellation. No raw-to-detailed casts or test-side queue engine.
3. Record a fresh compiling failing baseline for all PRE-S01-PRE-S25. Missing symbols/types alone are not behavioural evidence. Then implement through the existing owners and verify unit, browser and build/audit boundaries.
4. Preserve assertions for exact seat ownership, cloned-seat rejection, frozen/copied inputs, dropped `$`/detailed fields, promotion dependencies, Black before its first move, full-queue invalidation, canonical serialization equality and cross-game hydration isolation.

The older 24-case data/serialization/position run and 139-case scenario baseline applied to the superseded declaration. They remain historical records, not passing/failing evidence for this revision. No tests or application files are changed by this planning update.
