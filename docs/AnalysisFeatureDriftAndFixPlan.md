# Analysis Feature Drift And Fix Plan

## Status and implementation boundary

Replanned on 29 September 2026 against commit `3eaad84`. Implementation pending. This revision replaces the 6 September plan; it describes proposed changes, not completed behaviour. Only documentation was changed during this review.

The objective is to repair analysis lifecycle and data ownership within the existing structure. Keep `GamesStore`, `GameAnalysisComposable`, `EngineRuntimeService`, `IEngineClient`, and the existing UCI state machine. Most of their contracts are suitable already. This is not an instruction to rewrite those layers or introduce another analysis architecture.

The implementation must follow these boundaries:

1. Preserve public method names and signatures unless a specific change is listed below. Mechanical seat renames and removing `positionKey` are intended changes.
2. Keep the concrete engine client as a protocol state machine. The **service owns cancellation of existing analysis promises and coordination of replacement requests**. The client retains its state-owned protocol completions and awaited stop handshake.
3. Keep two distinct line collections: unrestricted engine-reported runtime lines and at most three game-owned rendered lines. The subscription callback selects the best three; rendering reads that prepared collection.
4. Rename analysis snapshots to **analysis seats**. A seat is an assigned place for an engine to produce results, including while its lines are empty. Preserve the ordered list and embedded assigned-engine structure.
5. Remove analysis `positionKey` and position-based visible-result filtering. Clear rendered results when their position changes, and prevent superseded work from repopulating them.
6. Keep broader suggestion interaction and unsolicited runtime-status notification work separately identified. They must not turn this lifecycle repair into a public-API or presentation rewrite.

The application is unfinished and save compatibility is not required. Update schemas and fixtures together without migration or legacy readers. This does not authorise unrelated persistence changes.

## Current code and remaining problems

These findings come from source inspection. The asynchronous cases need deterministic regression tests; this review does not claim a runtime reproduction of every race. Finding IDs are retained for links from the frontend follow-up document.

| ID | Current code reference and behaviour | Required adjustment |
| --- | --- | --- |
| ANALYSIS-DRIFT-01 | [Analysis.ts](../src/contracts/Analysis.ts): `IAnalysisSnapshot` contains an assignment and results. [GameView](../src/views/GameView.vue) passes `game.analysis.snapshots` to the panel. | Name these objects seats. Their `lines` become the prepared rendered collection, so reading them is not reading the runtime cache. Preserve readonly observation. |
| ANALYSIS-DRIFT-02 | [GameMoveComposable](../src/state/game/GameMoveComposable.ts): `navigateToNode`, `returnToLiveNode`, `exitInGameAnalysis`, `commitLiveAnalysisMove`, and `commitStandaloneAnalysisMove` do not consistently refresh analysis. `_finaliseLiveMove` refreshes even if history stays selected. | Wire effective rendered-position changes to invalidation and restart; leave analysis alone when only an unrendered live position changes. |
| ANALYSIS-DRIFT-03 | [GameAnalysisComposable](../src/state/game/GameAnalysisComposable.ts): `refreshAnalysisForGame` awaits `startAnalysisSnapshot` in a loop, and each start clears only its own lines. | Clear all targeted seats synchronously, then start engines independently. |
| ANALYSIS-DRIFT-04 | [EngineRuntimeService](../src/domain/EngineRuntimeService.ts): `_acceptAnalysisUpdate` reads the mutable `runtimeState.analysisCallback`. `_runEngineOperation` writes availability after awaited work without ownership checks. | Bind forwarding and completion to one service-owned analysis operation. Cancel superseded promises and prevent stale status/error writes. |
| ANALYSIS-DRIFT-05 | [NwjsUciEngineClient](../src/platform/nwjs/NwjsUciEngineClient.ts): `startAnalysis` retains `_requireRenderedPosition(game)` directly and calls `buildAnalysisCommands(game)` after awaits. | Capture a detached parsing position and matching commands before client awaits. Preserve the client signature and state transitions. |
| ANALYSIS-DRIFT-06 | [GamesStore](../src/state/GamesStore.ts): games are raw and `touchGame` publishes through `workspaceRevision`. Navigation and analysis start/stop/failure paths do not all publish. | Publish changes even when no engine output arrives. |
| ANALYSIS-DRIFT-07 | `GameAnalysisComposable.stopAnalysis` resets results. [SCN-ANALYSIS-03](HighLevel/scenarios.md) retains evaluations after Stop, while [AnalysisAndSetup](LowLevel/ProcessFlows/AnalysisAndSetup.md) describes a reset. | Preserve rendered lines on Stop; clear on position invalidation or explicit refresh/retry. Update contradictory tests and docs. |
| ANALYSIS-DRIFT-08 | [AnalysisPanel](../src/components/AnalysisPanel.vue) uses one `disabled` flag for suggestions and runtime controls, and slices its input lines in the template. | Separate permissions; render prepared lines directly. Keep seat order and action indexes. |
| ANALYSIS-DRIFT-09 | `AnalysisPanel.moveSelected` emits an entire PV; `GameView.playAnalysisLine` submits every move. | Keep FRONTEND-DRIFT-04 as a distinct interaction change. A new selection API is not a prerequisite for this lifecycle repair. |
| ANALYSIS-DRIFT-10 | [ModalHost.confirmAnalysisEngine](../src/components/ModalHost.vue) refreshes all engines after add. Removal splices an index after cleanup. [GameWorkspaceComposable.startGameFromSetup](../src/state/game/GameWorkspaceComposable.ts) replaces assignments without releasing old engines. | Keep assignment-only add, start only the new seat, and clean up captured assignment objects. |
| ANALYSIS-DRIFT-11 | [SerializationService](../src/domain/SerializationService.ts) uses `gameSchema`; `insertGame` restores results and optionally refreshes. Current analysis schema permits old-position results and unlimited stored lines. | Persist seats with at most three current rendered lines and no analysis key. Restore before optional restart. |
| ANALYSIS-DRIFT-12 | Process exit fails the client-private session. The service exposes `isRuntimeAlive`, not a runtime event subscription. | Keep the status-reporting gap explicit; do not silently add an event bus or polling framework to solve cancellation. |

