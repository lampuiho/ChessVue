# Analysis And Setup Flows

## Scope
This document covers `SCN-FREE-ANALYSIS-01` to `SCN-ANALYSIS-04`.

## Free Analysis / Setup

### SCN-FREE-ANALYSIS-01 - Enter Free Analysis / Setup Context
- Public flow: `GamesStore.createGame` -> `GamesStore.makeMove` -> conditional `AnalysisStore.refreshAnalysis`.
- Private design: `GamesStore._resolveWorkspaceKind` -> `_createWorkspace` -> `_allowBothColoursForSetupMoves`; post-move refresh uses `_refreshVisibleAnalysis`.
- Requirement verification: `Pass`. A no-player creation request yields a non-live workspace while preserving engine-driven analysis when configured.

### SCN-FREE-ANALYSIS-02 - Board Editing in Free Analysis / Setup
- Public flow: `GamesStore.enterBoardEdit` -> `GamesStore.confirmBoardEdit` or `GamesStore.cancelBoardEdit`; confirm uses `MoveUpdateService.replaceBoardRoot` and `AnalysisStore.clearGameAnalysis`.
- Private design: `GamesStore._assertBoardEditAllowed` -> `_snapshotPreEditState`; confirm uses `_confirmHistoryClearIfNeeded` -> `_replaceWorkspaceRoot` -> `_refreshVisibleAnalysis`; cancel uses `_restorePreEditState`.
- Requirement verification: `Pass`. The public surface covers edit entry, confirm, cancel, history clearing, and analysis refresh.

### SCN-FREE-ANALYSIS-03 - Start a Real Game from Free Analysis / Setup
- Public flow: `UiStateStore.showModal("startGameFromSetup")` -> `GamesStore.startGameFromSetup` -> `UiStateStore.hideModal`.
- Private design: `GamesStore._validateSetupTransition` -> `_validateAssignedEngines` -> `_retainPreparedMoveTree` -> `_initialiseLiveClock` -> `_switchWorkspaceKindToLiveGame`.
- Requirement verification: `Pass`. Starting from setup preserves the prepared root and move tree while moving the workspace into live-game rules.

## Analysis And Engine Runtime

### SCN-ANALYSIS-01 - Start Single Engine Analysis
- Public flow: `AnalysisStore.refreshAnalysis` -> `EnginesStore.ensureAnalysisSessions` -> `EngineClient.startSession` -> `EngineClient.setPosition` -> `EngineClient.startAnalysis` -> `EngineClient.subscribeToAnalysis` -> `AnalysisStore.storeEngineUpdate`.
- Private design: `AnalysisStore._ensureSessionsForPosition` -> `_ensureAnalysisSubscription` -> `_dispatchAnalysisRequest` -> `_mergeEngineSnapshot`.
- Requirement verification: `Pass`. Engine startup, streaming updates, and position supersession are owned by the engine runtime boundary rather than the view.

Example concrete session calls:

```ts
await engineClient.startSession(session, engine)
await engineClient.setPosition(session.sessionId, position)
await engineClient.startAnalysis(session.sessionId, {
  multiPv: 3,
  searchMode: "infinite",
})
```

Example typed update handled by `AnalysisStore.storeEngineUpdate`:

```ts
{
  position,
  bestMove: moveE2E4,
  lines: [
    {
      depth: 18,
      scoreCp: 35,
      scoreMate: null,
      pv: [moveE2E4, moveC7C5, moveG1F3],
    },
  ],
  isFinal: false,
}
```

Example implementation shape:

```ts
async function refreshAnalysis(gameId: string, position: IBoardPosition, engineIds?: string[]): Promise<void> {
  const targetEngineIds = engineIds ?? _getDefaultAnalysisEngineIds(gameId)
  const sessions = await enginesStore.ensureAnalysisSessions(gameId, targetEngineIds, position)

  for (const session of sessions) {
    await engineClient.startSession(session, _getEngine(session.engineId))
    const unsubscribe = engineClient.subscribeToAnalysis(session.sessionId, (update) => {
      analysisStore.storeEngineUpdate(gameId, session.engineId, update)
    })

    _trackSubscription(session.sessionId, unsubscribe)
    await engineClient.stopAnalysis(session.sessionId)
    await engineClient.setPosition(session.sessionId, position)
    await engineClient.startAnalysis(session.sessionId, {
      multiPv: _resolveMultiPv(session),
      searchMode: "infinite",
    })
  }
}
```

For the baseline UCI implementation, `EngineClient` translates `IBoardPosition` and `IMove` values into protocol messages internally, but the rest of the architecture does not depend on those strings.

### SCN-ANALYSIS-02 - Multi-Engine Concurrent Analysis
- Public flow: `AnalysisStore.refreshAnalysis(..., engineIds)` -> `EnginesStore.validateAnalysisSelection` -> `EnginesStore.ensureAnalysisSessions`.
- Private design: `EnginesStore._assertAnalysisSelectionLimit` -> `_buildSessionPerEngine`; each session runs `EngineClient.setPosition` and `EngineClient.startAnalysis` independently; `AnalysisStore._mergeEngineSnapshot` keeps each engine row independent.
- Requirement verification: `Pass`. The four-engine cap is enforced before processes start, and partial failure does not block healthy engines.

### SCN-ANALYSIS-03 - Engine Crash/Stop During Analysis
- Public flow: `AnalysisStore.stopAnalysis` or `AnalysisStore.retryEngine` -> `EnginesStore.stopEngine` or `EnginesStore.restartSession` -> `EngineClient.stopAnalysis` or `EngineClient.restartSession`.
- Private design: `AnalysisStore._markEngineUnavailable` -> `_retainLastVisibleSnapshot`; retry uses `_restartSingleEngine` -> `_resubscribeSessionOutput`.
- Requirement verification: `Pass`. Stop, crash, and retry behaviour is explicit at the public API level and preserves last-known visible output.

### SCN-ANALYSIS-04 - Click Suggested Line to Inspect Move
- Public flow: `AnalysisPanel.lineSelected` -> `GamesStore.getGame` -> `GameRuleService.isMoveLegal` -> `GamesStore.makeMove`.
- Private design: `GamesStore._applySelectedAnalysisLine` -> `_createOrReuseAnalysisBranch` -> `_refreshVisibleAnalysis`; optional branch retention uses `_honourAnalysisBranchPolicy`.
- Requirement verification: `Pass`. Suggested lines become interactive without bypassing legality checks or corrupting the live node.
