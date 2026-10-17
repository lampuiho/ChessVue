# Q-ANALYSIS-003 — Does clicking an engine line explore or play?

| Field | Value |
| --- | --- |
| Status | Review prompt |
| Priority | P0 |
| Classification | Open interaction policy / potential usability gap |
| Raised | 15 October 2026 |
| Reviewed revision | Source inspection based on `2d693f7`; no new browser run |
| Related questions | [Q-PLAY-001](../play/Q-PLAY-001-LiveProgressDuringAnalysis.md), [Q-ANALYSIS-002](Q-ANALYSIS-002-VariationRetention.md) |

This is a planning review prompt, not a question currently awaiting an answer or blocking journey work. Investigate it when implementing/testing the relevant journeys; raise a concrete question only if that work reveals a real unresolved issue.

## User intent

Interactive analysis during play should be easy to enter and should not accidentally submit a live move. Being able to inspect a continuation and intentionally choosing a move to play are distinct user intentions.

## Observation and evidence

- [SCN-ANALYSIS-04](../../HighLevel/scenarios.md) assigns different effects to PV clicks in live play, history review and analysis. It also applies the game's `showLiveAnalysisMoves` preference across live-game contexts.
- In [GameView.vue](../../../src/views/GameView.vue), `showAnalysisMoves` depends on the presence of a live path and the preference. `playAnalysisLine(...)` chooses a whole selected prefix for exploration contexts, but only the first move for normal live play.
- As a result, current score-only policy can hide move targets in an in-game analysis context, while an enabled target in normal live play can commit a real move. These are documented behaviours to examine, not automatically defects.
- Existing JRN-ANALYSIS-03/04/05 describe these rules but do not establish that the distinction is understandable to a user seeking interactive exploration.

## Decision to clarify

What should selecting a PV mean while a game is live: inspect the line on a branch, play its first move, or choose an explicitly labelled action? Should entering analysis always allow interactive PV inspection even if live assistance is configured as score-only?

## Alternatives and provisional direction

- Retain the current context-dependent action, with clear visible state and explicit permission for live commits.
- Make PV clicks explore by default and provide a distinct intentional Play action.
- Require an explicit analysis entry before interactive PV inspection, separating live display preferences from exploration permissions.

Proposed direction: make exploration and real-move submission distinguishable, and avoid a live score-only preference silently disabling an intentional exploration workflow. The precise controls/default remain open; do not add confirmation dialogs by assumption.

## Journey impact

Affected cases: JRN-ANALYSIS-03/04/05/06/10, JRN-HIST-05, JRN-SESSION-02/03 and JRN-UX-01/02.

Continue stale-prefix rejection, one-move live submission and pause safety regressions as current-behaviour coverage. Acceptance of the chosen interaction needs a context/preference matrix and a clear user-visible distinction, with the selected prefix explored or its first move intentionally committed according to the eventual policy. Only an actual game move is eligible for recorded analysis; an explored prefix remains temporary under the resolved Q-ANALYSIS-002 scope.

## Resolution

The 16 October 2026 Analysis tranche exercises live, in-game analysis and history with both preference values, one-move live submission, exact prefix playback in free/untimed/timed analysis, stale-prefix rejection, switching games during playback and manual-pause safety. The visible Live, Analysis mode and Study controls states and explicit Analyse/Exit analysis controls distinguish the existing contexts. [The case review](../../../journeys/definitions/analysis/ScenarioReview.md) records the assertions; [execution evidence](../../JourneyImplementation.md#analysis-verification) remains separate. No new interaction decision is needed for these specified regression cases. Broader usability assessment stays with the usability/session work rather than being inferred from deterministic passes.

Exercise SCN-ANALYSIS-04 and its existing preference/context rules during journey work. Ask if a concrete usability or design conflict remains; this prompt alone does not block writing those tests.