The client already has `IUciAnalysingSessionContext`, `IUciStoppingSearchSessionContext`, captured `onUpdate`, and `_stopSearch`. The [UCI rewrite plan](NwjsUciEngineClientRewritePlan.md) records that work and its verification. Do not execute that rewrite again. The remaining callback problem is the service's mutable forwarding target, not a lack of state-machine structure in the client.

## Retained contracts and bounded changes

| Surface | Decision |
| --- | --- |
| [IEngineClient](../src/contracts/platform/IEngineClient.ts) | Keep every signature, including `startAnalysis(engine, game, request, onUpdate): Promise<void>` and `stopAnalysis(engine): Promise<void>`. No public request IDs, cancellation signals, replacement session interface, or UCI types. |
| `EngineRuntimeService` | Keep public signatures. Move the current analysis readiness/start sequence inside `startAnalysis` so it owns the entire cancellable operation. This specific orchestration change is detailed below. |
| `subscribeToAnalysis(engine, onUpdate): () => void` | Keep the single subscription and disposer. Capture the subscriber for each operation; never forward old output to a later subscriber. |
| [IEngineAnalysisUpdate](../src/contracts/Engine.ts) | Remove `positionKey`. Keep `position`, `bestMove`, `lines`, and `isFinal`. Update lines contain all retained runtime lines in engine rank order, with no presentation cap. |
| `IAssignedEngineRuntime.analysisLines` | Keep `Map<number, IAnalysisLine>` and runtime-only ownership. Add only service operation bookkeeping needed for cancellation under `engine.$`. |
| `IEngineAnalysisRequest` | Keep `multiPv` and `searchMode`. The game can still request `{ multiPv: 3, searchMode: Infinite }`; that preference is not a cache limit. Accept higher reported ranks or requests for more lines. |
| `GamesStore` analysis actions | Keep `refreshAnalysis`, `retryAnalysis`, `stopAnalysis`, `addAnalysisEngine`, and `removeAnalysisEngine`, including index arguments. Add remains assignment-only. |
| `getVisibleAnalysis(game)` | Keep as a small readonly accessor over all seats. Remove key calculation and filtering. It does not choose lines, omit empty seats, or construct another result model. |
| Game/engine readonly types | Preserve the observation approach. Do not redesign `ReadonlyGame` or introduce application-wide restricted DTOs. Views consume seat lines, never the runtime line map. |

### Seat terminology and shape

