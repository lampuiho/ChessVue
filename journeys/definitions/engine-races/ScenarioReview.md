# Pending engine work review

Reviewed on 19 October 2026 against source revision `c022dc1` before this tranche and `docs/HighLevel/scenarios.md`, `engine_runtime.md`, `LowLevel/ProcessFlows/EngineRuntimeOwnership.md`, the game state actions, shared UCI client and EngineRuntimeService. The settled safety expectations are one live move per turn, independent rendered analysis, explicit pause ownership, cancellation on ownership/result changes and bounded runtime cleanup. [Q-PLAY-001](../../../docs/questions/play/Q-PLAY-001-LiveProgressDuringAnalysis.md) remains a review prompt; this tranche preserves the documented progression matrix.

The owned seed has a paused 60+2 Black engine turn after e4 and two independent free-analysis games, each with copied A/B seats. `incoming-draw` restores an existing incoming offer to exercise acceptance while a reply is pending; the scripted UCI adapter does not invent draw negotiation. Reset reloads the original namespace and clears transient faults/barriers. The journey-only controller emits UCI records, controls scripted process failure and exposes search/listener diagnostics. It cannot mutate application games or launch a real executable.

## JRN-RACE-01

Intent: SCN-TIME-02/05, including BR-TIME-05-ENGINE-READY-WHILE-AWAY and ALREADY-PAUSED. A held reply finishes under Manual, Menu or both owners. No live move/increment occurs while paused; removing the final owner commits one move and one increment without another engine search. Classification: aligned with the engine runtime contract. The independent browser variants assert preserved history/clock and the exact number of searches.

## JRN-RACE-02

Intent: SCN-CTRL-04 and TIME-02, including LATEST-NODE-VARIATION. Explicit analysis freezes the live turn while both colours explore. Output released on that branch remains deferred; output released after exit targets the original live parent. Both orders commit once after return and retain the existing temporary-variation pruning policy. Classification: aligned; no live-background scheduling policy is added.

## JRN-RACE-03

Intent: SCN-ENGINE-03, BR-ENGINE-03-TURN-IN-FLIGHT. Replacement with Local, Journey B or Unassigned cancels the captured request, closes the old process and removes its listeners. Late raw bestmove cannot move the replacement; the new local/engine/analysis flow still works, and another game's source save is preserved. Classification: aligned.

## JRN-RACE-04

Intent: SCN-TIME-04 and CTRL-02/03, including already-ended and non-local incoming-offer resolution. Timeout, confirmed resignation and incoming draw acceptance clear the pending turn. Releasing its valid reply afterwards preserves result, live path, move tree and stopped clocks. Classification: aligned for the implemented acceptance path. SCN-CTRL-03 retains its broader Planned label because adapter-delivered offers/response callbacks remain unavailable; this case restores an incoming offer and exercises acceptance without claiming that missing transport feature.

## JRN-RACE-05

Intent: SCN-ANALYSIS-01/02, POSITION-CHANGED and DESYNC. Two rapid rendered moves invalidate old subscribers before the client drains stop acknowledgements. B's old result drains and its new search updates while A is still blocked; A then drains and updates the same current node. Another game retains its distinct depth-41/score-77 output while the foreground seats finish at depth 12. Classification: aligned. UCI records have no search IDs: the barrier deliberately releases old info before its terminating bestmove, while the real client is stopping. It does not pretend that arbitrarily reordered raw output after a completed UCI boundary can be attributed to a prior search.

## JRN-RACE-06

Intent: SCN-ANALYSIS-02/03/05, PARTIAL-FAIL, RETRY-SUCCESS and RETRY-FAIL. A real scripted process exit is detected at the next explicit operation, matching the current contract. Manual Retry respawns successfully; a second crash plus three scoped start failures leaves retry/remove available while B continues streaming. Removing and adding A recovers normally. Classification: aligned; automatic reconnect remains outside the baseline.

## JRN-RACE-07

Intent: SCN-ANALYSIS-01/02, PARSE-FAIL and DESYNC. Malformed syntax, an illegal first move, an illegal continuation and a non-displayed illegal rank cannot replace accepted data. Later valid A/B lines advance to different depths and scores independently, preserving other PVs and the game tree. Classification: aligned with parser rejection and runtime legality/rollback ownership.

## JRN-RACE-08

Intent: SCN-ANALYSIS-03/05 and the engine runtime cleanup contract. Stop retains the last accepted lines and ignores stale info during/after acknowledgement. Removal closes the pending process and detaches listeners before late info/bestmove are injected. The mounted integration additionally disposes a runtime blocked inside client stop while replacement startup is queued, checks settled work, cleared callback/handle and no late mutation, then verifies explicit recovery. Classification: aligned. Ponder hit/miss protocol ordering remains in the existing browser/desktop UCI integration suites.

The transport refactor also corrects the journey emitter's once-listener removal: cancellation now removes the original callback without leaving its wrapper attached. This is harness cleanup, not a change to production engine policy. Executed evidence and any defects found during verification are recorded in [JourneyImplementation](../../../docs/JourneyImplementation.md).
