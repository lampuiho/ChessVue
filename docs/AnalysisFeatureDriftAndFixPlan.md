# Analysis Feature Drift And Fix Plan

## Status and scope

Documented on 6 September 2026 against commit `c2ed6a7`. Status: reviewed, implementation pending. This is a proposed implementation plan, not a claim that the changes below already exist. No runtime code was changed during this review.

This expands [FRONTEND-DRIFT-03](FrontendDesignDriftFollowUp.md#frontend-drift-03--analysis-panel-can-show-snapshots-for-another-position) beyond the panel binding. It also coordinates FRONTEND-DRIFT-04 (suggestion selection) and FRONTEND-DRIFT-09 (paused controls). Cover the whole analysis path: game transitions, engine search ownership, streamed results, saved results, public reads and commands, engine management, panel rendering, and regression coverage.

Analysis configuration, engine runtime, and game-owned results already have distinct contracts. The fix must respect those owners. Do not introduce a frontend-owned engine/result store or make the view associate raw stored results with engines.

The application has never been finished. Save compatibility is not a requirement: change the analysis contracts, persisted schema, serializers, and fixtures together. Do not add migration code, legacy readers, or transitional schema support.

## Existing specification and the expectation gap

The high-level [SCN-ANALYSIS-01](HighLevel/scenarios.md) says that a changed board position stops or supersedes the old search and starts streaming results for the new position. SCN-ANALYSIS-02 requires independently updating engines; SCN-ANALYSIS-03 retains cached results after interruption; SCN-ANALYSIS-04 defines suggestion selection; SCN-ANALYSIS-05 defines engine management.

The lower-level [analysis contract](LowLevel/Architecture/DataInterface/Analysis.md) explicitly describes each stored snapshot as the latest known result for an engine, includes `positionKey`, and defines `IVisibleAnalysisSnapshot` as a readonly view over matching stored snapshots. [GamesStore](LowLevel/Architecture/StateManagement/GamesStore.md) and [AnalysisPanel](LowLevel/Architecture/Presentation/Components/AnalysisPanel.md) specify `getVisibleAnalysis(...)` as the presentation access path. The [persistence contract](HighLevel/persistence_contract.md) restores saved snapshots before optionally restarting engines.

Consequently, the current written contract does not promise that every stored result always belongs to the rendered position. It promises that exposed visible results do. There is no per-position history cache in `IGame.analysis`: it holds one latest snapshot per assigned engine.

The expected simpler lifecycle is: changing the rendered position invalidates all previous results immediately, then fresh searches populate results for that position. Adopt that as the proposed stronger in-memory invariant below. Record this as a deliberate contract clarification; do not pretend that removing filtering alone implements it.

## Findings

The findings below are based on code and document inspection. Asynchronous failure cases are identified risks to reproduce with controlled tests, not claims of a completed runtime reproduction.

| ID | Finding and evidence | Consequence / classification |
| --- | --- | --- |
| ANALYSIS-DRIFT-01 | [GameView](../src/views/GameView.vue) passes `game.analysis.snapshots` directly to the panel. Engine selection/count paths also traverse that storage. `ReadonlyGame` exposes the complete analysis graph, and `IAssignedEngine.$` exposes `analysisLines`. | Confirmed bypass of the intended result accessor. Readonly typing prevents mutation but does not restrict access. Related: FRONTEND-DRIFT-03. |
| ANALYSIS-DRIFT-02 | [GameMoveComposable.navigateToNode / exitInGameAnalysis](../src/state/game/GameMoveComposable.ts) change the rendered selection without clearing or restarting analysis. The view's navigation handler adds no refresh. Committed move and takeback paths do refresh. | Confirmed incomplete position-change lifecycle relative to SCN-ANALYSIS-01. Filtering alone leaves the newly selected position without a fresh search. |
| ANALYSIS-DRIFT-03 | [refreshAnalysisForGame](../src/state/game/GameAnalysisComposable.ts) awaits each engine before starting the next. `startAnalysisSnapshot` clears only its own snapshot. | Confirmed non-atomic invalidation and sequential startup. A stalled first engine can delay all later engines; snapshots can temporarily describe different positions. |
| ANALYSIS-DRIFT-04 | The game callback accepts updates by engine object alone and writes the incoming key and lines. [EngineRuntimeService](../src/domain/EngineRuntimeService.ts) dispatches through the current mutable `runtimeState.analysisCallback`; the replacement subscription is installed before awaited startup. Overlapping refresh, retry, stop, or removal has no analysis-operation ownership guard. | Confirmed missing guard; late output/completions overwriting a newer result or state are race risks. A closure token alone is insufficient if an old search is routed into a new subscription. |
| ANALYSIS-DRIFT-05 | [NwjsUciEngineClient.startAnalysis / _requireRenderedPosition / _buildAnalysisUpdate](../src/platform/nwjs/NwjsUciEngineClient.ts) retain the mutable rendered-position object and derive update keys from it. Game position caches may be mutated in place by later moves. Startup also awaits protocol operations before building commands from the game. | Confirmed shared reference; parsing old output against a changed board, or labelling it with the new board's key, is a race risk. Filtering cannot protect against a mislabelled result. |
| ANALYSIS-DRIFT-06 | Canonical games are raw and observers depend on `workspaceRevision`. Some navigation branches change selection/state without calling `touchGame`. Refresh, retry, and stop mutate result/status without publishing a revision themselves; streamed updates do publish. | Confirmed incomplete publication paths. Empty, stopped, starting, or failed states can remain invisible until an unrelated update arrives. |
| ANALYSIS-DRIFT-07 | `stopAnalysis` clears results, and [GamesStore tests](../src/state/__tests__/GamesStore.spec.ts) expect cleared best moves. SCN-ANALYSIS-03 says cached evaluations remain visible, while [AnalysisAndSetup](LowLevel/ProcessFlows/AnalysisAndSetup.md) explicitly routes Stop through reset. | Specification conflict as well as differing implementation behaviour. Resolve Stop versus position invalidation explicitly. |
| ANALYSIS-DRIFT-08 | [AnalysisPanel](../src/components/AnalysisPanel.vue) uses one `disabled` flag for move selection and runtime controls; `GameView` sets it while paused. Events use the loop index. Filtering that list would change action and fold indexes. | Confirmed paused-control drift; an index-targeting regression would be introduced by the naive filter fix. Related: FRONTEND-DRIFT-09. |
| ANALYSIS-DRIFT-09 | Each PV is a single button; `GameView.playAnalysisLine` submits every move. The suggestion event carries moves without identifying the result that supplied them. | Confirmed selection drift and a stale-selection race risk. Live play needs one eligible first move; analysis needs the prefix ending at the selected move. Related: FRONTEND-DRIFT-04. |
| ANALYSIS-DRIFT-10 | [ModalHost.confirmAnalysisEngine](../src/components/ModalHost.vue) refreshes every engine after adding one. [startGameFromSetup](../src/state/game/GameWorkspaceComposable.ts) replaces snapshot assignments without disposing the old analysis engines. Removal resolves an index before an await and later splices that index. | Confirmed unnecessary restarts and missing replacement teardown; overlapping removal can target the wrong row. The current store intentionally makes add assignment-only, so moving startup into add is an API behaviour change. |
| ANALYSIS-DRIFT-11 | [insertGame](../src/state/game/GameWorkspaceComposable.ts) restores snapshots and optionally refreshes them. No current-position normalisation precedes exposing the hydrated game. | Confirmed dependency on the visibility filter in the existing format. Replace that format with results belonging to the saved rendered context; validate and restore the new contract before publication, including when automatic resume is disabled. |
| ANALYSIS-DRIFT-12 | The client records unexpected exit in its private session, while availability is generally updated by awaited service operations. The service design also mentions polling helpers absent from its current public implementation. | Confirmed documentation mismatch and an idle-search status propagation gap to cover: a crash after startup may leave the panel showing Running until another operation. No automatic retry is specified. |

Existing engine tests cover legality rejection, malformed output, session transitions, and root edits. Store tests cover basic analysis actions and explicitly encode some existing reset semantics. [GameView tests](../src/views/__tests__/GameView.spec.ts) cover menu interruptions. These checks do not establish the full lifecycle invariant or cover the panel races listed here.

## Proposed behavioural contract

### Ownership and current-position results

1. `GamesStore` remains the public game facade. `GameAnalysisComposable` owns analysis transitions and accepted game results. `EngineRuntimeService` owns the common legality boundary and runtime reporting; the concrete client owns protocol state and parsing.
2. Before publishing a changed rendered position, invalidate all affected engine result slots synchronously. Preserve engine assignments and order. Start replacement runtime work only after this invalidation; no awaited process operation may delay clearing another engine's old score or PV.
3. An accepted result belongs to the current rendered-position context and an active search for that engine. A stale callback, failed old startup, or completed old Stop cannot modify the current result or current status.
4. Results are empty while the new position is waiting for engines. A failed or unavailable engine still has an assigned row. Do not call that state "No engine assigned" or fabricate a completed result.
5. Frontend code obtains analysis through store projections. It does not read `game.analysis.snapshots`, `assignedEngine.$.analysisLines`, or perform position filtering. Existing result objects may be observed readonly through the approved API; do not clone PV graphs on every render.
6. Remove per-result persisted `positionKey` and stored-result position filtering as part of this implementation. Persisted analysis belongs to the rendered position saved in the same game document; the owner must uphold that invariant before saving. Use runtime search ownership to reject superseded output. Retain an internal structural identity only where an actual runtime operation needs it, not to support old saves or frontend filtering.

### Search lifetime and position capture

Use a game-owned rendered-position generation and an engine-owned operation identity, or equivalent explicit ownership objects. Keep them runtime-only. The position generation changes before old output can be accepted after navigation; an engine operation changes for refresh/retry/stop/removal even if the board is identical. An A -> B -> A sequence must not revive the original A search merely because the structural key matches again.

Serialise protocol-affecting operations for each assigned engine and coalesce superseded desired searches to the newest context. Run different engines independently. Do not add a generic scheduler or queue every obsolete position. Check ownership after every awaited readiness, stop, and start boundary, including error and completion handlers.

Bind the runtime's output forwarding to the search that created it. Do not let an old client callback discover a new subscriber through a mutable callback slot. Either capture and validate the subscription/search identity at start, or carry the protocol-neutral identity through the runtime boundary; specify the chosen signature changes alongside their tests.

At the actual client search transition, capture a detached position for parsing and validation and ensure the sent position command describes that same position. The detached board is justified because it represents an external search's fixed input; canonical game caches remain mutable. Preserve the purpose-level game command API where possible and the existing stop/terminating-bestmove protocol ordering. Do not expose UCI commands or session state to the frontend.

### Lifecycle matrix

| Trigger | Results and publication | Runtime work |
| --- | --- | --- |
| Committed move, history selection, takeback, history rewrite, return to live, or analysis exit changes the rendered position | Invalidate all result slots before publishing that selection. | Supersede and request analysis for the new context if allowed. |
| A live move advances an unrendered live branch while history remains selected | Keep results for the unchanged rendered position. | Do not restart solely because the live position changed. |
| Select the same rendered node / fold a row / switch between existing game tabs | Keep that game's current results. | No unnecessary restart; analysis ownership is per game, not per view mount. |
| Explicit Refresh | Invalidate the selected/all result slots and publish Starting or waiting state. | Replace the requested searches; other engines run independently. |
| Retry one engine | Invalidate that engine's slot and publish its new state. | Restart only that engine; supersede its prior operation. |
| Explicit Stop | Preserve the last accepted result for this position and publish stopped/ready status. | Invalidate operation ownership immediately, stop the search, and reject late output. A later position change may start a fresh search. |
| Engine crash | Preserve the last accepted result for this position; publish failure and retry information. | No automatic retry/backoff. Other engines continue. |
| Pause / resume without a position change | Keep results; move selection remains blocked while paused. | Background results and refresh/retry/stop/roster operations remain allowed. |
| Enter board edit | Supersede searches immediately. Existing results may remain only while the board is unchanged. | Stop analysis; prohibit search startup while editing. |
| Effective board edit | Clear results synchronously and publish the edited position. No-op edits do not invalidate. | Remain suspended. On exit, start each assigned engine once for the final board. |
| Add an engine | Publish the new empty assignment without clearing other engines. | Start only the new engine when allowed; retain the assignment on failure; defer during board edit. |
| Remove or replace assignments | Invalidate removed assignments' operations before publishing the new roster. | Dispose their subscriptions and engines; delayed cleanup must not affect replacement assignments. |
| Restore/import | Validate the new game document contract and restore its results as analysis of its saved rendered position before publication. No legacy snapshot matching or migration. | Respect `resumeLiveAnalysisAfterRestore`; saved current-position results can display with engines unavailable. |
| Actual game disposal / application shutdown | Invalidate all owned searches; coordinate any required save before releasing data. | Dispose subscriptions and stop owned analysis engines. Tab hiding alone is not assumed to mean game disposal. |

The Stop policy above deliberately resolves ANALYSIS-DRIFT-07 in favour of SCN-ANALYSIS-03: stopping a search is different from changing the analysed position. Update the contradictory flow and tests together. A stopped search is not necessarily a completed search; keep runtime state and result completion separate.

### Frontend API and selection

Extend the existing `getVisibleAnalysis(game)` projection so it can represent every assigned engine in authoritative roster order, including an empty current-position result. Expose its original action index, display metadata, runtime status/error, and only approved current-position result fields. Do not return the raw runtime object or use `ReadonlyAnalysisSnapshot['assignedEngine']` as a shortcut that exposes its line cache.

Use this same store-owned projection for counts and assigned-engine selection metadata. `GameView` forwards it to the panel; it does not join results to assignments. Keep `getVisibleAnalysis` as the result access path rather than introducing a second public analysis store. Narrow the frontend-facing game and engine types so that raw results/runtime caches are not available through ordinary reads; persistence and owner code retain their internal contracts. Inventory existing casts and call sites before changing those signatures.

Retain the current index-based store actions initially. The projection supplies the authoritative index; commands resolve the assignment object before any await and re-find that object before removal. Delayed UI commands must also be tied to the displayed assignment/context so an obsolete row cannot act on a replacement. Fold persistence remains index-based as specified: reconcile it against roster order, never the count of engines with results. An empty result must not hide an assigned engine or shift another engine's identity.

Separate move-selection permission from analysis-runtime and roster permissions. Paused states prohibit suggestions but permit runtime controls; board edit prohibits startup. Represent waiting, running, stopped, failed, and unavailable feedback without deriving runtime availability from `isComplete`. Cap visible PVs at three and retain score-only behaviour for the per-game live-analysis preference.

Render individual move targets. Live play permits only the eligible first move of a PV. Analysis contexts apply only the prefix ending at the selected move, through the existing game-state move dispatcher. Paused and board-edit states reject selection. Add a store-owned selection command (proposed name `selectAnalysisMove`) that validates a selection against the result/context originally displayed, then delegates accepted moves to the existing dispatcher. Do not accept an arbitrary unlabelled PV from a stale component. Validate the source once, then handle the accepted prefix as one user operation so the intermediate position invalidations do not reject its own continuation or launch unnecessary intermediate searches. Keep legality validation at its existing domain boundary.

## Implementation sequence

### 1. Reconcile contracts and add failing lifecycle tests

Update the analysis data contract, GamesStore contract, analysis/setup flows, runtime ownership documentation, and analysis panel/section contracts to state the stronger invariant and lifecycle matrix. Reconcile high-level Stop behaviour and the older tests. Document any new runtime notification or selection API explicitly rather than silently contradicting the existing service contract.

Start with deterministic tests for navigation invalidation, two-engine delayed startup, A -> B -> A, and Stop retention. Replace the old stored-key/filter contract together with the stronger lifecycle and new save schema. Do not maintain a compatibility stage or close FRONTEND-DRIFT-03 after changing only a template binding.

### 2. Make engine operations and output ownership correct

Implement per-engine serialisation, supersession, captured callback ownership, and detached search-position capture across `GameAnalysisComposable`, `EngineRuntimeService`, and `NwjsUciEngineClient`. Preserve existing UCI state-machine semantics and legality rejection. A rejected update must not poison the client's retained accepted lines. Suppress obsolete errors/status completions as well as obsolete successful results.

Add a protocol-neutral runtime status notification path for unexpected exit and final completion, integrated through the service and store revision publication. This is a documented extension to the current contract; avoid frontend polling or UCI-specific event handling. Dispose listeners with their assignment lifetime.

### 3. Centralise position invalidation and runtime scheduling

Introduce a narrow internal analysis transition operation used by rendered-position-changing workflows. Wire moves, navigation, takeback, history rewrite, root replacement, analysis entry/exit where the position changes, setup transitions, and board edit. Do not attach engine work to generic rendering getters or low-level cache setters.

Invalidate and publish synchronously, then schedule independent engine work. Make repeated invalidation/scheduling for the same transition idempotent. Avoid restarts for live moves that leave the rendered history position unchanged. Publish every accepted analysis result/status transition through the existing workspace revision mechanism, including startup failure with no engine output. Keep runtime-only publication separate from persisted modification timestamps where appropriate.

### 4. Complete assignment, persistence, and teardown paths

Make add-and-start coordination store-owned, update its documented assignment-only semantics, and remove the modal's refresh-all workaround. Make removal safe across awaits and dispose old assignments when `startGameFromSetup` replaces them. Preserve duplicate checks, the four-engine cap, copied per-game profiles, and isolation across games.

Change the analysis schema and serializers directly: remove the per-result position key and encode results as belonging to the game's saved rendered context. Save the game selection and its accepted current-position results consistently; a save during startup contains empty result slots rather than output from the prior position. Validate and hydrate the new document shape before publishing a restored/imported game. Do not serialise operation tokens, listeners, or runtime caches. Replace old fixtures with the new format; no old-format compatibility or migration is required.

Trace actual workspace disposal and shutdown separately from UI tab visibility. Ensure each released assignment is disposed once. The existing `closeTab` only changes UI session state; this review does not establish that closing a tab disposes the canonical game, so do not invent that policy as part of a leak fix.

### 5. Connect the frontend exclusively to the exposed APIs

Update `GameView`, `AnalysisPanel`, `ModalHost`, and affected selection props to consume the store projection and commands. Update the existing visible-analysis contract instead of building a frontend result association map. Ensure fresh projection containers or equivalent revision dependencies allow raw-object mutations to render without relying on unrelated clock ticks.

Implement independent control permissions, empty-result rows, stable engine actions/folding, and context-bound individual suggestion selection. Follow the existing presentation design by moving analysis markup through `AnalysisEngineSection` and the relevant common render components; coordinate shared primitives with FRONTEND-DRIFT-12 rather than expanding this work into a whole-application presentation rewrite.

### 6. Verify and reconcile the tracking documents

Run focused tests as each layer changes, then the full unit suite and production/type-check build. Update references and statuses in `FrontendDesignDriftFollowUp.md` only when the corresponding acceptance criteria pass. Remove obsolete tests and documentation claims that rely on clearing results on Stop, public runtime-cache reads, or presentation-owned refresh scheduling.

## Verification matrix

Use deferred readiness/stop/start completions and captured callbacks instead of sleeps. In view tests, use raw game objects and a reactive `workspaceRevision` to exercise production publication behaviour.

| Area | Required regression cases |
| --- | --- |
| Position transitions | Navigate without making a move; return to live; take back; rewrite history; enter/exit analysis; replace root; unchanged-position navigation; live engine move while browsing another node. Assert immediate invalidation and correct restart count. |
| Multiple engines | First engine hangs in readiness while second starts; one fails while others stream; all old scores disappear before any await; retry/add/stop one does not reset healthy peers. |
| Supersession | Rapid A -> B -> C and A -> B -> A; same-position refresh twice; late old info/bestmove; old startup failure after new success; Stop/Remove/board edit during pending start; no obsolete command after release. |
| Search input | Mutate canonical rendered position in place after starting analysis; verify old output is parsed against its captured board and cannot be accepted as output for the new position. Sent commands, parsed PVs, and reported position must agree. |
| Runtime integrity | Existing legal/illegal PV guards; malformed info retains valid lines; stop consumes terminating bestmove; unexpected exit after startup publishes failure; finite completion and no-legal-move output are represented without claiming an active search. |
| Stop and pause | Stop retains current-position results and prevents late replacement; changing position invalidates retained results; pause keeps controls available but blocks suggestion dispatch; resume without a position change does not restart unnecessarily. |
| Board edit | Entry during pending readiness prevents late startup; first and later edits clear results; no-op edit preserves them; added engines stay idle until exit; exit starts each engine once. |
| Roster ownership | Add starts only the added engine; duplicates/limit fail without partial assignment; overlapping removals target original objects; setup replacement releases old processes/subscriptions; independent games sharing a profile remain isolated. |
| Persistence | New-format round trips with populated/empty results, resume enabled/disabled, and engines unavailable; invalid new-format documents follow the existing validation error path; restoration renders before restart completes; save immediately after navigation or during startup cannot contain prior-position output; no persisted result keys or runtime ownership. |
| Frontend | Empty assigned row versus no assignments; correct original action indexes and fold state; restoring empty results still allows Refresh; tab changes; startup/stop/failure render without streamed output or a clock tick; raw line-cache access is absent from frontend contracts/call sites. |
| Suggestions | Live click commits one first move; analysis click commits exactly the selected prefix; paused/edit clicks dispatch nothing; late click after position/roster change is rejected; source line replacement cannot select a different PV by accident. |

Commands after implementation:

```text
npm run test:unit -- --run src/state/__tests__/GamesStore.spec.ts src/domain/__tests__/EngineRuntimeService.spec.ts src/platform/__tests__/NwjsUciEngineClient.spec.ts src/views/__tests__/GameView.spec.ts
npm run test:unit -- --run
npm run build
```

Include any new composable/component suites in focused runs. Perform a desktop smoke check with two engines: navigate during streaming, stop and retry independently, edit a board, restore with automatic resume disabled, and select a PV prefix. No runtime tests or desktop smoke checks were run for this documentation-only change.

## Completion criteria

- Every effective rendered-position change invalidates old results before publication and starts the correct permitted replacement work.
- Superseded output, command completion, and status cannot modify the current analysis, including when returning to the same structural position.
- Search parsing uses the board actually searched, independent of later canonical board mutation.
- Assigned engines remain manageable with empty results, startup failures, paused play, and saved results restored without a live engine.
- The frontend uses exposed analysis reads and commands only; it neither filters raw snapshots nor reads runtime line caches.
- The new save schema has no per-result position keys and no compatibility or migration layer for the unfinished application's earlier format.
- Stop retention, per-engine lifecycle, suggestion selection, persistence, and publication behaviour agree across contracts, implementation, and tests.
- FRONTEND-DRIFT-03, FRONTEND-DRIFT-04, and FRONTEND-DRIFT-09 have independently verified resolutions. Shared presentation work is tracked against FRONTEND-DRIFT-12 without claiming that broader issue resolved.