Apply these mechanical renames across contracts, schemas, composables, fixtures, and component props:

| Existing | Proposed |
| --- | --- |
| `IAnalysisSnapshot` / `ReadonlyAnalysisSnapshot` | `IAnalysisSeat` / `ReadonlyAnalysisSeat` |
| `IGameAnalysis.snapshots` | `IGameAnalysis.seats` |
| `analysisSnapshotSchema` | `analysisSeatSchema` |
| `IVisibleAnalysisSnapshot` / `visibleAnalysisSnapshotSchema` | `IVisibleAnalysis` / `visibleAnalysisSchema` |
| `IVisibleAnalysisSnapshot.engineSnapshots` | `IVisibleAnalysis.engineSeats` |
| `createAnalysisSnapshot` / `resolveAnalysisSnapshot` | `createAnalysisSeat` / `resolveAnalysisSeat` |
| `resetAnalysisSnapshot` / `startAnalysisSnapshot` | `clearAnalysisSeatLines` / `startAnalysisSeat` |
| `AnalysisPanel.snapshots` prop | `AnalysisPanel.seats` prop |

Retain the existing seat fields apart from `positionKey`:

```ts
export interface IAnalysisSeat {
  assignedEngine: IAssignedEngine;
  updatedAt: AnalysisTimestamp;
  bestMove?: IMove;
  lines: readonly IAnalysisLine[]; // Prepared rendered lines: zero to three.
  isComplete: boolean;
}
export interface IGameAnalysis {
  seats: IAnalysisSeat[];
}
export type ReadonlyAnalysisSeat = DeepReadonly<IAnalysisSeat>;
export interface IVisibleAnalysis {
  readonly engineSeats: readonly ReadonlyAnalysisSeat[];
}
```

Keep `lines` as an array, not three mandatory placeholders. A waiting seat has zero lines; an engine reporting two valid lines displays two. The four-engine assignment cap is separate from the three-line presentation cap.

`createAnalysisSeat(engineProfile, updatedAt)` no longer takes a key. Keep one seat object per assignment across refreshes. Updates replace its results, not the seat or engine object. Stop does not imply natural completion; do not set `isComplete = true` merely to describe an idle engine.

This rename applies to analysis seats only. Clock snapshots, saved game/session snapshots, and copied player profiles have other meanings and remain outside this change.

## Runtime lines to rendered lines: complete call flow

The [analysis contract](LowLevel/Architecture/DataInterface/Analysis.md) already requires immutable emitted line/move objects. Preserve that property: the runtime map replaces entries, but does not mutate a previously emitted PV graph.

```text
NwjsUciEngineClient._consumeAnalysingLine(engine, session, context, text)
  -> _parseDetailedAnalysisLine(context.position, text)
  -> engine.$.analysisLines.set(line.$.reference, line)
     retain every reported rank; no cap or eviction at rank 3
  -> _buildAnalysisUpdate(context.position, runtimeLines, ...)
     existing numeric MultiPV ordering; include every retained line
  -> context.onUpdate(update)
     EngineRuntimeService checks operation/subscription ownership
     -> _isAnalysisUpdateLegal(update)
     -> capturedSubscriber(update)
        GameAnalysisComposable.subscribeToAnalysis callback
        -> resolveAnalysisSeat(game, engine)
        -> verify this subscription still belongs to that seat
        -> seat.lines = update.lines.slice(0, 3)
        -> update bestMove, updatedAt, isComplete
        -> touchGame(game)
  -> false from the service retains the client's existing rollback behaviour
```

“Best three” means the first three available lines in the engine's rank order. `_buildAnalysisUpdate` already sorts numeric map keys derived from MultiPV in [UciUtility.parseInfoLine](../src/utility/UciUtility.ts). Arrival order, depth, and a new score comparison are not ranking rules. Document this ordering on `IEngineAnalysisUpdate` for other clients. Out-of-order messages and missing intermediate ranks still select the first three available ranked lines.

Create a new array of up to three entries in the callback, sharing immutable lines. Do not clone PV graphs or sort the update array in place. Validate all incoming lines before selection; an illegal fourth line must not bypass the service guard because it is not displayed.

```text
GameView computed read, depending on workspaceRevision
  -> GamesStore.getVisibleAnalysis(game)
     -> { engineSeats: game.analysis.seats }, or undefined if no seats
  -> AnalysisPanel :seats="visibleAnalysis?.engineSeats ?? []"
     -> render seat.lines directly
```

