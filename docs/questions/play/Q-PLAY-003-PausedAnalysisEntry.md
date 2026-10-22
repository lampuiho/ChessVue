# Q-PLAY-003 — Analysis entry while actual play is paused

| Field | Value |
| --- | --- |
| Status | Resolved: paused entry and explicit exploratory moves/history allowed; implementation approved 22 October |
| Raised/resolved | 21-22 October 2026; entry and exploratory scope resolved by explicit user instructions |
| Classification | Product-policy change to an existing interaction restriction |
| Discovery | Review of the background-analysis function flow and the reason for its paused-entry guard |
| Evidence | Historical design/source audit and four isolated probes on 21 October; approved implementation and final unit/browser evidence are linked below |
| Related decisions | [Background play](Q-PLAY-001-LiveProgressDuringAnalysis.md), [premove conflicts](Q-PLAY-002-PremoveAnalysisConflicts.md), [analysis plan](../../BackgroundAnalysisPlan.md) |

## User decision and source

The user instructed: "should allow entering analysis while game paused" and asked whether the reason for prompting that decision was recorded.

Allow explicit Analyse on the selected canonical move in a paused game. Preserve its actual clock snapshot, Manual/Menu pause reasons, pending actual turn and any deferred actual output. Entry must not implicitly Resume. Exit must not implicitly Resume either. On 22 October the user approved the plan with "looks fine implement" and separately answered "Allow analysis moves/history while paused (recommended)". Entry, exploratory input and Exit are therefore allowed while actual play stays paused.

## Why this required a decision

Before this change, the restriction was an explicit existing product contract, not a missing API or technical requirement of analysis:

