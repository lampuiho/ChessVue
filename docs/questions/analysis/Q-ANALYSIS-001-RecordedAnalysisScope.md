# Q-ANALYSIS-001 — What analysis is recorded for actual game moves?

| Field | Value |
| --- | --- |
| Status | Resolved |
| Priority | P0 |
| Classification | Resolved product-intent clarification; cache read and write-back implemented 14 November 2026 |
| Raised | 15 October 2026 |
| Scope clarified | 15 October 2026, explicit user instruction |
| Resolved | 8 November 2026 |
| Decision source | Explicit user clarification in conversation, 8 November 2026 |
| Reviewed revision | Source inspection based on `2d693f7`; no new browser run |
| Last reviewed | 14 November 2026 against the working tree on `2022760`, with the cache implementation and its unit spec |
| Related questions | [Q-ANALYSIS-002 — resolved](Q-ANALYSIS-002-VariationRetention.md), [Q-ENGINE-001 — resolved](../engine/Q-ENGINE-001-ComparisonAndPersistence.md) |

## Decision

The user clarified: "the analysis is meant to be a cache and expects the same engine to reproduce the same moves."

A played move's `recordedAnalysis` is a cache of engine output for the position before that move. It is not a historical observation to set beside fresh output. **Why:** the same engine is expected to reproduce the same moves for the same position, so a cached result and a recomputed one carry the same information. Its value is avoiding recomputation, not preserving a separate record.

Consequences applied to this question:

- **Payload:** each cached seat holds what the analysis display needs for its engine: the copied engine identity and options, depth, scores, up to three principal variations and any best move. The capture payload implemented on 16 October 2026 already fits.
- **Capture timing:** automatic when the actual move is committed, from available output for the live parent. Explicit capture or replacement actions are not required.
- **Revisiting a move:** the user needs the normal current-position analysis, not a separate recorded-analysis surface. The removal of that panel on 21 October 2026 (`20d6d4b`) is consistent with this decision. When a played position is revisited, a seat whose engine and options match a cached seat is served from the cache instead of waiting for recomputation (see the follow-up decisions below).
- **Superseded:** the earlier provisional direction to make recorded output distinguishable from fresh output.
- **Unchanged:** only actual moves write the cache ([Q-ANALYSIS-002](Q-ANALYSIS-002-VariationRetention.md)); exploratory output never creates or replaces an entry.

### Implementation direction