There is no position or line-count filter in this read path. Counts, engine selection metadata, and fold indexes use the same authoritative seat order. Direct readonly observation of game-owned seats is also safe under this invariant; the boundary is between rendered data and runtime data, not two frontend result projections. Retain the accessor for panel wiring because it already exists.

Use a new outer array at the accessor/view boundary if needed to invalidate child props for raw seat mutations; do not clone seats or PVs. Verify publication through `workspaceRevision`, not unrelated clock ticks. Empty, stopped, and failed seats remain present.

## Service cancellation and client state-machine boundary

### Promise meaning and ownership

Client `startAnalysis` currently resolves after startup commands; streaming continues through its captured callback. Its promise does not represent an infinite search's lifetime. Preserve that meaning.

The service owns the pending readiness/start promise and the operation identity that remains valid during streaming. Replacement, Stop, restart, and engine disposal synchronously invalidate that identity and cancel any pending service promise. The client still owns protocol completions for `uciok`, `readyok`, and terminating `bestmove`.

Keep bookkeeping on `engine.$` to retain the attached-runtime structure. A small optional analysis-operation record can contain an abort controller, deferred startup completion, captured subscriber, and outstanding work/cleanup handle. Reuse [Deferred](../src/utility/async/Deferred.ts) and [Aborted](../src/contracts/errors/Aborted.ts) where useful. Do not add a global scheduler, new service class, persistent search IDs, or another game-level operation queue.

Cancellation rejects the pending service startup promise with `Aborted`. `startAnalysisSeat` consumes this expected cancellation without clearing a newer result, marking completion, or logging failure. Attach rejection handlers immediately and observe underlying client work until it settles: rejecting a wrapper promise does not stop a process or cancel protocol work.

Allow one client operation in flight per assigned engine and retain only the newest not-yet-started analysis request. Superseded queued requests settle without starting. Different engines have independent work handles. Compare assigned-engine and operation objects, not profile names or chess-position identity. A -> B -> A therefore cannot revive the original A operation.

### Start and replacement

Private helper names below are proposed, not current APIs. Implement them within the existing service.

```text
GameAnalysisComposable.startAnalysisSeat(game, seat)
  -> subscribeToAnalysis(game, seat.assignedEngine)
  -> EngineRuntimeService.startAnalysis(engine, game, request)
     -> _cancelAnalysisOperation(engine)                       [synchronous]
     -> install new operation; capture subscriber; mark Starting
     -> wait for prior client work to reach its boundary
     -> if superseded: finish without starting
     -> ensureReady(engine, operation.abortController.signal)
     -> if superseded: finish without starting
     -> IEngineClient.startAnalysis(engine, game, request, guardedOnUpdate)
        existing replacement flow:
        Analysing -> _stopSearch -> StoppingSearch -> bestmove -> Ready
        -> game-boundary readiness if required -> Analysing
     -> publish Running only if still current and not already final
     -> settle current startup promise
```

Move the composable's existing `await ensureReady` into this service-owned sequence. Keep `ensureReady` as the explicit process creation implementation and retain the base-runtime assertion established by subscription/initialisation. Do not make every service method silently create missing runtime. Document this bounded change to the service contract: analysis start now coordinates readiness, so its cancellation covers pending initialisation. Player-turn, ponder, option-discovery, and other flows remain unchanged.

Capture `analysisCallback` at operation creation. The callback passed to the client checks that its operation is current, not aborted, and its captured subscriber remains registered before validation/forwarding. `_acceptAnalysisUpdate` invokes the captured subscriber rather than discovering a replacement through the mutable callback slot. Keep the `false` rejection return and runtime-line rollback.

Check ownership after awaits and in catch/finally paths. Review `_runEngineOperation`, `_runInitialisedEngineOperation`, `_initialiseEngine`, and `_setRuntimeAvailability`: a composable guard is too late if an old service continuation already wrote `Ready`, `Running`, or `lastError`. Guard analysis-owned writes without changing unrelated player operations. A final update during command writing must prevent the later startup continuation changing Ready back to Running.

### Stop and disposal

