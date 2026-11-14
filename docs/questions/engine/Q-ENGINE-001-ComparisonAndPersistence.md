# Q-ENGINE-001 — Which engine comparison results are recorded?

| Field | Value |
| --- | --- |
| Status | Resolved |
| Priority | P1 |
| Classification | Resolved by the cache decision in Q-ANALYSIS-001 |
| Raised | 15 October 2026 |
| Resolved | 8 November 2026 |
| Decision source | Explicit user clarification in conversation, 8 November 2026, recorded in [Q-ANALYSIS-001](../analysis/Q-ANALYSIS-001-RecordedAnalysisScope.md#decision) |
| Reviewed revision | Source inspection based on `2d693f7`; no new browser run |
| Last reviewed | 8 November 2026 against `30e9ed6`, source inspection only |
| Related questions | [Q-ANALYSIS-001 — resolved](../analysis/Q-ANALYSIS-001-RecordedAnalysisScope.md) |

## Decision

The user clarified: "the analysis is meant to be a cache and expects the same engine to reproduce the same moves." The full decision and its known gap are recorded in [Q-ANALYSIS-001](../analysis/Q-ANALYSIS-001-RecordedAnalysisScope.md#decision).

Consequences applied to this question:

- **Which engines:** every assigned seat is cached, in the game's seat order, when at least one seat has output. Each cached seat is valid only for the game seat at its index. **Why:** a cache entry stands in for recomputation by the engine that produced it, so one engine's entry cannot answer for another.
- **Which fields:** the seat index is the cache key; the copied engine identity and options are kept with it. Depth, scores, up to three principal variations and any best move are the cached value. The timestamps carry no comparison meaning.
- **Later computation:** a fresh result from the same engine and options carries the same information as the cached one, so it is not kept as a separate observation. When the position is revisited, fresh lines at least as deep as the cached ones replace them rank by rank, in the panel and in the record ([follow-up decisions](../analysis/Q-ANALYSIS-001-RecordedAnalysisScope.md#follow-up-decisions-on-reading-the-cache)).
- **Comparison:** comparing engines is a live, current-position capability ([SCN-ANALYSIS-01/02/05](../../HighLevel/scenarios.md)), not a stored per-move comparison record. No separate comparison view of recorded output is required.
- **Superseded:** the earlier journey guidance to keep a recorded observation distinct from a fresh engine result.

## User intent

Viewing multiple engine analyses is a confirmed capability. Recording applies only to actual moves played in games, as settled in [Q-ANALYSIS-002](../analysis/Q-ANALYSIS-002-VariationRetention.md); exploratory positions are not recording targets.

## Observation and evidence

- [SCN-ANALYSIS-01/02/05](../../HighLevel/scenarios.md) describe independent results and per-game engine management.
- The [engine runtime contract](../../HighLevel/engine_runtime.md) persists the latest valid result for each assigned engine, selects up to three visible lines, and clears current rendered results on position change. The stated concurrency limit is four analysis engines per game.
- [Analysis.ts](../../../src/contracts/Analysis.ts) models current rendered seats; [AnalysisSeat.ts](../../../src/contracts/AnalysisSeat.ts) also defines recorded seat snapshots attached to actual [move nodes](../../../src/contracts/Move.ts). The History tranche added these records on 16 October 2026.
- At `30e9ed6`, [GameAnalysisComposable](../../../src/state/game/GameAnalysisComposable.ts) `captureMoveAnalysis` recorded every seat with output when the live position was selected. Since 14 November 2026 it records every seat in order, revisiting that position seeds each seat from the saved seat at its index and pushes deeper lines back, and removing an engine removes its saved seat ([implementation](../analysis/Q-ANALYSIS-001-RecordedAnalysisScope.md#implementation)).

## Original question

Which engine results belong in an actual game move's analysis record: a selected engine or every assigned engine, and which identity/options, depth, score, PV and timestamp fields? Should later computation update that record or remain a separate fresh result? The decision above answers it.

Alternatives considered before the decision:

- Record one agreed result per actual move, with current-seat output/recomputation shown separately.
- Record a comparison from all assigned engines for each actual move, preserving engine provenance.
- Retain successive result updates for actual moves, which needs a separate size/update policy; exploratory output remains excluded.

## Journey impact

Affected cases: JRN-ANALYSIS-01/07/09/11/12, JRN-SAVE-07/15 and JRN-SESSION-02.

JRN-HIST-06 already covers independent per-engine copies and canonical serialisation, which the cache keeps. Test actual-move identity, later live moves, exploration/pruning, save/load and export/import. Exploratory results must not create or overwrite actual-move records. Each seat uses only the cached entry at its own index; the store-level spec covers an empty earlier seat and engine removal. Do not compare real engines using exact expected scores.

## Resolution

Resolved on 8 November 2026 through the cache decision in Q-ANALYSIS-001. The 16 October 2026 Analysis tranche, linked from [the scenario review](../../../journeys/definitions/analysis/ScenarioReview.md), remains the evidence for current multi-engine output, position supersession, scoped failure, roster limits, restore policy and rapid history navigation. Earlier reviews that kept this as a review prompt are superseded.
