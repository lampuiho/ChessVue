# Store dependency restructuring plan

Proposed on 23 October 2026. **Status: preliminary strategy; no application changes implemented.** Detailed function flows and final module boundaries are deferred until the current premove work settles. Saving this plan does not start the refactor.

## Objective and review basis

Make store behaviour easier to review manually in VS Code: follow a public action to its implementation, identify the owner of a transition, and find its callers without tracing several intermediate properties or forwarding callbacks.

Keep `GamesStore` as the public boundary. Replace its internal whole-composable dependency network with named operations and explicit runtime owners. Internal modules remain private parts of the store rather than additional public stores or architectural layers.

The initial review found:

- [GameMoveComposable](../src/state/game/GameMoveComposable.ts) accepts five complete composable APIs, obscuring which operations it actually needs.
- [GamesStore](../src/state/GamesStore.ts) uses later-assigned variables and forwarding callbacks to connect move, player-turn, clock and status behaviour in both directions.
- Public actions such as `makeMove: move.makeMove` add another property boundary between a UI caller and the implementation.

`ReturnType` itself is reasonable. The main concern is the number of intermediate properties and callbacks between a caller and its implementation, together with mutual orchestration between features. Changing type aliases or filenames alone would leave that ownership problem in place.

Follow [AGENTS.md](../AGENTS.md), the [archived code cleanup ownership decisions](ArchivedPlans/CodeCleanupPlan.md), and the [architecture dependency rules](HighLevel/architecture.md#dependency-rules). Coordinate with the separate [component simplification plan](ComponentSimplificationPlan.md) and the current [premove plan](PreMovePlan%28ToDo%29.md); final boundaries must reflect the settled implementation.

## Restructuring strategy

- **Use named exports for operations without factory-owned state.** Call sites should refer directly to imported implementations. Operations may still mutate the supplied game or its caches; removing a factory does not imply purity.
- **Give cross-feature transitions one coordinating owner.** Move commitment, turn cancellation, clock changes and analysis refresh need an explicit caller controlling their order. Lower-level transition operations should not call back into that coordinator.
- **Keep runtime owners scoped to the store.** Turn drains, pending timeouts and analysis subscriptions retain explicit ownership and disposal. Their mutable maps must not become module-level singletons.
- **Pass specific data or runtime owners.** Dependencies should expose what an operation needs. Do not replace whole-composable injection with a large context object, service locator or generic command interface.
- **Make public store actions explicit navigation points.** Named action wrappers should visibly call their implementation. Retain wrappers where they establish the public boundary, while avoiding forwarding layers between private modules.
- **Keep presentation on the public store boundary.** Components consume store actions and selectors. Private operation modules must not become a new API for components or a global game controller.

Callbacks remain appropriate at actual external boundaries, such as engine delivery. The target is redundant forwarding between private implementation modules; cancellation and resource ownership still determine how external work enters the store.

## Illustrative examples

The following names and call shapes are sketches, not final interfaces or complete function flows.

### 1. Remove a factory without instance state

[GamePositionComposable](../src/state/game/GamePositionComposable.ts) mostly operates on the supplied game and its runtime. Replace factory-returned operations with directly exported functions where no factory-owned state is required.

Current:

```ts
const position = useGamePosition();
const node = position.getLiveNode(game);
```

Proposed internal call:

```ts
import { getLiveNode } from './GamePosition';
const node = getLiveNode(game);
```

The call refers directly to the imported operation. Existing cache ownership and mutation semantics must be preserved. Presentation reads should remain available through an appropriate public store selector rather than importing private store internals.

### 2. Resolve the move/player-turn cycle through ownership

The initial implementation routes the commitment in [GamePlayerTurnComposable](../src/state/game/GamePlayerTurnComposable.ts) through several declarations:

```text
_commitTurn
  -> dependency.commitLiveMove
  -> GamesStore forwarding callback
  -> GameMoveComposable.commitLiveMove
```

Move handling also calls player-turn operations. Separate the coordinating workflow from the lower-level operations it invokes:

```text
GameTurnFlow
  -> turn runtime operations
  -> move transition operations
  -> clock/analysis follow-up
```

The workflow directly imports the move transition implementation. That implementation updates position/history without calling back into the turn coordinator. The exact split, including queue consumption, timeout reconciliation and turn settlement, must follow the completed premove implementation.

### 3. Expose a named public store action

Current return-object alias:

```ts
makeMove: move.makeMove,
```

Proposed action shape, with `submitGameMove` a named import and `_turnRuntime` a concrete store-owned runtime object:

```ts
function makeMove(game: IGame, move: IMoveRaw) {
  return submitGameMove(_turnRuntime, game, move);
}
```

A reviewer can follow the public action into its workflow and then follow direct implementation references. Public-action references and private-operation references remain separate, deliberate review boundaries.

## Ownership constraints

- Preserve existing game data, raw-move validation, canonical move enrichment and persisted contracts.
- Preserve explicit action, component event, route and lifecycle boundaries. Add no watchers or equivalent reactive subscriptions for effects.
- Preserve cancellation and settlement before superseded work is replaced. Do not introduce generation, epoch or sequence invalidation counters.
- Preserve actual turn, analysis-seat and engine-resource ownership. Keep independent resources independent.
- Preserve the implemented [workspace counter removal and timestamp naming design](WorkspaceRevisionRemovalPlan.md): remove `markRaw(game)`, the counter and publication callbacks; use the existing reactive collection's canonical game consistently. Keep backing data and required aliases without cloning. `timestampGame` updates only `metadata.updatedAt`. Do not add a holder map, manual publisher or another notification mechanism while restructuring dependencies.
- Keep domain calculations and platform access at their established service boundaries. Private store modules do not introduce new public same-layer dependencies.

## Migration order and later verification

After premove settles:

1. Extract position helpers and state predicates that need no factory-owned state.
2. Establish concrete runtime ownership and disposal boundaries.
3. Restructure move/player-turn/clock coordination around those owners.
4. Replace remaining public action aliases where an explicit action improves navigation.

Keep each step reviewable and preserve behaviour. The later detailed plan should specify final module responsibilities, function flows, cancellation boundaries, affected callers and verification cases against the settled source.

For implementation, run `npm run check:code`, type checking and the affected behavioural tests at each relevant step. Cover premove, clock and analysis behaviour where the ownership changes reach them; this preliminary document makes no new test execution claim.

Manually verify representative VS Code navigation paths for `makeMove`, `pauseGame` and `clearPremoves`. Check Go to Definition and Find All References from both the public action and its internal operations. The acceptance criterion is a clear path from caller to owner with fewer intermediate hops; direct exports should not be treated as a guarantee that reference searches cross every public/private boundary automatically.
