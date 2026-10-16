# Q-ENGINE-001 — Which engine comparison results are recorded?

| Field | Value |
| --- | --- |
| Status | Review prompt |
| Priority | P1 |
| Classification | Open persistence scope / potential product gap |
| Raised | 15 October 2026 |
| Reviewed revision | Source inspection based on `2d693f7`; no new browser run |
| Related questions | [Q-ANALYSIS-001](../analysis/Q-ANALYSIS-001-RecordedAnalysisScope.md) |

This is a planning review prompt, not a question currently awaiting an answer or blocking journey work. Investigate it when implementing/testing the relevant journeys; raise a concrete question only if that work reveals a real unresolved issue.

## User intent

Viewing multiple engine analyses is a confirmed capability. Recording applies only to actual moves played in games, as settled in [Q-ANALYSIS-002](../analysis/Q-ANALYSIS-002-VariationRetention.md). The remaining uncertainty is which engine comparison data should be retained for those actual moves; exploratory positions are not recording targets.

## Observation and evidence

- [SCN-ANALYSIS-01/02/05](../../HighLevel/scenarios.md) describe independent results and per-game engine management.
- The [engine runtime contract](../../HighLevel/engine_runtime.md) persists the latest valid result for each assigned engine, selects up to three visible lines, and clears current rendered results on position change. The stated concurrency limit is four analysis engines per game.
- [Analysis.ts](../../../src/contracts/Analysis.ts) models copied engine assignment, timestamp, depth, score and PVs per seat for the current rendered position. It does not define an archive of comparison snapshots attached to historical nodes.
- The [persistence contract](../../HighLevel/persistence_contract.md) includes analysis seats, but restoring those seats alone is not proof that a user's chosen historical comparison was recorded.

## Decision to clarify

Which engine results belong in an actual game move's analysis record: a selected engine or every assigned engine, and which identity/options, depth, score, PV and timestamp fields? Should later computation update that record or remain a separate fresh result? Capture timing is coordinated with Q-ANALYSIS-001.

## Alternatives and provisional direction

- Record one agreed result per actual move, with current-seat output/recomputation shown separately.
- Record a comparison from all assigned engines for each actual move, preserving engine provenance.
- Retain successive result updates for actual moves, which needs a separate size/update policy; exploratory output remains excluded.

Proposed starting point: verify the existing independent multi-engine experience first, then retain only the agreed fields tied to actual game moves. Do not infer a full engine-output timeline or recording of exploratory positions.

## Journey impact

The 16 October 2026 History implementation adds per-actual-move snapshots of all available engine seats, including copied identities/options, timestamps, depth, scores, principal variations and best moves. A separate Recorded analysis panel identifies the pre-move context. JRN-HIST-06 has two-engine integration coverage for independent copies and canonical serialisation; this does not complete the separate comparison UI or save/import acceptance groups below.

Affected cases: JRN-ANALYSIS-01/07/09/11/12, JRN-SAVE-07/15 and JRN-SESSION-02. Existing concurrent output, scoped failure and seat restore tests can proceed independently.

Test actual-move identity/provenance, later live moves, recomputation, exploration/pruning, save/load and export/import under the chosen content policy. Exploratory results must not create or overwrite actual-move records. Keep a recorded observation distinct from a fresh engine result; do not compare real engines using exact expected scores.

## Resolution

Inspect and test actual-move recording and engine comparison behaviour during the relevant journeys. If the work exposes a specific payload/persistence ambiguity, record the evidence and ask then; this prompt is not a prerequisite to implementation.
