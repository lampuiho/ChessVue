# Premove data structure

Implemented on 22 October 2026 as the data prerequisite to the [premove behaviour plan](PreMovePlan%28ToDo%29.md). Queue execution, speculative movement and presentation are subsequent work, specified by data-driven unit tests first.

The parent plan includes the [concrete function flows](PreMovePlan%28ToDo%29.md#function-flow), [fixture/event/assertion specification](PreMovePlan%28ToDo%29.md#data-driven-unit-test-specification) and [all 25 premove scenarios](PreMovePlan%28ToDo%29.md#concrete-scenarios-for-unit-tests). Its [PRE-01 unit-test baseline](PreMovePlan%28ToDo%29.md#pre-01-unit-test-baseline) records 139 new tests against these interfaces before behaviour implementation: 82 fail and 57 pass. Rule cases extend the existing `GameRuleUtility` tests; board projection/red shading is checked through the mounted view. No separate premove utility/library is planned. The data-boundary tests alone do not cover queue behaviour.

## Contracts and ownership

[Premove.ts](../src/contracts/Premove.ts) defines two plain interfaces. [IGameRuntime](../src/contracts/Game.ts) owns the optional `premoveQueue` under `game.$`; an absent queue means no pending intentions. A completed store action removes an empty queue. There is no new persisted field, schema version, asynchronous owner or store action in this step.

| Data | Meaning |
| --- | --- |
| `IPremoveQueue.player` | Exact actual human seat object from this game. Its colour supplies the expected colour for every entry. Eligibility requires local versus engine; the type alone does not grant input permission |
| `IPremoveQueue.moves` | FIFO of local intentions. Index zero is the next actual local turn; each later entry assumes earlier entries have executed in order, with unknown opponent turns between them |
| `IPremove.from/to` | Absolute board IDs, independent of orientation. A later source can be an earlier destination |
| `IPremove.movingPiece` | Expected own piece kind at this step of projection/execution, preventing a different piece from silently taking over an intention |
| `IPremove.promotionPiece` | Optional explicit queen, rook, bishop or knight. Later intentions refer to the promoted kind |

Only raw intent and expected piece kind are stored. Castling, en-passant, capture, check, ambiguity, notation and pondering are determined from the actual board when the move is due. Pending promotion choice remains unfinished board input, outside the queue. The queue contains no `IMove`, promise, callback, controller, speculative history node or duplicate board.

No node anchor is needed in the queue. Its base is always this game's current actual live position, derived through the existing live selector/cache. Real commits revalidate the remainder against that position; Takeback, rewrite, seat/root replacement and other invalidating actions explicitly clear it. Keeping a second last-validated node would duplicate actual game state and require synchronisation after every move.

## Plain-data fixture

After constructing/hydrating a human-versus-engine game, fixtures can attach the queue directly:

```ts
game.$!.premoveQueue = {
  player: game.whitePlayer!,
  moves: [
    { from: 6, to: 21, movingPiece: PieceKind.Knight }, // g1-f3
    { from: 21, to: 38, movingPiece: PieceKind.Knight }, // f3-g5
  ],
};
```

Bind the player reference after fixture construction: existing game builders clone supplied canonical data, and hydration replaces runtime state. Use this game's actual seated player. No engine, timer, component or mock is needed to construct the queue.

The future projection test for this fixture expects the knight on g5, g1/f3 empty and red squares `[6, 21, 38]`, with canonical board/side-to-move, clock, tree and selectors unchanged. Those squares and displaced pieces are derived output rather than additional queue authority.

## Behaviour to specify before implementation

- Append copies raw input into the FIFO only for eligible opponent-turn gameplay. Explicit Analyse uses the canonical selected position and does not edit the queue.
- Rebase reads the current actual live position after every real commit and projects every remaining intention in order. There is no stored node/path/FEN to advance or synchronise. Unknown future opponent moves are not predicted.
- A due legal actual move consumes one head after its actual commit. Any invalid source, dependency, projection or due move clears the whole remaining queue by removing `game.$.premoveQueue`.
- Undo removes the last intention; Clear removes the queue. Neither creates history, changes clocks or dirties the saved-game timestamp.
- Analysis, ordinary review, genuine pauses and temporary navigation retain the same runtime queue. Actual commits can consume it while another canonical position is selected; Exit displays only the current remainder.
- Actual Takeback/rewrite, a changed player assignment, root/setup replacement, result or explicit queue-owning close/disposal clears it at that existing action boundary. A no-op assignment does not clear it. Those explicit boundaries own continuation invalidation.
- Each game owns its own queue. Save/export omit it; load/import/hydration begin without one. The existing serialization schema already omits `$` and hydration creates fresh runtime state.

These are the next implementation specifications, not behaviour added by declaring the interfaces. Keep the current player-turn lifecycle until its separately tested integration replaces it; the queue is independent of the existing deferred actual engine reply.

## Boundary verification

[PremoveData.spec.ts](../src/state/__tests__/PremoveData.spec.ts) constructs both colours as plain game data, checks canonical save equality, queue/player reference ownership, actual-node advancement without queue bookkeeping, serialization with cyclic runtime parent links, empty restored queues and hydration isolation between games. It uses the real serialization and position functions without mocks or asynchronous work. The new scenario/projection tests specify gameplay separately and intentionally fail until premove implementation; they do not change this green data contract.

Verified on 22 October: all 24 focused PremoveData/SerializationService/GamePosition tests passed. `npm run build` passed, including TypeScript checking and `check:code`; `git diff --check` passed. This data-only change has no new browser interaction to exercise.
