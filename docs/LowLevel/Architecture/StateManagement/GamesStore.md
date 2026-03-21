# GamesStore

## Purpose
Own live game workspaces and coordinate game-state mutations across domain logic, persistence, and engine/runtime stores.

## Public Interface
```ts
restorePersistedGames(gameIds?: string[]): Promise<IGameWorkspace[]>
createGame(request: ICreateGameRequest): Promise<IGameWorkspace>
startGameFromSetup(gameId: string, request: IStartGameFromSetupRequest): Promise<void>
insertGame(document: IGameDocument): Promise<IGameWorkspace>
deleteGame(gameId: string): Promise<void>
getGame(gameId: string): IGameWorkspace | null
listGames(): IGameWorkspace[]
makeMove(gameId: string, move: IMove): Promise<void>
takeBack(gameId: string, moveCount?: number): Promise<void>
navigateToNode(gameId: string, nodeId: string): void
syncClock(gameId: string, nowUtc: string): Promise<void>
pauseGame(gameId: string, reason: "manual" | "menu" | "analysis"): Promise<void>
resumeGame(gameId: string, reason: "manual" | "menu" | "analysis"): Promise<void>
enterInGameAnalysis(gameId: string): Promise<void>
exitInGameAnalysis(gameId: string): void
enterBoardEdit(gameId: string): void
confirmBoardEdit(gameId: string, boardRoot: IBoardPosition): Promise<void>
cancelBoardEdit(gameId: string): void
resignGame(gameId: string, colour: PlayerColour): Promise<void>
offerDraw(gameId: string): Promise<void>
pruneFuture(gameId: string, nodeId: string): Promise<void>
saveGame(gameId: string): Promise<void>
exportGame(gameId: string): Promise<void>
importGame(): Promise<IGameWorkspace>
```

## Responsibilities
- restore persisted game documents into live workspaces during startup or session recovery
- create live games or free-analysis workspaces from setup input
- transition a prepared setup workspace into a live game without losing its prepared root or move tree
- enforce allowed actions from the state axes and settings policies
- coordinate legal move application, move-tree updates, and clock changes
- reconcile live clocks on timer ticks or focus return so timeout finalisation stays inside the store boundary
- coordinate pause and resume flows for manual controls, menu interruptions, and analysis-mode entry
- build the canonical game document and exact-screen snapshot for autosave and export
- trigger analysis refreshes when the visible or live position changes

## Dependencies
- `GameRuleService`
- `MoveUpdateService`
- `TimeControlService`
- `SerializationService`
- `StorageAdapter`
- `FileIoAdapter`
- `AnalysisStore`
- `EnginesStore`

## Scenario Coverage
- `SCN-SESSION-02`
- `SCN-GAME-01` to `SCN-GAME-03`
- `SCN-MOVE-01` to `SCN-MOVE-03`
- `SCN-HIST-01` to `SCN-HIST-04`
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01`
- `SCN-TIME-01` to `SCN-TIME-05`
- `SCN-CTRL-01` to `SCN-CTRL-05`
- `SCN-SAVE-01` to `SCN-LOAD-02`
- `SCN-LIFECYCLE-01` and `SCN-LIFECYCLE-02`

## Notes
- The public interface is intentionally broad enough to cover every committed game-facing mutation without leaking domain-service calls into presentation code.
