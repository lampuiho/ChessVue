# GamesStore

## Purpose
Own live game workspaces and coordinate game-state mutations across domain logic, persistence, and engine/runtime stores.

## Public Interface
```ts
createGame(request: ICreateGameRequest): Promise<IGameWorkspace>
insertGame(document: IGameDocument): Promise<IGameWorkspace>
deleteGame(gameId: string): Promise<void>
getGame(gameId: string): IGameWorkspace | null
listGames(): IGameWorkspace[]
makeMove(gameId: string, move: IMove): Promise<void>
navigateToNode(gameId: string, nodeId: string): void
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
- create live games or free-analysis workspaces from setup input
- enforce allowed actions from the state axes and settings policies
- coordinate legal move application, move-tree updates, and clock changes
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
- `SCN-GAME-01` to `SCN-GAME-03`
- `SCN-MOVE-01` to `SCN-MOVE-03`
- `SCN-HIST-01` to `SCN-HIST-04`
- `SCN-FREE-ANALYSIS-01` to `SCN-FREE-ANALYSIS-03`
- `SCN-ANALYSIS-01`
- `SCN-CTRL-01` to `SCN-CTRL-05`
- `SCN-SAVE-01` to `SCN-LOAD-02`
- `SCN-LIFECYCLE-01` and `SCN-LIFECYCLE-02`
