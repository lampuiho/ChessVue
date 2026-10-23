# Remove workspaceRevision and name timestamp updates explicitly

Requested on 23 October 2026. **Status: proposed; documentation only.** Application and test implementation await approval. The current baseline is **860/860 unit/application tests**, recorded in the [premove test cleanup](PreMovePlan%28ToDo%29.md#test-contract-cleanup---23-october-2026).

## Corrected decision

The previous draft preserved `markRaw(game)` and added per-game shallow-ref holders in a WeakMap. That was unnecessary parallel ownership and retained the manual notification design. Withdraw that proposal entirely: no holder map, registry, `triggerRef`, `publishGame` or replacement invalidation mechanism.

`GameWorkspaceComposable` already owns `const games = ref<IGame[]>([])`. Remove its `markRaw(game)` opt-out and use the reactive game objects in that existing collection consistently. Reads track the fields and arrays they actually use; writes update the data itself. Remove `workspaceRevision`, `_publishRuntime`, injected `publishRuntime`, `HistoryPanel.revision` and their consumers. Do not add a number, token, timestamp dependency, boolean toggle, dummy object replacement, event bus, watcher or polling loop to force rendering.

Rename `_touchGame(game)` to `_timestampGame(game)` and injected `touchGame` dependencies to `timestampGame`. Its entire effect is:

```ts
function _timestampGame(game: IGame) {
  game.metadata.updatedAt = new RecordTimestamp();
}
```

It performs no publication, refresh, save or turn work. Preserve the current timestamp-call policy, including existing analysis operations; queue-only edits still do not timestamp. There is no second notification call alongside it.

No move/queue clones, new queue type, game controller or persistence format. Keep the actual-turn Deferred/handler/controller, held output, engine delivery, retries, pondering, source/candidate validation and pruning policy. Existing autosave move counts remain actual move counts. Coordinate the [store dependency plan](StoreDependencyRestructuringPlan.md) and [component plan](ComponentSimplificationPlan.md) without implementing their unrelated restructuring.

## Canonical references and mutation ownership

Removing `markRaw` changes the read object from the original plain payload to Vue's canonical proxy. Do not claim strict proxy-to-payload equality survives. This is wrapping the existing data, not cloning it. The game returned by create/insert, `getGame`, `listGames`, callbacks and subsequent actions must be the **same canonical reactive game**. The underlying object must remain the supplied payload, verifiable with `toRaw` in boundary tests.

| Data | Required handling |
| --- | --- |
| Workspace game | Store once in the existing collection, return that collection's reactive object, and use it for all post-insertion work. Do not retain the original raw payload as a competing mutation path |
| Paths / tree nodes / selected caches | Let the reactive graph preserve shared-path and node aliases. Read and mutate through the canonical game, including cached nodes/positions. Audit service-returned new nodes and seeded caches for consistent references; do not add ID tables or raw/proxy comparison guards |
| Premove entries | Retain exact supplied stable `IMoveRaw` references. Initialise the queue's `moves` container with `shallowReactive<IMoveRaw[]>([])` at its existing creation site: pushes/shifts are reactive, entries are not deep-converted. Keep direct append and the existing queue contract; no sidecar data or entry reconstruction |
| Engine runtime | Keep the existing shallow-reactive runtime boundary for player engines. At `GameAnalysisComposable._startAnalysisSeat`, initialise/wrap the assigned engine runtime through `shallowReactive(EngineRuntimeService.ensureRuntime(engine))` before starting/subscribing. Existing readiness/streaming operations then mutate the same observable runtime. Do not import Vue into domain/protocol code |
| Promise / AbortController / Date / process ownership | Preserve these concrete owners and existing completion/cancellation semantics. Verify them at real engine/turn boundaries; do not create replacement wrappers or counters for asynchronous identity |
| Rule-derived display boards | Keep the existing necessary detached board projection; it is display data. Do not mutate it to notify the canonical model or make it a second game state |

Proxy identity is the material compatibility change in this plan. Keep logical ownership/aliases and raw move references; update the old assertion that `insertGame(payload) === payload` to check both canonical proxy reuse and unchanged backing payload. Do not remove meaningful identity tests merely to accept inconsistent aliases.

The concrete replacement for `expect(insertedGame).toBe(insertedPayload)` in `GamesStore.spec.ts` is:

```ts
const insertedGame = await store.insertGame(insertedPayload);
expect(isReactive(insertedGame)).toBe(true);
expect(toRaw(insertedGame)).toBe(insertedPayload);
expect(store.getGame(insertedGame.metadata.id)).toBe(insertedGame);
expect(store.listGames().find((game) => game.metadata.id === insertedGame.metadata.id)).toBe(insertedGame);
```

Use Vue's `isReactive` and `toRaw` in this boundary test. The first assertion requires a reactive return, the second rejects copying the payload, and the last two reject returning a different object from the one the store exposes. Keep the existing duplicate-ID repair assertions unchanged. `toRaw` is not a production identity workaround; subsequent store actions and callbacks use the returned reactive game.

Also test actual field tracking, without a notification helper:

```ts
const name = computed(() => store.getGame(insertedGame.metadata.id)?.metadata.name);
expect(name.value).toBe(insertedGame.metadata.name);
insertedGame.metadata.name = 'Renamed game';
expect(name.value).toBe('Renamed game');
expect(insertedPayload.metadata.name).toBe('Renamed game');
```

This fixture mutation proves that the computed observes the reactive field and the original payload remains its backing object. No counter, `triggerRef`, clock tick or `timestampGame` call is involved. This is planned test code; the current raw-game implementation is expected to fail it.

## Concrete function flows

### PUB-F01 - Create, insert and hydrate the canonical game

| Call | Work / result |
| --- | --- |
| `createGame` / `insertGame` -> `_hydrateAndInsertGame` | Keep duplicate-ID repair, fresh runtime hydration, restored Manual pause and player normalisation |
| `_hydrateAndInsertGame` -> `_replaceGame(game)` | Remove `markRaw`. Keep existing array push/splice, then return the actual stored `games.value[index]` object |
| `_hydrateAndInsertGame` -> existing clock registration -> return | Pass the stored reactive game to registrations and return it; do not return/use the pre-insertion raw alias |
| `createGame` / `insertGame` follow-up | Existing turn request and analysis startup receive the canonical returned game. Their closures retain that same object |
| `getGame(id)` / `listGames()` | Keep current lookup/collection reads and public types. Membership and game fields are naturally tracked; no holder lookup or new public read API |
| Store scope disposal | Keep existing turn/analysis/engine/focus cleanup. There is no notification registry to dispose |

### PUB-F02 - Mutate data and timestamp where already required

| Caller | Final calls / effect |
| --- | --- |
| Status resignation/draw/offer actions | Existing checks/awaited cleanup -> canonical result/offer/clock writes -> `timestampGame(game)` -> existing runtime registrations |
| Clock timeout, pause and resume | Existing clock/state/pause-owner writes -> `timestampGame(game)` at current timestamp boundaries. Preserve final held-output flush and successor request |
| Player reassignment | Existing cleanup -> accepted canonical seat/state writes -> `timestampGame(game)` -> existing registrations/request. Schema-equal no-op remains a no-op |
| Board-edit entry and workspace setup | Keep current order; replace each `touchGame(game)` with `timestampGame(game)`. Root/tree/seat mutations themselves drive reads |
| Analysis callback / assignment / Stop / Retry completion | Retain current subscription-owner checks. Write accepted seat/runtime data and call `timestampGame` wherever `touchGame` currently timestamps; rejected late callbacks do neither |
| `GameMoveComposable._publishRenderedPosition(game, changed)` | Remove the publication responsibility/name. Rename to `_refreshRenderedAnalysis(game, changed)`: changed selection keeps existing `analysis.refreshAnalysisForGame`; unchanged selection only preserves the current timestamp effect |

Audit every `touchGame` call and dependency, not only the move path. Add no compensating publisher, observer or extra analysis refresh after those calls are renamed.

### PUB-F03 - Queue edits and normal turn resolution

| Call | Work / result |
| --- | --- |
| `_appendPremove(game, player, rawMove)` | Existing queue initialisation uses a shallow-reactive move array; push the supplied raw reference. Delete `publishRuntime()`; no validation, projection or timestamp added |
| `clearPremoves(game)` | Keep absent-queue no-op; assigning `undefined` clears the observable queue. Delete `_publishRuntime()` |
| `_tryPremove(game)` | Keep actual legal matching, fresh details, one shift and immediate `attemptPlayerMove`. Remove the post-settlement publication-only branch; the actual commit/held slot is observable data |
| `_playerMoveHandler` / `flushDeferredPlayerMove` | Preserve the existing resolver and paused-output policy. Their canonical data writes drive rendering; no notification API |
| `_finaliseLiveMove` | Keep result/state update, whole-queue revalidation, required analysis refresh, clock registration and successor request in their existing order |

Reactive queue changes can still reach rendering before a shifted head commits in the handler microtask. Keep the existing pending-Local rendering boundary and regression. Do not reorder turn settlement to fix presentation.

### PUB-F04 - Board, analysis, tabs and history read data

| Consumer | Final dependency |
| --- | --- |
| `GameView.game` | Existing getter reads `getGame(gameId)`; remove `void workspaceRevision`. Derived reads use reactive game fields/paths directly |
| `renderedNode`, `livePosition`, `renderedBoard`, controls and captured totals | Keep current projections and canonical/display separation. Stable node/path references contain reactive data; those reads must not depend on a fabricated notification |
| `renderedBoard` input ownership | Reuse previous input owner for unchanged actual board/mode/permissions/queue. In-place reactive queue edits need an actual dependency such as `moves.length` as well as head/tail values; do not rely on a computed that only returns the unchanged queue object |
| `analysisSeats` / AnalysisPanel | Read reactive seat data and the existing necessary display projection. Engine status writes use the observable assigned runtime; no global counter or timestamp read to force updates |
| Tabs | Existing collection/name reads become reactive. No extra lookup registry or per-game notification routing |
| HistoryPanel | Remove `revision` and its dummy read. Existing `_walk` traverses reactive nodes/children and selection reads reactive paths. The separate component plan may adopt `gameId`; that refactor is not a prerequisite for removing this counter |
| Journey `ready` | Remove the counter read. Existing settings/session/route and `getGame` membership dependencies suffice |

Rule helpers sometimes temporarily mutate a board or populate notation/check caches. Verify their use against reactive state: computations must not become re-entrant or create effects. Existing detached display/preview boards stay detached; do not add another snapshot layer to avoid reviewing the actual read/write boundary.

### PUB-F05 - Fixtures and counter-dependent tests

| Current test | Replacement |
| --- | --- |
| `GameView.spec.ts` / `PremoveView.spec.ts` raw fixture + `_publish` counter bump | Use reactive game fixtures representing the store's canonical return. Change data through those objects; remove `_publish` and artificial clock ticks, without another test notification helper |
| `GamesStore.spec.ts` insert payload identity | Assert canonical create/insert/get/list references agree and `toRaw(insertedGame) === payload`; retain path/node/player alias tests |
| State premove publication checks | Assert queue/projection changes from reactive data and exact supplied move references, with unchanged timestamps/canonical game/search/clock for queue-only edits |
| UI follow-up direct revision bump | Perform the actual fixture/state mutation through the canonical reactive game |
| Concurrent timeout publication-count assertion | Assert final clock/result, one user notification, settled turn and no extra history/increment |
| Disposal unchanged-counter assertion | Assert ignored output leaves real derived analysis, processes and view unchanged |

Rename dependency spies to `timestampGame` and remove `publishRuntime` fixtures. No skipped/expected-failure tests or notification-count substitutes.

## Tests first and required scenarios

Record behavioural failures before implementation. Missing renamed dependencies alone are not a useful failing baseline.

| ID | Scenario / assertion |
| --- | --- |
| PUB-S01 | Real store create/insert/get/list share one canonical reactive game; backing data is not cloned, and post-insertion callbacks mutate through that object |
| PUB-S02 | Changing game A's fields updates A while an independent computed read of B retains its existing derived object; stores remain independent |
| PUB-S03 | Create/restore/duplicate-ID repair updates membership, tab names and journey readiness without manual publication |
| PUB-S04 | Click/drag/promotion, actual replies, clocks, pause/resume and results update without a clock tick or unrelated action |
| PUB-S05 | Premove push/shift/clear, every promotion, held local output and the publication-gap regression work; queue entries retain supplied identity and queue-only edits do not timestamp |
| PUB-S06 | Streamed analysis, completion, errors, Stop/Retry/assignment/removal update the UI; discarded late output changes neither seat nor timestamp |
| PUB-S07 | History updates after in-place children/path changes, rewrite, pruning, Takeback and root replacement; cache/node/path aliases remain correct |
| PUB-S08 | Unrelated evaluation leaves valid board selection/drag/promotion input intact; independent analysis survives background queue changes |
| PUB-S09 | `timestampGame` changes only `metadata.updatedAt`; no notification/refresh/turn effect, with current per-action timestamp policy preserved |
| PUB-S10 | Menu/tab navigation, inactive games, remount and setup retain correct ownership; obsolete input remains cancelled |
| PUB-S11 | Engine runtime/native async owners still work; concurrent timeout and disposal settle correctly; save excludes runtime and premoves |

Use real stores/rules and mounted components for reactive behaviour, not a mock publisher. Retain all PRE-S01-PRE-S25 cases and the current engine-service/turn contracts. Explicitly cover raw/proxy aliases and the shallow move-array/runtime boundaries before implementation.

## Implementation order and completion gate

1. Write the above tests against the current 860-test baseline and record meaningful failures.
2. Remove `markRaw(game)` and make workspace creation/insertion return and use the stored canonical reactive game before any post-insertion async startup. Keep schemas and backing data intact.
3. Preserve exact raw move references with the shallow-reactive queue array, and make assigned analysis runtimes observable before their operations start. Audit canonical cache/async aliases with the tests; no new notification infrastructure.
4. Remove the counter, `_publishRuntime` and injected publication callbacks. Rename timestamp functions/dependencies, and rename the analysis-refresh helper to its remaining purpose.
5. Remove dummy read/history props and fixture publication helpers. Keep existing component and turn responsibilities; unrelated restructuring remains separate.
6. Run the complete suite, TypeScript, code audit/build and affected real browser journeys: premoves, engine races, analysis, clocks/history, promotion, setup/tab changes and restore. Record actual counts; existing browser evidence predates this refactor.
7. Update owning architecture/process-flow docs and the related plans; retire the historical counter-retention exception.

Acceptance: no `workspaceRevision`, publication callback/holder infrastructure, HistoryPanel revision prop, `_touchGame` or `touchGame` in production/tests. Historical documents may explain the old mechanism. Timestamping is timestamp-only, actual data drives UI updates, canonical identities are consistent, all 25 premove scenario IDs execute, and full unit/journey/static checks pass. This remains a plan, not an implementation.