- [State model — live analysis and interruptions](../../HighLevel/state_model.md#live-analysis) restricts entry to live states and separately locks gameplay/history during Manual/Menu pauses.
- [Control-panel mode matrix](../../LowLevel/Architecture/Presentation/Components/GameControlPanel.md#mode-matrix) exposes Resume as the paused gameplay action and explicitly hides/disables Analysis Mode.
- [SCN-CTRL-04 paused branch](../../HighLevel/scenarios.md#scn-ctrl-04---enterexit-in-game-analysis-mode) blocks analysis entry while paused. [Its process flow](../../LowLevel/ProcessFlows/GameplayAndControl.md#scn-ctrl-04---enterexit-in-game-analysis-mode) names the paused-state assertion as intentional.
- [GameMoveComposable.enterInGameAnalysis](../../../src/state/game/GameMoveComposable.ts) previously called `assertNotPausedForAction`, and the old paused control surface did not expose entry.

The earlier requirement that Analyse must not itself pause a running game settled Analysis-owned clock freezes. It did not by itself settle what a user can do after deliberately pausing with Manual/Menu. Removing that separate restriction therefore needed an explicit product choice rather than silently treating the guard as accidental.

The initial draft identified the conflicting rules but did not provide a focused decision record with this reasoning. The assistant first proposed allowing paused exploration, then withdrew it after reading the existing contracts. Those proposals were not user decisions. This file records the user's actual entry decision and why clarification was warranted.

## Alternatives and rationale

- Preserve the prior interaction lock: user must Resume before Analyse, which also restarts actual time/play. This was the previous contract.
- Allow Analyse while retaining the actual pause: review/exploration can be separated from the choice to Resume actual play. The user selected paused entry; existing paused-analysis states already represent that context.
- Resume actual play as a side effect of entry: not selected; it would discard the independently owned pause intention.

No new store/service API, game-state enum or persistence field is required for entry: select the existing paused-analysis state and retain actual pause ownership. Existing actions and component events remain the intended boundary.

## Resolved follow-up: analysis moves and history while paused

Entry permission and exploratory input are distinct existing gates. The previous state model also blocked analysis moves and history under Manual/Menu, including in paused-analysis states. Allowing only entry would therefore still open a read-only analysis board until Resume.

The follow-up question was sent with its reason: should analysis moves/history work while actual play remains paused? The recommendation is yes, so an actual-game pause does not prevent explicit analysis, while actual commits, clocks, result actions and actual Takeback retain their pause restrictions. The user confirmed this recommendation on 22 October. Actual Takeback and result actions retain separate pause guards; only final real Resume flushes held actual output.

## Scenario and implementation impact

- [Analysis plan](../../BackgroundAnalysisPlan.md): revise entry flow, real-pause distinction and BA-13 to permit entry while preserving paused actual data; entry/Exit must not flush deferred output.
- BA-14/15/27 and history/PV controls permit paused explicit exploration. Preserve independent actual-pause and cancellation assertions.
- Existing `PausedLiveAnalysisFrom*` state values and pause ownership are sufficient. Keep the schema and public API unchanged.
- After written-plan approval, write/revise unit specifications before production code. Retain paused entry as a meaningful failing observable test, not a new helper contract.
- Reconcile affected state/control/scenario descriptions and journey expectations with the approved scope. Old documentation/test results describe the previous restriction, not acceptance of the new behaviour.

## Breakage audit after the user requested a compatibility check

Reviewed on 21 October 2026 with HEAD `f046bd4` and the then-current working-tree sources; the working tree is not assumed clean. No production or retained test file was changed. Four Node-stdin probes transpiled the actual TypeScript function bodies in memory and supplied controlled dependencies. They exercise state/ownership branches, not real clocks, engines, rendering or persistence. These are narrow reproductions of the hazards below, not acceptance of an implementation.

| Finding | Trigger and observed risk | Required minimal handling | Evidence / planned case |
| --- | --- | --- | --- |
| PA-01: removing the assertion is insufficient | Suppress only the entry pause assertion. `enterInGameAnalysis` still handles only ordinary live states; a paused ongoing game falls through unchanged | Include paused-live states in the existing entry branch and pass the preserved pause status to `getLiveAnalysisState`; do not call pause/resume or replace actual work | Probe confirmed no-op; [entry](../../../src/state/game/GameMoveComposable.ts#L216), BA-13 |
| PA-02: return-to-live can release the logical pause | Invoke the existing `_returnToLiveNode` on paused analysis. It unconditionally selects `Live*Turn` and reaches actual turn arming while Manual ownership is still present | Before reusing this helper for Exit, preserve real paused state and terminal result. Restore selection without calling clock resume, flushing output or arming actual play while paused | Probe confirmed live state with Manual retained and arming reached; [helper](../../../src/state/game/GameMoveComposable.ts#L87), BA-06/13 |
| PA-03: Resume can leave the engine turn stuck | Final Manual Resume changes paused analysis to unpaused analysis, but `resumeGame` only flushes/requests for ordinary `Live*Turn` | After the final genuine owner is removed, use the existing actual readiness predicate for flush/request in either eligible unpaused state family. Entry/Exit must not own this delivery | Probe confirmed zero flush/request calls and retained deferred move; [Resume](../../../src/state/game/GameClockComposable.ts#L119), BA-15 |
| PA-04: an early flush loses the held reply | Call `flushDeferredPlayerMove` while still paused. It clears the slot before checking readiness and returns without committing | Keep delivery at the final real Resume boundary; entry, Exit and removal of a non-final owner must never call flush. Existing cancellation remains responsible for discarding invalidated output | Probe confirmed cleared slot with zero commits; [flush](../../../src/state/game/GamePlayerTurnComposable.ts#L74), BA-13/15 |
| PA-05: a broad exploration exception can unlock actual Takeback | If BA-Q4 allows paused exploration by widening `canExploreAnalysis`, `takeBack` also calls `assertExplorationAllowed`; it can then rewind the live game and restart a clock while genuinely paused | Retain a real-pause guard on actual Takeback independently of the exploration permission. Keep existing guards on actual moves/results; do not weaken the shared pause assertion globally | Source finding conditional on BA-Q4; [Takeback](../../../src/state/game/GameMoveComposable.ts#L170), [shared assertion](../../../src/state/game/GameStatusComposable.ts#L108), BA-14/22 |
| PA-06: controls cannot be fixed by changing mode precedence alone | Existing paused mode shows Resume and hides Analyse/Exit; board/PV/history also key off that mode. Prioritising analysis instead can hide Resume and incorrectly expose actual controls | Render entry/Exit and retain real Resume using the existing game state/actions; evaluate exploratory input separately from actual pause. Keep actual Takeback/result actions blocked. Review this concrete paused-analysis combination without adding an enum/store API | Source finding; [view mode](../../../src/views/GameView.vue#L87), [controls](../../../src/components/GameControlPanel.vue#L29), BA-13/14/15 |
| PA-07: isolation and restore must remain coherent | Equal-valued paths currently re-alias positions. Restore reconstructs Analysis plus Manual, which would require an unwanted extra Exit before actual time resumes | Apply the prerequisite's reference-based cache isolation and Manual-only restored ownership; preserve selected board through final Resume and do not change the saved schema | Source finding; [position getters](../../../src/state/game/GamePositionComposable.ts#L45), [restore](../../../src/state/game/GameWorkspaceComposable.ts#L64), BA-02/32/33 |

The supported combination is an existing `PausedLiveAnalysisFrom*` state, unchanged actual pause reasons/clock/pending work, and an independent selected board. Preserve that state/reason consistency through every entry/Exit/navigation path: player output checks the state, not just the pause-reason array. Otherwise a seemingly UI-only transition can allow an actual commit.

No inherent API/schema blocker was found for paused entry. It is not a safe one-line guard removal. The four measured control-flow hazards and three related source findings must be covered by the unit-first implementation after plan approval. The confirmed BA-Q4 decision permits explicit paused exploratory input; it does not change the confirmed requirement that actual play stays paused until final Resume.

The subsequent [scenario-by-scenario function replan](../../BackgroundAnalysisScenarioFlow.md) incorporates these findings into all 40 concrete paths, including each paused-input alternative. Entry, Exit, real Resume and actual Takeback now have separate branch rules; no production fix or new verification is implied by that documentation.

Implementation and passing end-to-end verification are not claimed by this audit.

Implementation record: the approved change follows these ownership boundaries, including Manual-only restore and a separate actual Takeback pause guard. See the [plan verification record](../../BackgroundAnalysisPlan.md#implementation-and-verification) for executed test lanes. The source probes above remain historical audit evidence.
