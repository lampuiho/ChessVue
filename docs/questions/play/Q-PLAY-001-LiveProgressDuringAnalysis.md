# Q-PLAY-001 — Does live play continue during interactive analysis?

| Field | Value |
| --- | --- |
| Status | Review prompt |
| Priority | P0 |
| Classification | Open timing/turn policy and possible scenario gap |
| Raised | 15 October 2026 |
| Reviewed revision | Source inspection based on `2d693f7`; no new browser run |
| Related questions | [Q-ANALYSIS-003](../analysis/Q-ANALYSIS-003-SuggestionInteraction.md) |

This is a planning review prompt, not a question currently awaiting an answer or blocking journey work. Investigate it when implementing/testing the relevant journeys; raise a concrete question only if that work reveals a real unresolved issue.

## User intent

The user wants to analyse interactively while playing a game. That establishes an integrated workflow, but does not yet specify whether clocks and opponent turns continue during exploration.

## Observation and evidence

- [SCN-HIST-01](../../HighLevel/scenarios.md) describes history review while live play and its clock continue independently. SCN-CTRL-04 describes exploration without progressing the live game; pause branches introduce another permission boundary.
- In [GameMoveComposable.ts](../../../src/state/game/GameMoveComposable.ts), `enterInGameAnalysis(...)` adds an analysis pause and `exitInGameAnalysis(...)` removes that ownership while returning to the live node.
- [GameClockComposable.ts](../../../src/state/game/GameClockComposable.ts) handles layered pause reasons and deferred output. [GamePlayerTurnComposable.ts](../../../src/state/game/GamePlayerTurnComposable.ts) only arms a new turn when the eligible live position is rendered.
- The [engine runtime contract](../../HighLevel/engine_runtime.md) allows in-flight work to finish during pause while deferring a player move. These are meaningful different states, not one uniform analysis workflow.

## Decision to clarify

Should interactive analysis always pause the actual game, allow live clocks/opponent progress in the background, or expose both as clearly distinguishable flows? If the live position advances during review, what should the user see and what anchors the temporary exploratory branch? Recording remains restricted to actual game moves under the [resolved scope decision](../analysis/Q-ANALYSIS-002-VariationRetention.md).

Clock correctness and avoiding a surprise live move are settled safety concerns. The default progression policy and return-to-live experience are still open.

## Alternatives and provisional direction

- Pause the game for explicit Analyse mode, while keeping ordinary history review distinct.
- Continue live progression while exploring an anchored analysis branch, with visible live-turn/change feedback and a return action.
- Support both through explicit, understandable controls rather than inferring timing policy from the selected history node.

Proposed starting point: preserve existing clock/turn safety while making the modes and pause ownership visible. Decide the default before changing turn scheduling or promising uninterrupted opponent progression.

## Journey impact

Affected cases: JRN-HIST-01/05/07, JRN-CLOCK-02/03/04/09/11, JRN-RACE-01/02/05 and JRN-SESSION-03.

Keep precise pause/deferred-turn regressions and exercise the existing documented matrix for manual/menu/analysis pause, running history review, pending opponent reply and return to live. Raise a question only if that implementation/testing exposes a specific conflict or ambiguity; no new matrix approval is required upfront.

## Resolution

Review the documented progression policy while implementing/testing history, clock and turn journeys. Ask only if a concrete finding cannot be resolved from established intent/contracts; this prompt does not require an upfront policy decision.