```text
GamesStore.stopAnalysis(game, index?)
  -> GameAnalysisComposable.stopAnalysis(game, index?)
     -> capture target seats
     -> dispose subscriptions; call service Stop for every target
        EngineRuntimeService.stopAnalysis(engine)
        -> _cancelAnalysisOperation(engine)                   [before await]
        -> wait for issued client startup work to settle
        -> IEngineClient.stopAnalysis(engine)
           Ready: existing no-op
           Analysing: _stopSearch -> StoppingSearch -> bestmove -> Ready
     -> retain seat.lines, bestMove, updatedAt, isComplete
     -> publish current stop/error state through touchGame
```

Stop engines independently. If no session was started, service Stop is a successful no-op after cancellation; do not send a protocol command to an uninitialised client. Failure/stale-handle paths retain existing error handling.

If a start already entered the client and awaits readiness or command writing, cancellation immediately rejects its output and settles the cancelled service request. It cannot retract issued commands. Wait for the client boundary, then stop or replace that search without interleaving a newer client call. Superseded requests that have not entered the client never send search commands. This avoids requiring impossible immediate protocol cancellation from the unchanged client API.

`stopEngine` and `restartEngine` invalidate ownership first and coordinate with the same outstanding work. Disposal releases the actual handle created by pending initialisation, even after seat removal. Existing terminal session cleanup can reject state-owned waits; late continuations must not revive a stopped session. Do not invent timeout or automatic retry policy for a process that remains alive without responding. A blocked engine must not block its peers.

Keep `GameAnalysisComposable.analysisDisposers`. A subscription closure checks its own active registration and that `resolveAnalysisSeat` still returns its captured seat. This protects roster changes and stale callbacks without duplicating promise coordination in the store. An old startup catch/finally must not reset or publish over a replacement request. Cancellation belongs to the service; subscription membership belongs to the composable. No additional game-position generation is needed when every relevant transition disposes subscriptions and supersedes those service operations.

## Narrow client changes: capture fixed search input

At `NwjsUciEngineClient.startAnalysis` entry, after synchronous validation and before its first await, capture together:

- `cloneBoardPosition(_requireRenderedPosition(game))`, using [GameRuleUtility](../src/utility/chess/GameRuleUtility.ts);
- `buildAnalysisCommands(game)`, using the existing [UciUtility](../src/utility/UciUtility.ts) builder;
- game ID and root FEN for `_prepareGameBoundaryIfNewGame` / `_requiresNewGameBoundary`;
- the MultiPV option command for the supplied request.

Use locals or a small private input object. Store the detached board in `IUciAnalysingSessionContext.position`, use captured commands in `_writeSearchCommands`, and retain captured boundary values across readiness awaits. Adjust the private boundary helper as needed. Do not clone an entire `IGame`, expose a new search-document contract, or move UCI command construction into the service.

```text
client.startAnalysis(engine, game, request, onUpdate)
  -> capture board + commands + game boundary synchronously
  -> await old search stop when Analysing
  -> await captured game boundary when required
  -> clear engine.$.analysisLines for the new search
  -> write captured MultiPV option
  -> install Analysing { position: capturedBoard, onUpdate }
  -> _writeSearchCommands(engine, session, capturedCommands)
```

Remove `positionKey` from `_buildAnalysisUpdate` and its unused import. Preserve rank ordering, malformed-info handling, rejected-line rollback, natural completion, and `StoppingSearch` consumption of old `bestmove`. Small terminal-context checks needed to prevent async continuation reviving a disposed session belong in the existing machine; service intent and cancellation queues do not.

## Rendered-position transitions and publication

The invariant is: **every seat's rendered lines describe the game's current rendered position, or are empty**. Separating runtime and rendered lines removes the need for filtering only when cancellation and invalidation uphold that invariant. Removing the filter alone is insufficient.

Refactor `refreshAnalysisForGame` into synchronous preparation followed by concurrent per-seat work:

```text
refreshAnalysisForGame(game, engineIndex?)
  -> capture target seats in roster order
  -> for every target, before any await:
     dispose previous subscription
     clearAnalysisSeatLines(seat)                             [bestMove too]
  -> ensure the current rendered-position cache exists
  -> launch startAnalysisSeat(game, seat) for each target
     each service call supersedes its old operation before yielding
  -> touchGame(game)                                          [empty/starting]
  -> await target handlers, with failures isolated per seat
  -> publish accepted completion/error changes
```

