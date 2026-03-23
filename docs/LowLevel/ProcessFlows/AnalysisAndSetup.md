# Analysis And Setup Flows

## Scope
This document covers `SCN-FREE-ANALYSIS-01` to `SCN-ANALYSIS-05`.

## Free Analysis / Setup

### SCN-FREE-ANALYSIS-01 - Enter Free Analysis / Setup Context
- Public flow: `GamesStore.createGame` or `GamesStore.reassignPlayer` -> `GamesStore.makeMove` -> conditional `EnginesStore.startAnalysis`.
- Private design: `GamesStore._resolveWorkspaceKind` -> `_createWorkspace` or `_switchWorkspaceToFreeAnalysisSetup` -> `_allowBothColoursForSetupMoves`; post-move refresh uses `_refreshVisibleAnalysis`.
- Requirement verification: `Pass`. A creation request with an unassigned side or a live-game reassignment to `none` yields a non-live workspace while preserving engine-driven analysis when configured.

### SCN-FREE-ANALYSIS-02 - Board Editing in Free Analysis / Setup
- Public flow: `GamesStore.enterBoardEdit` -> `EnginesStore.stopAnalysis` for the workspace if analysis is active -> `GamesStore.confirmBoardEdit` or `GamesStore.cancelBoardEdit`; confirm uses `MoveUpdateService.replaceBoardRoot` and `AnalysisStore.clearGameAnalysis`, then conditional `EnginesStore.startAnalysis`.
- Private design: `GamesStore._assertBoardEditAllowed` -> `_snapshotPreEditState` -> `_suspendAnalysisForBoardEdit`; confirm uses `_confirmHistoryClearIfNeeded` -> `_replaceWorkspaceRoot` -> `_refreshVisibleAnalysis`; cancel uses `_restorePreEditState` -> `_resumeAnalysisAfterBoardEditIfNeeded`.
- UI surface coverage: free-analysis board editing reuses `PiecePalette` as the piece-choice surface and keeps that surface close to the active board-edit controls instead of treating it as a sidebar panel.
- State coverage: `boardEdit` is valid only inside `freeAnalysisSetup`. While active, engine analysis is suspended and `EnginesStore.startAnalysis` is blocked for that workspace. Analysis may resume only after confirm or cancel returns the workspace to a non-`boardEdit` context.
- Requirement verification: `Pass`. The public surface covers edit entry, confirm, cancel, history clearing, analysis suspension during edit, and analysis refresh afterwards.

### SCN-FREE-ANALYSIS-03 - Start a Real Game from Free Analysis / Setup
- Public flow: `UiStateStore.showModal({ kind: "startGameFromSetup" })` -> `GamesStore.startGameFromSetup` -> conditional `EnginesStore.startAnalysis` -> conditional `GamesStore._maybeRequestEngineTurn` -> `UiStateStore.hideModal`.
- Private design: `GamesStore._validateSetupTransition` -> `_validateAssignedPlayers` -> `_validateAssignedEngines` -> `_retainPreparedMoveTree` -> `_initialiseLiveClock` -> `_switchWorkspaceKindToLiveGame`.
- State/settings coverage: the workspace may leave `freeAnalysisSetup` and enter `liveGame + currentPosition + ongoing` only when both sides are assigned. That transition applies a newly chosen time control and fresh live clock state. After the transition, `_maybeRequestEngineTurn` runs whenever the resulting live side to move is engine-controlled, including `engine/engine`.
- Requirement verification: `Pass`. Starting from setup preserves the prepared root and move tree while moving the workspace into live-game rules, and engine-controlled turns continue through the normal live-game gate.

## Analysis And Engine Runtime

### SCN-ANALYSIS-01 - Start Single Engine Analysis
- Public flow: `EnginesStore.startAnalysis` -> `EnginesStore.ensureAnalysisSessions` -> `EngineClient.startSession` -> `AnalysisStore.beginAnalysisStream` -> `EngineClient.syncPosition` -> `EngineClient.startAnalysis` -> `EngineClient.subscribeToAnalysis` -> `AnalysisStore.applyAnalysisUpdate`.
- Private design: `EnginesStore._startAnalysisSessions` -> `_bindAnalysisCallbacks` -> `_forwardAnalysisUpdate`; `AnalysisStore` only marks the stream active and merges updates.
- UI surface coverage: one engine group may show up to `3` visible lines, and folding that engine group hides its rendered lines without stopping the underlying engine session or update stream.
- State gate: `EnginesStore.startAnalysis` accepts `liveGame` and `freeAnalysisSetup` workspaces in `currentPosition`, `historyReview`, and `inGameAnalysis`. It remains valid for paused live games and finished-game review because analysis does not advance the live state. It is blocked while `interactionContext = boardEdit`.
- Requirement verification: `Pass`. Engine startup, streaming updates, ready/registration callbacks, and position supersession are owned by the engine runtime boundary rather than the view.

Example concrete session calls:

```ts
await engineClient.startSession(session, engine)
analysisStore.beginAnalysisStream(gameId, session.engineId, positionState.currentPosition)
await engineClient.syncPosition(session.sessionId, positionState)
await engineClient.startAnalysis(session.sessionId, {
  multiPv: 3,
  searchMode: "infinite",
})
```

Example typed update handled by `AnalysisStore.applyAnalysisUpdate`:

