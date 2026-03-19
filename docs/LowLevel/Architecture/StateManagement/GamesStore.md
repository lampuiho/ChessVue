# StateManagement/GamesStore.md
# GamesStore Module (State Management)

## Purpose
Manage games, apply moves, and persist to storage.

## Data Interfaces
- IGame, NewGameOptions (from DataInterface/Game.md)
- IMove (from DataInterface/Move.md)

## Module Functions
- createGame(options: NewGameOptions): IGame
- loadGame(gameId: string): Promise<IGame | null>
- saveGame(game: IGame): Promise<void>
- deleteGame(gameId: string): Promise<void>
- makeMove(gameId: string, move: IMove): boolean
- enterAnalysisMode(gameId: string): void
- exitAnalysisMode(gameId: string): void
- enterFreeBoardSetupMode(gameId: string): void
- applyFreeBoardSetup(gameId: string, position: IChessboardState): IGame
- clearHistory(gameId: string): IGame
- startGameFromSetupPosition(gameId: string, options: Partial<NewGameOptions>): IGame
- switchPlayer(gameId: string, playerColour: playerColour, player: IPlayer): IGame
- takeBack(gameId: string, count: number): boolean
- getGameById(gameId: string): IGame | undefined
- listGames(): IGame[]
- replaceGame(game: IGame): void
- importGameFromFile(file: File): Promise<IGame>
- exportGameToFile(gameId: string, filename: string): Promise<void>
- requestMoveFromCurrentPlayer(gameId: string): Promise<IMove | null>

## Private Helpers
- persistGameList(): Promise<void>
- hydrateGame(game: IGame): IGame
- validateGameForMove(game: IGame, move: IMove): boolean
- updateClocksAfterMove(game: IGame, move: IMove): IGame
- applyResign(game: IGame, player: PlayerColor): IGame
- setAnalysisMode(game: IGame, enabled: boolean): IGame
- addMoveBranchInternal(game: IGame, move: IMove, parentNodeId: string): IGame
- setGameStatusInternal(game: IGame, status: GameStatus): IGame
- enterFreeBoardSetupModeInternal(game: IGame): IGame
- applySetupBoard(game: IGame, position: IChessboardState): IGame
- clearHistoryInternal(game: IGame): IGame
- switchPlayerTypeInternal(game: IGame, playerColour: PlayerColor, type: "human" | "remote" | "engine"): IGame
- isGameOver(game: IGame): boolean
- requestPlayerMove(game: IGame): Promise<IMove | null>
## Calls
- GameRuleService.isMoveLegal
- MoveUpdateService.addMoveToMainline
- MoveUpdateService.getCurrentPosition
- TimeControlService.updateClockAfterMove
- SerializationService.serializeGameToJSON
- SerializationService.deserializeGameFromJSON
- StorageAdapter.setItem
- StorageAdapter.getItem