Each handler consumes expected cancellation and checks ownership before further game mutation. Failure preserves an assigned seat and does not block another engine. `clearAnalysisSeatLines` clears `bestMove` and `lines` and sets `isComplete = false`; it changes rendered results only. The client clears runtime lines at its search transition.

Run preparation synchronously within the position-changing action, after establishing the new position and before publishing it or yielding. Reorder existing `touchGame` calls that precede refresh so observers/saves never see a new board with old lines. Do not put engine side effects in `getRenderedPosition`, `setRenderedPath`, or Vue watchers.

| Workflow | Existing functions to edit | Required decision/call |
| --- | --- | --- |
| History / return to live | `GameMoveComposable.navigateToNode`, `returnToLiveNode` | Compare paths before mutation. Refresh effective selection changes and publish all state branches. Avoid duplicate refresh when delegating to return-to-live. |
| Live moves | `commitLiveMove`, `_applyLiveMove`, `_finaliseLiveMove` | Use pre-move `isLivePositionRendered`. Refresh only if the rendered board advances. Object equality cannot detect in-place board changes. |
| Analysis moves | `advanceRenderedAnalysisBranch`, `commitLiveHistoryAnalysisMove`, `commitLiveAnalysisMove`, `commitStandaloneAnalysisMove` | Refresh once for the action's final rendered context, including the return-to-live branch. |
| Rewrite / takeback | `_commitHistoryRewriteMove`, `takeBack` | Invalidate before publishing changed selection. Awaited player cleanup must not expose stale lines after mutation. |
| Analysis entry / exit | `enterInGameAnalysis`, `exitInGameAnalysis`, `resumeFromInGameAnalysis` | Restart only when the rendered position changes. Include timeout branches; same-board pause/state changes preserve results. |
| Root replacement | `replaceWithAnalysisRoot` | Clear seat results before publishing the new root. Restart only when permitted. |
| Board edit | [GameBoardEditComposable](../src/state/game/GameBoardEditComposable.ts): `enterBoardEdit`, `applyEdit`, `applyBoardEdit`, `resetBoardToStartPosition` | Entry cancels pending/running analysis synchronously. Effective edits clear results; no-op edits preserve them. Block startup during editing; exit refreshes once. |
| Pause / resume / fold / tab change | Existing clock and UI actions | Preserve same-position analysis. Pause blocks move selection, not runtime controls. Tab hiding does not dispose games. |

Reuse `applyEdit`'s existing effective-edit result and root replacement path; no analysis position key is needed. Put the BoardEdit gate in the internal startup path as well as public refresh/retry actions. Entry cancels pending service operations before yielding, so requests still awaiting service readiness cannot enter the client afterwards. Already issued client work drains under the cancellation rules above and cannot publish results while editing.

## Assignment and persistence flows

### Add, remove, replace

Keep `addAnalysisEngine` assignment-only, including duplicate checks, copied profile/options, roster order, and the four-engine cap. Correct the modal's refresh-all workaround using the existing targeted action:

```text
ModalHost.confirmAnalysisEngine()
  -> call GamesStore.addAnalysisEngine(game, profile)
  -> capture the new seat synchronously, then await add completion
  -> unless BoardEdit, find that captured seat's current index
  -> GamesStore.retryAnalysis(game, index)                     [only this seat]
```

The current assignment-only add performs its list mutation synchronously before returning its promise. Capture that new seat under the existing duplicate rule, then re-find the same object after awaiting. Do not assume the last index is still correct or target a later replacement with the same name. If the captured seat was removed, do nothing. Existing engines keep their lines/searches. During editing, the new seat waits for exit.

Removal captures the seat before awaiting, disposes its subscription, cancels its service operation, removes that exact seat, and publishes the roster. Await cleanup independently of roster mutation. If removal remains deferred, re-find the captured seat before splicing; never use the old numeric index after an await. Reconcile `analysisEngineExpandedByIndex` when removing seats without introducing persisted engine IDs.

`GameWorkspaceComposable.startGameFromSetup` must invalidate/dispose captured old assignments before abandoning them, then install/start new seats. Old operations become invalid synchronously before publication. Cleanup acts on old objects, never replacements sharing a name. Keep actual game disposal separate from `closeTab`, which currently changes only UI session state.

### Save and restore

