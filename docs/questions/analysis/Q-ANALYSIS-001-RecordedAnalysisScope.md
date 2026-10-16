# Q-ANALYSIS-001 — What analysis is recorded for actual game moves?

| Field | Value |
| --- | --- |
| Status | Review prompt |
| Priority | P0 |
| Classification | Open payload/capture detail within settled recording scope |
| Raised | 15 October 2026 |
| Scope clarified | 15 October 2026, explicit user instruction |
| Reviewed revision | Source inspection based on `2d693f7`; no new browser run |
| Related questions | [Q-ANALYSIS-002 — resolved](Q-ANALYSIS-002-VariationRetention.md), [Q-ENGINE-001](../engine/Q-ENGINE-001-ComparisonAndPersistence.md) |

This is a planning review prompt, not a question currently awaiting an answer or blocking journey work. Investigate it when implementing/testing the relevant journeys; raise a concrete question only if that work reveals a real unresolved issue.

## Settled user intent

Recording applies only to actual moves played in games, not exploratory moves. The [resolved pruning decision](Q-ANALYSIS-002-VariationRetention.md) accepts temporary exploration and existing pruning. Durable exploratory variations are not the minimum recording capability; that earlier recommendation is superseded.

## Observation and evidence

- The [persistence contract](../../HighLevel/persistence_contract.md) includes the game move tree and analysis seats in canonical saves.
- [Move.ts](../../../src/contracts/Move.ts) models move nodes/branches; [Analysis.ts](../../../src/contracts/Analysis.ts) models engine seats and current-position lines. Those structures alone do not establish per-actual-move recorded-analysis content or capture timing.
- [SCN-HIST-03/04 and SCN-CTRL-04](../../HighLevel/scenarios.md) describe exploration independently from the actual-game recording feature. Saving a current workspace is not proof that an earlier real move's analysis can be retrieved.

## Remaining decision to clarify

What analysis payload is recorded for each actual game move, and when is it captured: at the move, as the engine produces a useful result, or through an explicit action on that actual move? What is the minimum information the user needs when revisiting the move?

Eligible moves and exploratory retention are settled. This question must not reopen them. Per-engine comparison/provenance details are owned by Q-ENGINE-001.

## Alternatives and provisional direction

- Automatically capture agreed analysis fields for actual moves as usable results become available.
- Let the user explicitly capture analysis for a selected actual move, with clear feedback that it has been recorded.
- Combine automatic recording with explicit refresh/replacement of an actual move's record.

Proposed starting point: attach records to stable actual-game move identities and make recorded versus fresh output distinguishable. Capture timing and fields remain open; do not infer a notes/bookmark workflow or add exploratory records.

## Journey impact

Affected cases: JRN-HIST-06, JRN-SAVE-07/15 and JRN-SESSION-01/03, with concurrent analysis coverage from JRN-ANALYSIS.

Independent exploration, pruning, move-tree serialisation and import-identity checks can proceed. Recording acceptance must verify actual-move ownership, preservation through later real moves and exploratory pruning, and save/load/export/import. Exploratory output must not create or replace an actual move's record.

## Resolution

Recording scope is settled by the user. Review payload/capture behaviour during journey work, using existing contracts and normal judgement. If a concrete unresolved issue emerges, record its evidence and ask then; this prompt itself is not an acceptance gate.
