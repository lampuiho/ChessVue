# Object cloning and mutation audit

This note preserves the findings from the August 2026 cloning pass so the remaining work can be resumed without repeating the audit.

## Completed work

- `createGameRuntime()` is the only runtime constructor and creates an empty runtime without traversing the move tree.
- `renderedNode`, `liveNode`, `renderedPosition`, and `livePosition` are optional derived caches only. The authoritative move tree and paths remain exclusively on `IGame`.
- `MovePath` is readonly. Production path changes go through `setRenderedPath` and `setLivePath`, which replace the path and seed only node or position values already known by the caller.
- `replaceMoveTree` is the explicit take-back and analysis-root boundary and invalidates all four derived caches.
- `syncRuntimeNodeCache`, `syncMoveNodeHighlights`, and `buildGameRuntime` were removed. State-only transitions perform no selector work.
- Position APIs accept `IGamePositionState`, while the low-level resolver accepts only `IMoveTree` and `MovePath`.
- Removed the locally used `getRenderedPath`; runtime construction now follows `game.renderedPath` directly.
- Hydration restores parent metadata on the existing move tree instead of cloning every move node, move, and clock snapshot.
- Serialisation relies on the Zod persistence schemas to omit runtime-only and unknown fields; the separate recursive strip-and-clone traversal was removed.
- Settings parsing is the ownership boundary. Accepted settings are cached and returned directly, and draft state uses copy-on-write when patched.
- Engine inventory, appearance projection, and analysis-engine layout expansion are returned from their owning state without defensive cloning.
- Appearance projections reuse the static theme-variable records instead of copying them.
- Board edits act on `rootPosition` directly when the rendered path is empty, avoiding an empty-path position clone and repeated move-tree replacement.
- `insertGame` transfers ownership of its supplied `IGame`. Hydration and duplicate-ID repair mutate and retain that same object instead of creating a shallow wrapper clone.
- Game creation and setup retain their supplied time-control object by reference. A time control is not a snapshot boundary.
- Assigning a reusable player record to a game creates an explicit persisted player snapshot through `playerSchema`; runtime fields such as engine callbacks are discarded rather than cloned.
- `getGame` and `listGames` expose the live store objects through deep-readonly observation contracts. Consumers do not receive defensive clones and cannot mutate those objects through the declared API.
- `MoveApplicationService` documentation now states its mutation contract: `applyMove` and board edits mutate caller-owned positions, while `genPosition` is the explicit copied-position boundary.
- Move-flow tests assert exactly one board application and one mainline-node insertion for local, mixed local/engine, and engine-only games.

Move commit, analysis branch creation, navigation, and returning to live play already know the destination node, so they seed it while setting the path. Take-back and `replaceWithAnalysisRoot` replace the tree and invalidate all four caches. Board-edit or gameplay state transitions that retain the same paths do no node-cache work.

Empty runtime creation and lazy selector caches are compatible with the current model because production node access is routed through `GamePositionComposable`. Deserialisation validates both persistent paths before hydration, and hydration restores parent links before game actions can resolve nodes.

The implementation preserves the existing `IGameRuntime` object after hydration. Pending player-turn promises, deferred moves, pause reasons, and focus-return subscriptions share that object, so path/cache operations mutate only their owned cache fields and never replace `game.$`.

The current live-move sequence is intentionally single-entry:

1. A local `makeMove` resolves the already-pending player-turn `Deferred`; it does not commit the move directly. An engine result resolves the same pending abstraction.
2. The single player-turn handler clears the completed pending handles and invokes `commitLiveMove` once.
3. `commitLiveMove` applies the clock, prunes future moves if needed, applies the board move once, inserts one move node, advances persistent selectors, updates game result/state, refreshes registrations and analysis, then requests the next turn once.

The scoped path setters are synchronous bookkeeping only. They do not touch the clock, game status, player-turn requests, analysis, or `updatedAt`, avoiding effects already owned by `commitLiveMove`.

For readability and genuine laziness, the live-state branch in `makeMove` runs before obtaining the rendered node and rendered position. Those values are resolved only for the analysis and history branches.

The local-versus-local, local-versus-engine, engine-versus-engine, paused-engine, and stale-deferred-engine tests cover the asynchronous turn chain. Exact `MoveApplicationService.applyMove` and `MoveHistoryService.addMainlineMove` counts guard against duplicate commits.

## Deferred highlight event

`IMoveNodeRuntime.isHighlighted` remains reserved for the UI, but it is intentionally not populated yet because the presentation semantics are not established. The eventual path-change event should build the union of nodes on the rendered and live routes, compare it with a runtime `Set` of previously highlighted nodes, and update only the symmetric difference. Both paths can share ancestors, so independently clearing one route would incorrectly unhighlight nodes still used by the other.

## Copies that remain intentional

The following copies should not be removed mechanically:

- rendered and live board positions when they must diverge;
- immutable clock snapshots and history records;
- stored path arrays when the state boundary must own a stable path value;
- persisted per-game player or engine snapshots created from reusable inventory records;
- accepted and draft settings separation when a draft is first edited;
- persistence parsing, where Zod produces the schema-owned persisted model.

Avoid generic `structuredClone` when player, engine, or modal data may contain runtime objects: callbacks and similar function values cannot be structured-cloned. Use the persisted schema for a required snapshot, or transfer ownership when no snapshot boundary exists.

## Remaining ownership and mutation-contract review

- `MoveHistoryService` operations such as add, take-back, rewrite, and prune mutate supplied nodes but return wrapper objects inconsistently.
- Cache-looking reads including FEN, SAN, UCI, check-state, and initial-position helpers populate `$` metadata. Either name or document that cache mutation, or move it behind an explicit cache owner.
- Analysis update snapshots may be transferable instead of cloned if the producer contract is readonly or ownership-transferring.

`TimeControlService`, `EngineRuntimeService`, and `MoveApplicationService` now provide clear examples because their mutation behaviour is stated near the mutating operations.
