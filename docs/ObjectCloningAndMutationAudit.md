# Object cloning and mutation audit

This note preserves the findings from the August 2026 cloning pass so the deferred work can be resumed without repeating the audit.

## Runtime selector refactor

The runtime follow-up is complete:

- `createGameRuntime()` is the only constructor and creates an empty runtime without traversing the move tree.
- `renderedNode`, `liveNode`, `renderedPosition`, and `livePosition` are optional derived caches only. The authoritative move tree and paths remain exclusively on `IGame`.
- `MovePath` is readonly. Production path changes go through `setRenderedPath` and `setLivePath`, which replace the path and seed only node/position values already known by the caller.
- `replaceMoveTree` is the explicit take-back and analysis-root boundary and invalidates all four derived caches.
- `syncRuntimeNodeCache`, `syncMoveNodeHighlights`, and `buildGameRuntime` were removed. State-only transitions perform no selector work.
- Position APIs accept `IGamePositionState`, while the low-level resolver accepts only `IMoveTree` and `MovePath`.
- Move-flow tests assert exactly one board application and one mainline-node insertion for local, mixed local/engine, and engine-only games.

Move commit, analysis branch creation, navigation, and returning to live play already know the destination node, so they seed it while setting the path. Take-back and `replaceWithAnalysisRoot` replace the tree and invalidate both selectors. Board-edit or gameplay state transitions that retain the same paths do no node-cache work.

### Deferred highlight event

`IMoveNodeRuntime.isHighlighted` remains reserved for the UI, but it is intentionally not populated yet because the presentation semantics are not established. The eventual path-change event should build the union of nodes on the rendered and live routes, compare it with a runtime `Set` of previously highlighted nodes, and update only the symmetric difference. Both paths can share ancestors, so independently clearing one route would incorrectly unhighlight nodes still used by the other.

### Validation and move-flow constraints

Empty runtime creation and lazy selector caches are compatible with the current model because production node access is routed through `GamePositionComposable`. Deserialisation validates both persistent paths before hydration, and hydration restores parent links before game actions can resolve nodes.

The implementation preserves the existing `IGameRuntime` object after hydration. Pending player-turn promises, deferred moves, pause reasons, and focus-return subscriptions share that object, so path/cache operations mutate only their owned cache fields and never replace `game.$`.

The current live-move sequence is intentionally single-entry:

1. A local `makeMove` resolves the already-pending player-turn `Deferred`; it does not commit the move directly. An engine result resolves the same pending abstraction.
2. The single player-turn handler clears the completed pending handles and invokes `commitLiveMove` once.
3. `commitLiveMove` applies the clock, prunes future moves if needed, applies the board move once, inserts one move node, advances persistent selectors, updates game result/state, refreshes registrations and analysis, then requests the next turn once.

The scoped path setters are synchronous bookkeeping only. They do not touch the clock, game status, player-turn requests, analysis, or `updatedAt`, avoiding effects already owned by `commitLiveMove`.

For readability and genuine laziness, the live-state branch in `makeMove` now runs before obtaining the rendered node and rendered position. Those values are only resolved for the analysis/history branches.

The local-versus-local, local-versus-engine, engine-versus-engine, paused-engine, and stale-deferred-engine tests cover the asynchronous turn chain. Exact `MoveApplicationService.applyMove` and `MoveHistoryService.addMainlineMove` counts prevent duplicate commits from being introduced unnoticed.

## Resolved in the current pass

- Removed the locally used `getRenderedPath`; runtime construction now follows `game.renderedPath` directly.
- Hydration now restores parent metadata on the existing move tree instead of cloning every move node, move, and clock snapshot.
- Serialization now relies on the Zod persistence schemas to omit runtime-only and unknown fields; the separate recursive strip-and-clone traversal was removed.
- Settings parsing is the ownership boundary. Accepted settings are cached and returned directly, and draft state uses copy-on-write when patched.
- Engine inventory, appearance projection, and analysis-engine layout expansion are returned from their owning state without defensive cloning.
- Appearance projections reuse the static theme-variable records instead of copying them.
- Board edits act on `rootPosition` directly when the rendered path is empty, avoiding an empty-path position clone and repeated move-tree replacement.

## Clones that still represent real boundaries

The following copies should not be removed mechanically:

- rendered/live board positions when they must diverge;
- immutable clock snapshots and history records;
- stored path arrays when a caller-provided path may subsequently change;
- per-game player or engine assignments when they must not alias settings inventory records;
- accepted/draft settings separation when a draft is first edited;
- persistence parsing, where Zod produces the schema-owned persisted model.

For player and modal data, avoid generic `structuredClone` when engine runtime objects may be present: callbacks and similar function values cannot be structured-cloned. Prefer explicit persisted-field projections or a clearly defined ownership transfer.

## Remaining ownership and mutation-contract review

- `GamesStore.insertGame` mutates the supplied game during hydration, while duplicate repair only shallow-copies the top level. Decide whether insertion transfers ownership or should accept a persisted input and construct a store-owned game.
- Game creation retains `rootPosition` by reference while copying time-control and player data differently. Make these ownership rules consistent and explicit.
- `GamesStore.getGame` and `listGames` expose mutable live store objects. If consumers should only observe them, express that with readonly contracts rather than defensive clones.
- `MoveApplicationService` mutates positions and board contents, but documentation still describes immutable behaviour. Its mutation contract and return shape should be made explicit.
- `MoveHistoryService` operations such as add, take-back, rewrite, and prune mutate supplied nodes but return wrapper objects inconsistently.
- Cache-looking reads including FEN, SAN, UCI, check-state, and initial-position helpers populate `$` metadata. Either name/document that cache mutation or move it behind an explicit cache owner.
- Analysis update snapshots may be transferable instead of cloned if the producer contract is readonly or ownership-transferring.

`TimeControlService` and `EngineRuntimeService` already provide clearer examples because their mutation behaviour is stated near the mutating operations.