```ts
{
  position: positionState.currentPosition,
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
async function startAnalysis(gameId: string, engineIds: string[], positionState: IEnginePositionState): Promise<void> {
  const targetEngineIds = engineIds ?? _getDefaultAnalysisEngineIds(gameId)
  const sessions = await ensureAnalysisSessions(gameId, targetEngineIds, positionState)

  for (const session of sessions) {
    await engineClient.startSession(session, _getEngine(session.engineId))
    analysisStore.beginAnalysisStream(gameId, session.engineId, positionState.currentPosition)

    _trackSubscription(
      session.sessionId,
      engineClient.subscribeToAnalysis(session.sessionId, (update) => {
        analysisStore.applyAnalysisUpdate(gameId, session.engineId, update)
      }),
    )

    _trackSessionEvents(
      session.sessionId,
      engineClient.subscribeToSessionEvents(session.sessionId, (event) => {
        _handleEngineSessionEvent(gameId, session.engineId, event)
      }),
    )

    await engineClient.stopAnalysis(session.sessionId)
    await engineClient.syncPosition(session.sessionId, positionState)
    await engineClient.startAnalysis(session.sessionId, {
      multiPv: _resolveMultiPv(session),
      searchMode: "infinite",
    })
  }
}
```

For the baseline UCI implementation, `EngineClient` internally sends `uci`, waits for `id` / `option` / `uciok`, then sends `isready` and waits for `readyok`. It only emits a new-game boundary internally when the search switches to a different game or an unrelated branch. When the user simply continues forward on the same line, the client reuses the current game context and synchronises the move path instead of forcing a full reset.

### SCN-ANALYSIS-02 - Multi-Engine Concurrent Analysis
- Public flow: `EnginesStore.startAnalysis` -> `EnginesStore.validateAnalysisSelection` -> `EnginesStore.ensureAnalysisSessions`.
- Private design: `EnginesStore._assertAnalysisSelectionLimit` -> `_buildSessionPerEngine`; each session runs `EngineClient.syncPosition` and `EngineClient.startAnalysis` independently; `AnalysisStore._mergeEngineSnapshot` keeps each engine row independent.
- UI surface coverage: the panel renders one independently foldable engine group per selected engine, with up to `3` visible lines per engine group while background updates continue even when one group is folded.
- Requirement verification: `Pass`. The four-engine cap is enforced before processes start, and partial failure does not block healthy engines.

### SCN-ANALYSIS-03 - Engine Crash/Stop During Analysis
- Public flow: `EnginesStore.stopAnalysis` or `EnginesStore.retryAnalysis` -> `EngineClient.stopAnalysis` or `EngineClient.restartSession` -> `AnalysisStore.markAnalysisUnavailable` or `AnalysisStore.beginAnalysisStream`.
- Private design: `EnginesStore._stopMatchingSessions` -> `_markEngineUnavailableInAnalysisStore`; retry uses `_restartSingleEngine` -> `_bindAnalysisCallbacks`.
- Requirement verification: `Pass`. Stop, crash, and retry behaviour is explicit at the runtime-owner boundary and preserves last-known visible output.

### SCN-ANALYSIS-04 - Click Suggested Line to Inspect Move
- Public flow: `AnalysisPanel.lineSelected` -> `GamesStore.getGame` -> `GameRuleService.isMoveLegal` -> `GamesStore.makeMove`.
- Private design: `GamesStore._applySelectedAnalysisLine` -> `_createOrReuseAnalysisBranch` -> `_refreshVisibleAnalysis`; optional branch retention uses `_honourAnalysisBranchPolicy`.
- Requirement verification: `Pass`. Suggested lines become interactive without bypassing legality checks or corrupting the live node.

### SCN-ANALYSIS-05 - Add or Remove Per-Game Analysis Engine During Game
- Public flow: add uses `AnalysisPanel.analysisEngineAddRequested` -> `UiStateStore.showModal({ kind: "analysisEngineSelection" })` -> `GamesStore.addAnalysisEngine`; remove uses `AnalysisPanel.analysisEngineRemoveRequested` -> `GamesStore.removeAnalysisEngine`.
- Private design: add uses `GamesStore._assertAnalysisRosterMutable` -> `_mutateAnalysisEngineRoster("add")` -> `EnginesStore.validateAnalysisSelection` -> `_persistWorkspaceIfNeeded` -> conditional `_refreshVisibleAnalysis`; remove uses `_mutateAnalysisEngineRoster("remove")` -> `EnginesStore.stopEngine(gameId, engineId, "analysis")` -> `AnalysisStore.clearEngineAnalysis(gameId, engineId)` -> `_persistWorkspaceIfNeeded`.
- UI surface coverage: the analysis panel title owns the right-aligned `+` affordance for adding an engine to the current game, while each engine title row owns a right-aligned `-` affordance for removing that engine so assignment is not one-way.
- State gate: roster add and remove are valid for `liveGame` and `freeAnalysisSetup` workspaces in `currentPosition`, `historyReview`, and `inGameAnalysis`. Adding an engine while `interactionContext = boardEdit` may update the stored roster, but `EnginesStore.startAnalysis` remains blocked until board editing ends.
- Requirement verification: `Pass`. Analysis-engine assignment stays per game, add and remove are both covered, and runtime start or stop remains delegated to the engine store.



