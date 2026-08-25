# Object cloning and mutation audit

This note preserves the findings from the August 2026 cloning pass so the deferred work can be resumed without repeating the audit.

## Deferred runtime work

`GamePositionComposable` currently exposes both `createGameRuntime` and `buildGameRuntime`, although one only delegates to the other. It also exposes `syncRuntimeNodeCache`, whose name does not identify what is synchronised and whose implementation rebuilds node references and highlight caches from the persistent paths.

The intended follow-up is:

- choose one explicit `create` or `build` operation rather than keeping both names;
- remove the generic `sync` terminology;
- treat runtime nodes and positions as lazy caches obtained by following `renderedPath` and `livePath` through the move tree;
- avoid rebuilding the full runtime cache after ordinary changes when the required node can be resolved from its persistent path;
- review `syncMoveNodeHighlights`, which recreates every node's `$` object while walking the whole tree.

This was deliberately not changed in the current pass.

## Resolved in the current pass

- Removed the locally used `getRenderedPath`; runtime construction now follows `game.renderedPath` directly.
- Hydration now restores parent metadata on the existing move tree instead of cloning every move node, move, and clock snapshot.
- Serialization now relies on the Zod persistence schemas to omit runtime-only and unknown fields; the separate recursive strip-and-clone traversal was removed.
- Settings parsing is the ownership boundary. Accepted settings are cached and returned directly, and draft state uses copy-on-write when patched.
- Engine inventory, appearance projection, and analysis-engine layout expansion are returned from their owning state without defensive cloning.
- Appearance projections reuse the static theme-variable records instead of copying them.

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