```text
SerializationService.serialiseGame(game)
  -> gameSchema -> gameAnalysisSchema -> analysisSeatSchema
     assignment metadata and zero to three rendered lines per seat
     no positionKey, runtime map, operation promises, or subscriptions
  -> existing move-tree / renderedPath validation -> JSON

SerializationService.deserialiseGame(raw)
  -> validate revised schema
  -> GameWorkspaceComposable.insertGame(game)
     -> hydrateAndInsertGame(game)
        -> GamePositionComposable.hydrateGame(game)
        -> publish saved seats/results for saved renderedPath
     -> optional refreshAnalysisForGame when resume is enabled and allowed
```

Use `z.array(analysisLineSchema).max(3)` for seat lines only. Do not cap runtime maps or update payloads. Keep the serialiser structure and schema-version policy; only the analysis shape changes. Allow empty seats and unavailable engines without runtime fields.

Saved lines belong to the root/rendered selection in the same document. A save during navigation/startup contains cleared rendered lines, never the previous runtime cache. Resume disabled preserves restored lines without a process. Resume enabled exposes the restored game first, then follows normal refresh policy. No matching old keys, position-indexed cache, or migration layer is required.

Remove analysis `positionKey` from `Analysis.ts`, `Engine.ts`, producers/consumers, creation paths, fixtures, and documentation. Retain structural utilities used by unrelated chess rules and the client's root-FEN boundary check.

## Presentation scope and explicit follow-ups

Core panel work: rename the seat prop, wire the accessor, remove template `.slice(0, 3)`, and render empty assigned seats. Keep availability/error metadata reads; never render `assignedEngine.$.analysisLines`. Distinguish no assignments from waiting seats. Missing runtime means unavailable/restored, not proof of active startup. Do not infer availability from `isComplete`.

Separate move-selection disabling from refresh/retry/stop permissions. Paused play permits runtime controls; BoardEdit blocks startup. Retain `showLiveAnalysisMoves` for score-only rendering. This addresses FRONTEND-DRIFT-09 independently.

FRONTEND-DRIFT-04 / ANALYSIS-DRIFT-09 remains a separate interaction task: individual move targets, one eligible first move in live play, and the prefix ending at the clicked move in analysis contexts. Trace `AnalysisPanel.moveSelected -> GameView.playAnalysisLine -> GamesStore.makeMove`, validate the displayed seat/line/context, and reuse existing move rules. That task must account for stale selections and intermediate refreshes during a prefix. Do not require `selectAnalysisMove`, a batch-move API, or component extraction to complete this lifecycle repair; do not claim the interaction issue resolved by it.

ANALYSIS-DRIFT-12 remains explicit: immediate failure publication after an otherwise idle process exits needs a documented notification or health-check integration. This repair retains lines on failure and publishes failures observed by service operations. Do not claim unsolicited exit reporting is fixed or implicitly introduce a public runtime-event contract. Natural `isFinal` updates already use subscriptions and should set current availability correctly.

## Implementation order and verification

1. **Characterise ownership.** Extend [EngineRuntimeService tests](../src/domain/__tests__/EngineRuntimeService.spec.ts) and [GamesStore tests](../src/state/__tests__/GamesStore.spec.ts) with deferred readiness/start/stop and captured callbacks before altering async flow.
2. **Fix service/client boundaries.** Implement service cancellation, guarded status/forwarding, and fixed client input in existing files. Move analysis readiness into the service, preserving the client interface and machine.
3. **Implement seats and line separation.** Rename types/fields/helpers, remove keys, select three lines in the callback, and remove accessor filtering. Update schemas, fixtures, and callers together. Ship key removal with lifecycle wiring so keyless results cannot still be filled by old output.
4. **Wire transitions and cleanup.** Invalidate synchronously, start independently, retain results on Stop, repair navigation/edit publication, target added engines, and release removed/replaced assignments.
5. **Connect presentation.** Update view/panel/modal references, revision dependencies, empty states, and paused permissions. Suggestion-prefix interaction and unsolicited exit reporting remain pending.
6. **Reconcile specs/tracking.** Update the [analysis contract](LowLevel/Architecture/DataInterface/Analysis.md), [engine contract](LowLevel/Architecture/DataInterface/Engine.md), [service contract](LowLevel/Architecture/DomainLogic/EngineRuntimeService.md), [runtime ownership flow](LowLevel/ProcessFlows/EngineRuntimeOwnership.md), [analysis/setup flow](LowLevel/ProcessFlows/AnalysisAndSetup.md), [GamesStore contract](LowLevel/Architecture/StateManagement/GamesStore.md), [panel contract](LowLevel/Architecture/Presentation/Components/AnalysisPanel.md), [persistence contract](HighLevel/persistence_contract.md), and [scenarios](HighLevel/scenarios.md). Update [FrontendDesignDriftFollowUp](FrontendDesignDriftFollowUp.md) to describe seats/invalidation, closing only independently verified issues.

