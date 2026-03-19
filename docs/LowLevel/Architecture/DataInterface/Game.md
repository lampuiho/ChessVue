# IGame / IPlayer / NewGameOptions

## Purpose
Define the game container, player profiles, and persistent game metadata.

## Interfaces
- `IGame`
- `IPlayer`
- `NewGameOptions`
- `GameStatus` (`"playing" | "paused" | "drawn" | "white_won" | "black_won" | "resigned" | "abandoned"`)

## Data Structures
- `interface IPlayer {
  id: string
  name: string
  type: "human" | "engine"
  color: "white" | "black"
  rating?: number
}

- `interface IGame {
  id: string
  createdAt: string
  updatedAt: string
  name: string
  status: GameStatus
  white: IPlayer
  black: IPlayer
  board: IChessboardState
  moveTree: IMoveTree
  clock: ClockState
  variant: "standard" | "chess960" | "kingOfTheHill" | "custom"
  metadata: Record<string, unknown>
}

- `interface NewGameOptions {
  name: string
  whitePlayer: IPlayer
  blackPlayer: IPlayer
  timeControl: ITimeControlConfig
  variant: "standard" | "chess960"
}
