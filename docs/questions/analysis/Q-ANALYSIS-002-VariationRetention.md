# Q-ANALYSIS-002 — Exploratory pruning and recorded-analysis scope

| Field | Value |
| --- | --- |
| Status | Resolved |
| Priority | P0 |
| Classification | Resolved product-scope clarification |
| Raised | 15 October 2026 |
| Resolved | 15 October 2026 |
| Decision source | Explicit user clarification in this conversation |
| Implementation evidence | Source inspection based on `2d693f7`; no new browser run |
| Related questions | [Q-ANALYSIS-001](Q-ANALYSIS-001-RecordedAnalysisScope.md), [Q-ENGINE-001](../engine/Q-ENGINE-001-ComparisonAndPersistence.md) |

## Decision

The user clarified: "recording analysis is only for actual moves in games, not exploratory ones."

Recorded analysis therefore belongs to actual moves played in a game. Exploratory moves are temporary; their pruning does not conflict with the recording feature. The existing latest-node pruning policy is accepted. An explicit Keep/Record action for exploratory branches is not required by this feature.

Preserve the existing distinct handling of unrelated historical branches and previously played continuations retained after a historical rewrite. This decision does not broaden automatic pruning to every variation or require removing branches from workspace restoration.

## Original concern and evidence

The initial question incorrectly treated durable exploratory variations as a possible minimum for recording. That interpretation is superseded by the user's clarification.

- [SCN-HIST-04](../../HighLevel/scenarios.md) prunes temporary exploratory descendants after the next real move from the same latest live node; SCN-CTRL-04 describes their temporary visibility after analysis exit.
- [GameMoveComposable.ts](../../../src/state/game/GameMoveComposable.ts) calls `MoveHistoryService.pruneFutureMoves(...)` before appending a real move where the live parent has children.
- [MoveHistoryService.ts](../../../src/domain/MoveHistoryService.ts) owns those tree operations. The existing policy needs verification, not a redesign to preserve exploratory records.

## Journey impact

- JRN-HIST-06 may assert the documented pruning as accepted behaviour; no recording-retention decision blocks it.
- JRN-HIST-05/09 continue to test exploration, history navigation and workspace restoration under their own contracts.
- JRN-SAVE-07/15 and JRN-SESSION-01 test recorded analysis for actual game moves through continued play, exploration/pruning, save/load and export/import. Exploratory moves must not create actual-move analysis records.
- Retain historical-rewrite and unrelated-variation regressions. A saved workspace branch is not, by itself, an entry in the recorded-analysis feature.

## Follow-up boundaries

Q-ANALYSIS-001 and Q-ENGINE-001 are non-blocking review prompts for actual-move recording details to examine during journey implementation/testing. Neither prompt reopens exploratory recording or the settled pruning policy.

The journey plan, high-level scenarios, persistence/engine scope notes and related question files reflect this decision. No runtime or schema change is implied, and no new test execution is claimed.