Use controlled promises/callbacks rather than sleeps. Required assertions:

| Area | Regression cases |
| --- | --- |
| Cancellation | Replace during readiness, client start, and streaming; Stop/remove/edit at each stage. Cancelled promises settle, underlying late rejection is handled, and client operations do not interleave. |
| Ownership | A -> B -> C, A -> B -> A, Refresh twice, old info/final/failure after new requests, resubscribe before replacement. Old work changes neither current lines nor status. |
| Line separation | At least five valid MultiPV ranks arriving out of order: runtime map/update retain all five, seat selects best three. No display-based eviction. New search clears runtime lines; Stop retains rendered lines. |
| Validation/immutability | Existing illegal/malformed checks pass, including an illegal non-displayed line. Rejection rolls back runtime entries. New updates/map clearing do not mutate accepted seat PVs. |
| Input capture | Mutate canonical board/root/path while start awaits a barrier/write. Commands, parsing, and update board still describe the captured input; cancelled output is rejected. |
| Independence | Hold the first engine in readiness while the second starts/streams. Clear all targeted rendered lines before any await. Failure leaves healthy peers running. |
| Position transitions | Navigation, return-to-live, all analysis-move branches, takeback/rewrite, root replacement, analysis exit, unchanged-node selection, and unrendered live moves. Assert immediate invalidation and correct refresh counts. |
| Stop/edit | Stop retains lines without inventing completion; next position clears them. Effective edits clear, no-op edits preserve, pending starts cannot bypass editing, exit starts each seat once. |
| Assignments | Add stays assignment-only; modal starts only the added seat. Removal targets captured objects; setup replacement disposes old assignments. Same profiles in separate games remain independent. |
| Persistence | Empty/populated round trips; reject more than three saved rendered lines. Resume enabled/disabled, unavailable engines, save just after navigation. No runtime fields or analysis keys in JSON. |
| Publication/UI | Raw games plus reactive `workspaceRevision`: empty/starting/stopped/failed states render without clock ticks. Empty seats keep indexes/controls. Panel has no runtime-cache read, position filter, or line selection. |

Run existing focused suites, adding panel/composable coverage only where needed to exercise behaviour:

```text
npm run test:unit -- --run src/domain/__tests__/EngineRuntimeService.spec.ts src/platform/__tests__/NwjsUciEngineClient.spec.ts src/state/__tests__/GamesStore.spec.ts src/domain/__tests__/SerializationService.spec.ts src/views/__tests__/GameView.spec.ts
npm run test:unit -- --run
npm run build
```

The build includes type checking. Use portable Node at `E:\PortableApps\nodejs` in this workspace. After implementation, smoke-test two engines while navigating, stopping/retrying independently, editing, and restoring with automatic resume disabled. No runtime tests or desktop smoke checks were run for this documentation-only revision.

## Completion criteria

- Existing client/service/store signatures and module boundaries survive, apart from documented seat names and removed analysis keys. The client remains a state machine.
- The service cancels existing analysis promises and owns replacement ordering, including readiness. Superseded callbacks/errors/completions cannot modify current analysis.
- Runtime lines have no presentation cap. The subscription callback prepares at most three rendered lines in engine rank order; the panel adds no selection/filtering.
- Seats remain assigned across empty, starting, stopped, failed, and restored states. Their names describe engine assignments.
- Effective rendered-position changes clear old results before publication and restart only permitted searches; same-position state changes preserve results.
- No analysis `positionKey` or position-based visibility filter remains. Saves contain rendered results for the saved board context with no migration layer.
- Stop retention, independent engines, teardown, persistence, and revision publication pass focused tests and full checks.
- FRONTEND-DRIFT-03 and FRONTEND-DRIFT-09 close only after their checks pass. Suggestion-prefix interaction and unsolicited exit reporting stay tracked until separately implemented and verified.