These are routine details under [working rule 5](../README.md#working-rules), not further user decisions.

- The record is stored on the played child node but describes its parent position. A lookup for a rendered position therefore reads the record on that position's mainline child.
- Reproducibility is the premise, not a guarantee. Seats run an infinite search, so the cached depth is whatever was reached when the move was played, and multi-threaded search can vary between runs. Tests must not compare real engines using exact expected scores.

### Follow-up decisions on reading the cache

While the fix was planned on 8 November 2026, the user added:

- "It's supposed to put the current saved analysis into the rendered lines before subscribing for the updates." The spec always shows three lines per engine, so the seeded lines keep three ranks on screen while the fresh search builds up.
- A fresh line takes over a rank only once it is at least as deep as the cached line at that rank (the user chose "once depth is reached" over immediate replacement). **Why:** a fresh search starts at depth 1, and showing those lines over a deeper cached result would throw the cache away.
- "It just pushes the better lines to the saved list." Lines that take over a rank are also written into the cached record, so the next visit starts from the deeper result.

On 14 November 2026, reviewing the first implementation, the user added:

- "Not supposed to check if is same engine or find cached seat. The seat are ordered the same. Also supposed to work out of the box without logic because the data structure is laid out this way." The cached seat is the mainline child's saved seat at the same index as the game seat. This replaces the earlier engine-and-options key and the search across all played children.
- "Keep same order." Capture keeps every seat, including empty ones, so saved seat `i` is always the cache of game seat `i`.
- "Removing engine should remove all the saved lines." Removing an engine removes its saved seat from every record, which also keeps the remaining seats aligned.

### Implementation

Implemented on 14 November 2026 in [GameAnalysisComposable](../../../src/state/game/GameAnalysisComposable.ts):

- `_startAnalysisSeat` calls `_getCachedSeat`, which reads the mainline child's saved seat at the seat's index, and shows its lines before `_subscribeToAnalysis`.
- For a seeded seat, the subscription pushes each fresh line that is at least as deep as the saved line at its rank into the saved seat through `_pushBetterLines`, then shows the saved lines. The write uses `analysisLineSchema` copies, which strip runtime data.
- `captureMoveAnalysis` records every seat in the game's order, and `removeAnalysisEngine` removes the engine's saved seat from every record through `_removeCachedSeat`, dropping a record left with no seats.
- The cached seat belongs to the subscription. A position change disposes that subscription, so a superseded search cannot write into another position's record.
- If the engine fails or is unavailable, the seeded lines stay visible.

[AnalysisCache.spec.ts](../../../src/state/__tests__/AnalysisCache.spec.ts) covers:

- seeding before subscription;
- holding the cache against shallower lines;
- rank-wise take-over and write-back;
- an empty saved seat keeping its index and being filled by fresh lines;
- engine removal removing its saved seat from every record.

## Settled user intent

Recording applies only to actual moves played in games, not exploratory moves. The [resolved pruning decision](Q-ANALYSIS-002-VariationRetention.md) accepts temporary exploration and existing pruning. Durable exploratory variations are not the minimum recording capability; that earlier recommendation is superseded.

## Observation and evidence

- The [persistence contract](../../HighLevel/persistence_contract.md) includes the game move tree and analysis seats in canonical saves.
- [Move.ts](../../../src/contracts/Move.ts) models move nodes/branches; [Analysis.ts](../../../src/contracts/Analysis.ts) models engine seats and current-position lines. Those structures alone do not establish per-actual-move recorded-analysis content or capture timing.
- [SCN-HIST-03/04 and SCN-CTRL-04](../../HighLevel/scenarios.md) describe exploration independently from the actual-game recording feature. Saving a current workspace is not proof that an earlier real move's analysis can be retrieved.
- Current capture path at `30e9ed6`: [GameMoveComposable](../../../src/state/game/GameMoveComposable.ts) `_applyLiveMove` asks [GameAnalysisComposable](../../../src/state/game/GameAnalysisComposable.ts) `captureMoveAnalysis` for a record before committing an actual move and stores it as `recordedAnalysis` on the new node. A record is taken only when the selected board is the live position, and, at that revision, contained only seats with at least one line (every seat in order since 14 November 2026); while the user reviews history or explores in Analyse, background actual moves receive no record.
- Since 21 October 2026 (`20d6d4b`, "analysis panel update") the separate recorded-analysis panel has been removed. [SCN-HIST-01](../../HighLevel/scenarios.md#scn-hist-01---navigate-move-history-node) now shows only current-position evaluation.

## Original question

Implemented baseline on 16 October 2026 during JRN-HIST-01–09: actual moves automatically snapshot available engine seats from their rendered parent at commit. The payload includes copied engine configuration, output/capture timestamps, depth, scores, principal variations and available best move. Records are stored on played nodes. They were initially shown as pre-move output separately from fresh analysis; that panel was removed on 21 October 2026. Empty output creates no record; exploratory moves cannot overwrite one. JRN-HIST-06 covers preservation and two-engine provenance.

The question asked: what analysis payload is recorded for each actual game move, and when is it captured: at the move, as the engine produces a useful result, or through an explicit action on that actual move? What is the minimum information the user needs when revisiting the move? The decision above answers it.

Alternatives considered before the decision:

- Automatically capture agreed analysis fields for actual moves as usable results become available.
- Let the user explicitly capture analysis for a selected actual move, with clear feedback that it has been recorded.
- Combine automatic recording with explicit refresh/replacement of an actual move's record.

## Journey impact

Affected cases: JRN-HIST-06, JRN-SAVE-07/15 and JRN-SESSION-01/03, with concurrent analysis coverage from JRN-ANALYSIS.

Existing assertions remain valid: actual-move ownership, preservation through later real moves and exploratory pruning, and save/load/export/import. Exploratory output must not create or replace an actual move's record. A browser journey that revisits a played position and checks the seeded lines has not been added yet; the store-level spec above is the current evidence.

## Resolution

Resolved on 8 November 2026 by the user's clarification above. The follow-up decisions were implemented on 14 November 2026. Earlier reviews on 15–16 October and 8 November 2026 kept this as a review prompt and are superseded by this resolution.
