# Analysis scenario review

Review/verification spans 16–17 October 2026. The low-level AnalysisPanel, proposed AnalysisEngineSection and analysis/setup process notes still claimed FRONTEND-DRIFT-04 was unimplemented; source inspection and the new journeys establish individual PV targets and prefix playback, so those stale notes are corrected while the separate component-extraction proposal remains pending.

Reviewed on 16 October 2026 against source based on `30dcdc0` and this tranche, the complete SCN-ANALYSIS-01–05 flows and branches, the [engine](../../../docs/HighLevel/engine_runtime.md), [state](../../../docs/HighLevel/state_model.md), [settings](../../../docs/HighLevel/settings_contract.md) and [persistence](../../../docs/HighLevel/persistence_contract.md) contracts, and [analysis/setup process](../../../docs/LowLevel/ProcessFlows/AnalysisAndSetup.md). Source inspection informed the assertions; execution evidence is recorded separately in [Analysis verification](../../../docs/JourneyImplementation.md#analysis-verification).

The three original IDs, players, opening, permissions and two copied engine assignments remain unchanged in owned data. Browser cases reset independently, use actual controls and inspect canonical UI saves. Controlled timers hold UCI output and the 350 ms playback intervals. The integration lane delivers obsolete subscribed callbacks and a retained stale component event; neither control is added to the production app or browser journey API.

The controlled subscription check also delivers A depth 19 and then B depth 8 independently, verifying that neither seat waits for or overwrites its neighbour. This covers differing update rates/depths at the store boundary; sustained real-engine progression remains in the separate runtime/platform scope.

Intent references: [interactive suggestions](../../../docs/questions/analysis/Q-ANALYSIS-003-SuggestionInteraction.md), [multi-engine recording](../../../docs/questions/engine/Q-ENGINE-001-ComparisonAndPersistence.md), and [temporary exploration decision](../../../docs/questions/analysis/Q-ANALYSIS-002-VariationRetention.md). The current context/preference matrix has explicit entry/exit controls and distinct Live, Analysis mode and Study controls headings. These cases exercise that established policy without adding a new interaction decision. Exploratory prefixes do not record analysis or advance the live node. Current seat persistence is kept distinct from actual-move archives; History owns recorded snapshot capture, and Save/session work retains its separate acceptance requirements. No dependent assertion is awaiting a design decision.

## JRN-ANALYSIS-01

SCN-ANALYSIS-01/02: AUTO-ON-MOVE, POSITION-CHANGED and independent output. Classification: aligned. After both engines stream, Refresh starts two pending searches; a real Nf3 supersedes them before their timers fire. Each engine produces three black-to-move PVs and its own evaluation. Playing the newly rendered B suggestion verifies its board, turn and saved history. Controlled integration separately delivers an obsolete subscribed update after position navigation and verifies that it is ignored, rather than relying only on cancellation of the scripted timer. This is deterministic UCI coverage, not real Stockfish strength or depth evidence.

## JRN-ANALYSIS-02

SCN-ANALYSIS-01/02: ENGINE-FOLDED and FOLD-ONE. Classification: aligned. Folding A leaves B visible, then Refresh and panel folding allow both pending searches to complete. A UI save proves their latest output exists while hidden. Reopening restores the latest output and retains A's independent fold state; the canonical tree/selection do not change. Presentation state never stops a search.

## JRN-ANALYSIS-03

SCN-ANALYSIS-01/02/04: LIVE-SCORE-ONLY. Classification: aligned. Independently reset live, in-game analysis and history contexts retain both evaluations/statuses with no PV buttons when assistance is score-only. The equivalent move-enabled context renders usable PV targets. This directly exercises the preference/context matrix requested by Q-ANALYSIS-003. It does not infer a new preference that overrides intentional analysis entry.

## JRN-ANALYSIS-04

SCN-ANALYSIS-04: APPLY-AS-BRANCH and analysis-only PAUSED boundary. Classification: aligned. Free, untimed in-game and timed in-game analysis each select prefixes of one and three moves. The first move appears immediately; a controlled 349 ms interval leaves the next uncommitted, and subsequent intervals apply only the selected prefix. Board/turn, exact stored moves, analysis node kinds, absent exploratory records, unchanged live anchor and clock are asserted. Exit returns to live without losing the inspected tree. Manual pause is separately tested in case 10; the existing History tranche owns history rewrite/no-takeback branching.

## JRN-ANALYSIS-05

SCN-ANALYSIS-04 live-play path. Classification: aligned; documentation clarified. Clicking B's fourth PV target submits only its first move, with one live node and correct board/turn after all possible playback intervals have elapsed. The scenario now states that first-move submission explicitly. The enabled live preference and visible Live controls distinguish this context from explicit exploration; no unsolicited confirmation flow is introduced.

## JRN-ANALYSIS-06

SCN-ANALYSIS-04: MOVE-STALE and playback ownership. Classification: aligned; documentation drift corrected. Integration retains a real three-move prefix, changes position by playing two moves, and delivers the old component event. Its first move remains legal but a later move is stale; the notice is visible and the complete canonical game remains unchanged. The browser selects a four-move prefix, switches games after its first move, advances all timers, then returns: only the original first move exists and the destination game remains unchanged. Stale handling asks the user to Refresh; it does not automatically refresh as the old scenario wording suggested.

## JRN-ANALYSIS-07

SCN-ANALYSIS-03/05: stop/restart success and removal. Classification: aligned; documentation clarified. Stop retains A's accepted PVs and marks it ready, while B continues. Refresh restarts A, removal leaves only B, and another Refresh produces current B output. Saved assignments, history and selection verify the result. A stopped seat restarts through Refresh; Retry is the failure-specific affordance. Unexpected process exits and transport cleanup permutations remain runtime/race coverage, not newly claimed browser crash tests.

## JRN-ANALYSIS-08

SCN-ANALYSIS-02/05: TOO-MANY, DUPLICATE and LIMIT. Classification: aligned; documentation drift corrected. Settings creates C/D/E with distinct names using supported transport paths. The selector excludes A/B, cancellation changes no assignments, four distinct copied seats stream independently, and Add is disabled at four despite an unassigned fifth working profile. Stopping C leaves the other three running; replacing D with E restores four. Integration rejects direct duplicate and fifth additions without mutating the roster or a different game, and checks copied option ownership. The committed four-seat rejection policy replaces speculative throttle/queue prose.

## JRN-ANALYSIS-09

SCN-ANALYSIS-01/02/03/05: ENGINE-NOT-RUNNING, PARTIAL-FAIL, RETRY-FAIL and START-FAIL. Classification: aligned. Adding the unavailable profile keeps its assignment and typed process-start error local to that row. Retry and Refresh remain recoverable, both working engines retain usable independent output, and removing the failed seat restores the original roster with unchanged board/history. Expectations use the platform error shown to users rather than the lower transport's internal message.

## JRN-ANALYSIS-10

SCN-ANALYSIS-01/02/04/05 paused branches. Classification: aligned. A custom timed live game starts two searches, pauses before output and receives both evaluations. All PV buttons and the board remain disabled. Stop, Refresh, add unavailable, Retry and removal remain available while the game stays paused. Saves before/after management compare complete tree, live/rendered paths and clock, with no clock/move progress during controlled elapsed time. Resume unlocks the surviving seat's suggestion. Board-edit management/start blocking is covered separately by case 11 and Setup.

## JRN-ANALYSIS-11

SCN-ANALYSIS-01/05 plus restore/settings contract and BOARD-EDIT. Classification: aligned. Four independent variants combine Resume after restore on/off with normal free analysis/board edit. The editor variants delete h2 through the normal board interaction before saving; this effective edit clears old PVs/history. Each changes settings through the UI, saves, reloads without reset, and compares copied assignments, tree, root, mode and selection. Eligible searches restart only with resume enabled; editing never starts them. Explicit Refresh or Finish editing starts output afterwards. Persisted cached lines with resume disabled are distinguished from an active process using its Stop/status affordance. Entering edit without changing a piece only stops searches and may retain cached lines; empty output is required after an effective edit rather than being imposed on that no-op entry path.

## JRN-ANALYSIS-12

SCN-ANALYSIS-01/02: POSITION-CHANGED and independent updates. Classification: aligned. Selecting an unevaluated root clears both old PVs/scores and shows no-principal-variation feedback while searches wait. Rapid e4/live/e4 navigation supersedes pending work; the selected e4 node receives only black-to-move PVs while the live path stays at e5 and no historical record is invented. Integration verifies that a delivered old callback cannot overwrite the new node's current seats, contribute after removal, or publish during board edit. Current computation and the separate Recorded analysis panel remain distinct.

The five owning flows and every branch were reviewed. Current labels now reflect the implemented UI. BR-ANALYSIS-01-PARSE-FAIL remains the UCI protocol suite's responsibility; these twelve groups introduce no malformed-output control. The history-only continuation branch remains in the History tranche. Progressive depth, unexpected process death, exact teardown counts and real workers keep their separate runtime/race/platform scope; these cases do not claim those unexecuted lanes.
