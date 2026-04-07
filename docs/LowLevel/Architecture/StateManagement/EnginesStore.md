# EnginesStore

## Purpose
Own configured engine-session state, runtime availability, and engine intent boundaries for analysis and engine-controlled turns.

## Public Interface
```ts
listConfiguredEngines(): IEngineRecord[]
getEngine(engineId: string): IEngineRecord | null
validateAnalysisSelection(engineIds: string[]): void
ensureAnalysisSessions(gameId: string, assignedEngines: IAssignedEngine[], positionState: IEnginePositionState): Promise<IEngineRuntimeSession[]>
startAnalysis(gameId: string, assignedEngines: IAssignedEngine[], positionState: IEnginePositionState): Promise<void>
retryAnalysis(gameId: string, assignedEngineId: string, positionState: IEnginePositionState): Promise<void>
stopAnalysis(gameId: string, assignedEngineId?: string): Promise<void>
createPlayerSession(gameId: string, colour: PlayerColour, assignedEngine: IAssignedEngine, positionState: IEnginePositionState): Promise<IEngineRuntimeSession>
startPlayerTurn(gameId: string, colour: PlayerColour, assignedEngine: IAssignedEngine, positionState: IEnginePositionState): Promise<void>
restartSession(sessionId: string): Promise<void>
stopEngine(gameId: string, assignedEngineId: string, role?: EngineRole): Promise<void>
stopGameSessions(gameId: string): Promise<void>
removeSessionsForEngine(assignedEngineId: string): Promise<void>
```

## Responsibilities
- read configured engine profiles when creating or validating assigned engine participants
- enforce the four-engine analysis cap
- keep sessions isolated by game and role
- mark unavailable or failed engines without stopping unrelated sessions
- preserve assigned player-engine and analysis-engine identity for the lifetime of that assignment unless the user explicitly unseats and reseats the engine
- build runtime sessions from the game's captured assigned-engine snapshots rather than reading launch configuration from mutable profile records at start time
- expose concrete runtime sessions without leaking protocol-specific command composition
- own all analysis start, retry, and stop orchestration through the layer-2 engine runtime path
- retain enough position-state context for the lower-layer engine client to reuse the same game line instead of forcing a new-game reset on every search
- distinguish continuous analysis searches from turn-scoped player-engine move generation
- surface typed analysis callbacks to the caller-owned flow that updates `AnalysisStore`

## Runtime Gating Notes
- `startAnalysis` supports `WorkspaceKind.LiveGame`, `InteractionContext.HistoryReview`, `InteractionContext.InGameAnalysis`, `WorkspaceKind.FreeAnalysisSetup`, paused live review, and finished-game review because analysis is read-only with respect to live progression.
- `startAnalysis` is blocked when the workspace is actively in `InteractionContext.BoardEdit`.
- `startPlayerTurn` is a strict preconditioned call for `WorkspaceKind.LiveGame + InteractionContext.CurrentPosition + ResultState.Ongoing + not paused` only. It must reject or no-op for `WorkspaceKind.FreeAnalysisSetup`, `InteractionContext.HistoryReview`, `InteractionContext.InGameAnalysis`, `InteractionContext.BoardEdit`, paused games, expired clocks, and final result states.
- `startPlayerTurn` does not distinguish `local/engine` from `engine/engine`; it only checks the live-state gate and the side-to-move assignment.
- Analysis-runtime restart after restore follows the caller's `analysis.resumeLiveAnalysisAfterRestore` decision; `EnginesStore` does not override that policy.
- Engine-profile editing is owned by `SettingsStore`; already assigned games keep their captured engine snapshots until the user explicitly reassigns them.
- If player reassignment removes engine control from a side or changes that side to another engine profile, the obsolete player-engine runtime intent is cleared and a new runtime is created only if the reassigned seat is engine-controlled in the restarted live game.
- When `GamesStore` changes a game's analysis-engine roster, `EnginesStore` starts or stops only the affected game-role sessions. Other games and roles are untouched.

## Dependencies
- `MoveNotationService`
- `PositionIdentityService`

## Scenario Coverage
- `SCN-GAME-02`
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01` to `SCN-ANALYSIS-04`
- `SCN-ANALYSIS-05`
- `SCN-LOAD-01`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`
- `SCN-ENGINE-03`

## Notes
- `EnginesStore` consumes layer-2 engine runtime boundaries only. It does not resolve `ProcessManager` or `EngineClient` directly.
- Protocol-specific command text, FEN or UCI mapping, and child-process transport remain below layer 3.
- Visible analysis snapshots are owned by `AnalysisStore`, not by `EnginesStore`.
- Continuous analysis callbacks originate from runtime sessions owned by `EnginesStore`, but caller-owned handlers update `AnalysisStore`.
- Flow docs continue to show `EnginesStore._startAnalysisSessions` and `EnginesStore._startPlayerTurnSearch` as the visible owner-private boundaries. If they share contract-aware engine-position mapping, that implementation is documented under `EnginePositionMappingUtility` in [UtilityIndex.md](../UtilityIndex.md).
