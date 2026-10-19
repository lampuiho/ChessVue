# Code cleanup follow-up and plan

Requested on 19 October 2026: remove generation-based async invalidation, restrict watcher use, and remove unnecessary implementation return annotations. These are coding requirements, not unresolved product questions. The source inventory below reviews the working tree based on `77acaa4`, including the IO changes and subsequent selected-details cleanup. Counts are source inspection, not test results or counts of confirmed defects.

## Current status

- The shared selected-details counter and its manual unmount increment have been removed from SavedGamesView. Its existing selected-entry watcher now invalidates pending delivery through watcher cleanup. Same-snapshot stale success/failure component regressions and all four JRN-IO-07 browser variants pass; see [verification](JourneyImplementation.md#storage-failure-verification).
- One named async invalidation counter remains: `playbackGeneration` in [GameView](../src/views/GameView.vue). It increments on playback start, game change and unmount, and gates moves and final UI updates.
- There are 12 watcher/effect calls: 11 in the application and one in the journey bootstrap. All are listed below. No watcher audit or removal is yet complete.
- A TypeScript syntax-tree inspection found 445 explicit `void`/`Promise<void>` return annotations on functions with bodies across `src`, `journeys` and `e2e`. They are review candidates, not 445 proven redundant annotations. The same scan found 120 bodyless callable signatures, which are contract/type declarations rather than this removal list. Root configuration files and other callable forms need a separate pass.
- [AGENTS.md](../AGENTS.md#async-work-and-watchers) now records the generation, watcher and return-inference rules. Automated enforcement remains planned.

## 1. Async work ownership

Do not replace a generation counter with an epoch, timestamp, random ID or another numeric version. First establish who starts the work, how overlapping starts are prevented, and how the previous work is cancelled and settled. A new object or promise comparison used only as a replacement version marker is also insufficient. Where external work cannot be cancelled, its owner must explicitly invalidate delivery and handle late success and failure.

| Source | Finding | Planned cleanup |
| --- | --- | --- |
| [GameView](../src/views/GameView.vue), `applyMoves` | Shared playback counter controls delayed PV moves; a timeout is still awaited after cancellation | Give one playback operation ownership of its cancellable delay and UI state. Stop it explicitly on replacement, game/position changes and unmount; settle it before starting another. Keep complete-prefix legality validation and prevent an old completion from clearing a new operation's UI state. |
| [GamePlayerTurnComposable](../src/state/game/GamePlayerTurnComposable.ts), `requestPlayerMove` and engine callback | A pending-promise identity guard coexists with the intended single-turn invariant and explicit abort/drain functions | Coordinate with the existing [turn-flow follow-up](ToDoList.md). Prove that cancellation/completion settles the old turn before a replacement is armed; then remove redundant guards. Preserve deferred moves, pause ownership and exactly one commit per eligible turn. |
| [GameAnalysisComposable](../src/state/game/GameAnalysisComposable.ts) and [EngineRuntimeService](../src/domain/EngineRuntimeService.ts) | Seat/subscription ownership, abort signals and serialised client work already exist | Review each guard against its real resource owner. Consolidate redundant checks without losing independent engines, unsubscribe/dispose behaviour, UCI stop draining or late-output rejection. |
| [SavedGamesView](../src/views/SavedGamesView.vue) and [ModalHost](../src/components/ModalHost.vue) | Watcher-local delivery invalidation and captured modal identity protect pending UI work | Move operation start/cancel/settle into selection and dialog activation/completion owners as watchers are removed. Keep the recently verified same-snapshot stale-success/failure protection. |
| [GamesStore](../src/state/GamesStore.ts), `workspaceRevision` | Publication counter for deliberately raw canonical games, consumed by computed projections and history | Audit separately as a rendering/invalidation mechanism. Record its readers and evaluate a smaller explicit publication boundary. Preserve current rendering until a tested replacement exists. |
| Platform registration/process handles and journey search/storage IDs | Identifiers name actual registrations, resources and diagnostic records | Keep identifiers with those concrete meanings. Review their lifecycle; distinguish them from counters whose only purpose is deciding whether a completion is obsolete. |

The follow-up must search for aliases as well as `*Generation`: revisions, epochs, tokens, version counters, request IDs, increments and post-await identity guards. Classify every match by purpose; schema versions, move counts, loop indexes and actual resource handles have different contracts. Re-run the inventory after each tranche so renaming cannot hide remaining work.

## 2. Watcher restrictions and inventory

The default is an explicit action or event at the point that owns a transition. Use computed values for pure derivation. Route updates belong to router lifecycle/commit hooks, and component activation/disposal belongs to lifecycle hooks. Do not replace a watcher with a deep watcher, `watchEffect`, an unrelated subscription, polling or a chain of computed side effects.

A retained boundary observer must document its reactive source, why the owner cannot invoke the effect directly, its outputs, ordering and disposal. It must not write back into its own dependency chain. Handle async rejection and invalidate pending delivery when ownership ends. The selected-entry cleanup fix meets the minimum safety behaviour for an existing watcher; it is not a general pattern for starting new data flows.

| Existing call | Owning source | Planned disposition |
| --- | --- | --- |
| `watchEffect` for theme/CSS/meta tags | [App](../src/App.vue) | Review as a possible output-only DOM bridge. Declare the actual appearance inputs and keep game/session mutation outside it; retain only with a recorded boundary justification. |
| `watch(route.path)` for session mutation and checkpoint | [App](../src/App.vue) | Replace with one router commit owner, including back/forward and startup restoration. Preserve error feedback and ensure each committed route is checkpointed once. |
| `watch(gameId)` for validation, playback reset and menu return | [GameView](../src/views/GameView.vue) | Use a shared activation action invoked by mount and route-update hooks. Cancel playback through its owner and validate once per activation. |
| `watch(autosaveError)` for a toast | [GameView](../src/views/GameView.vue) | Publish failure through the autosave action's explicit result/notification boundary, with one presentation consumer and disposal. |
| `watch(modalState.kind)` for menu resume | [GameView](../src/views/GameView.vue) | Add explicit dialog completion/cancellation notification to the interrupting-menu flow. Resume once after the owning operation settles, including Escape/backdrop cancellation. |
| `watch(selectedGroup)` for selection fallback | [SavedGamesView](../src/views/SavedGamesView.vue) | Resolve valid selection in the group activation and refresh actions, including deletion and a vanished last group. |
| `watch(selectedEntry)` for details I/O | [SavedGamesView](../src/views/SavedGamesView.vue) | Start details loading explicitly from initial/group/snapshot selection and refresh actions, with one cancellation/disposal owner. Preserve stale success and error isolation. |
| `watch(route.fullPath)` for form/overwrite reset | [SavedGamesView](../src/views/SavedGamesView.vue) | Invoke one route activation action from router lifecycle and initial mount. Clear a pending overwrite at the owning transition. |
| `watch(modal)` for form/error initialisation | [ModalHost](../src/components/ModalHost.vue) | Initialise transient state at explicit dialog activation, preferably within a dialog-scoped component. Test reopening the same kind with different payloads. |
| `watch(props.position)` for board selection reset | [Chessboard](../src/components/Chessboard.vue) | Review selection ownership across external engine moves, history and game changes. Prefer state tied to the actual board context or an explicit activation/reset boundary; retain a prop observer only with a concrete justification. |
| `watch(props.boardEdit)` for board selection reset | [Chessboard](../src/components/Chessboard.vue) | Reset in the board-mode transition/activation owner, covering promotion and drag state. Apply the same boundary review as position changes. |
| `watch` for `api.ready` | [StartJourney](../journeys/StartJourney.ts) | Review as a test-only readiness projection. Prefer a directly derived API value or explicit readiness lifecycle; retain an observer only if necessary, read-only with respect to application state, and disposed on unmount. |

Remove the old observer in the same change that introduces its explicit owner. Running both paths would create duplicate saves, resume calls, loads or notifications. Existing watcher use does not grant an exception for new watchers.

## 3. Return annotation cleanup

Prefer inference on implementation functions whose bodies establish `void` or `Promise<void>`. Review named functions, object/class methods, arrows and callbacks in Vue scripts, TypeScript, journey tooling, tests and configuration. Keep necessary callable contracts and explain a non-obvious retained implementation annotation.

| Inspected area | Functions with bodies to review | Bodyless signatures |
| --- | ---: | ---: |
| Application source, excluding tests | 285 | 86 |
| Application tests | 31 | 21 |
| Journey runtime/builders/definitions | 30 | 10 |
| Journey tests | 8 | 2 |
| End-to-end specs/helpers | 91 | 1 |
| Total | 445 | 120 |

Start with touched presentation functions such as `GameView.applyMoves`, `SavedGamesView.refreshGroups` and `App.saveSession`, then work through stores, domain/platform implementations and test/tooling helpers in separate changes. Inspect actual return statements and callers before removing an annotation, especially APIs inferred with `ReturnType` or callbacks whose return values are deliberately discarded.

Preserve interface/abstract/overload signatures, callable properties such as `() => void`, deliberate public API constraints and annotations needed for recursive or contextual inference. `new Promise<void>(...)`, `Deferred<void>`, a field of type `Promise<void>` and the `void somePromise` operator are not function return annotations. Do not use a textual search-and-replace over all occurrences of `void`.

## Delivery order and acceptance

| Item | Priority | Scope and completion condition | Status |
| --- | --- | --- | --- |
| CLEAN-01 | P0 | Record this inventory and durable coding rules; distinguish prior verification from planned work | Complete: documentation/source audit only |
| CLEAN-02 | P0 | Remove playback generation, audit revision/publication and turn/analysis ownership. No overlapping turn/playback work, unresolved old promises, late commits or stale UI completion | Planned |
| CLEAN-03 | P0 | Replace modal/menu and route/session orchestration watchers with explicit owners. Preserve pause/resume, startup, back/forward, load and checkpoint recovery | Planned |
| CLEAN-04 | P1 | Replace saved-selection/modal/board reset watchers; decide and document any narrowly retained appearance/readiness/prop observers | Planned |
| CLEAN-05 | P1 | Remove redundant implementation return annotations by layer; review every candidate and record why any remain necessary | Planned |
| CLEAN-06 | P1 | Reject unlisted watcher/effect calls, including aliased/namespace imports and equivalent Vue/Pinia observer forms. Baseline only named, justified transitional sites; remove entries as migrations finish. Report new counter/ownership-guard candidates for review and check annotation candidates separately from declarations; syntax checks do not prove lifecycle correctness | Planned |

Each implementation tranche updates the owning low-level flow/component documentation, this inventory and its focused regression evidence. Keep the annotation-only changes separate from async behaviour changes. The cleanup is complete when invalidation counters are gone, every observer has been removed or justified at a real boundary, and all candidate implementation annotations have been removed or explained. No gameplay or persistence-schema change is required by this plan.

## Verification by tranche

- Ownership/playback: retain full-prefix validation; rapid start/stop/restart, game/history navigation, unmount, late success/error and independent engine tests. Use [Analysis suggestions](../e2e/journeys/analysis/Suggestion.spec.ts), [application suggestion checks](../journeys/__tests__/analysis/Suggestion.spec.ts), [engine races](../e2e/journeys/engine-races/) and [turn/store tests](../src/state/__tests__/GamesStore.spec.ts).
- Route/modal/selection: cover startup and back/forward, one checkpoint per committed route, disabled/failed persistence, menu cancellation and same-kind dialog reopening. Keep [IO stale reads](../e2e/journeys/storage-failures/StaleRead.spec.ts), [SavedGamesView regressions](../src/views/__tests__/SavedGamesView.spec.ts), Settings, Saves, Recovery and clock/menu coverage.
- Board selection: verify promotion/drag cancellation, orientation, history, engine replies, board editing and route reuse with the existing component and journey suites.
- Return annotations: run `npm run type-check` across application/unit/end-to-end projects, inspect inferred contract changes and run the affected layer's tests. Use production build checking for boundary changes.
- Run mounted application tests separately from browser tests. Start relevant browser acceptance with one worker and no retries on this host, retaining the existing assertion deadlines and reporting teardown errors separately from clean acceptance.
- Validate the static audit itself with renamed/aliased observer calls and meaningful contract cases; do not present grep counts, discovery or the historical IO passes as execution of this cleanup.

Implementation has not started beyond the already verified selected-details correction. Progress and new run artifacts belong here as the planned items are delivered; this plan adds no journey completion claims.
