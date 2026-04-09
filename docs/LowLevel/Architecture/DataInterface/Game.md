# Game Workspace Types

## Purpose
Define the canonical game model used by `GamesStore`, related services, and persisted saved-game payloads.

## Types
- `enum GameState`
- `enum ResultState`
- `enum ResultReason`
- `enum PlayerType`
- `enum PlayerActivityState`
- `enum DrawOfferDirection`

## Interfaces
- `interface IDrawOfferState`
- `interface IPlayerRuntime`
- `interface IPlayer`
- `interface IEnginePlayer`
- `interface ICapturedPieceGroup`
- `interface IGameMetadata`
- `interface ILiveAnalysisOptions`
- `interface IGameRuntime`
- `interface IGame`
- `interface ICreateGameRequest`
- `interface IStartGameFromSetupRequest`

## Data Structures
```ts
enum GameState {
  LiveWhiteTurn = "liveWhiteTurn",
  LiveBlackTurn = "liveBlackTurn",
  PausedWhiteTurn = "pausedWhiteTurn",
  PausedBlackTurn = "pausedBlackTurn",
  LiveAnalysisFromWhiteTurnWhiteMove = "liveAnalysisFromWhiteTurnWhiteMove",
  LiveAnalysisFromWhiteTurnBlackMove = "liveAnalysisFromWhiteTurnBlackMove",
  LiveAnalysisFromBlackTurnWhiteMove = "liveAnalysisFromBlackTurnWhiteMove",
  LiveAnalysisFromBlackTurnBlackMove = "liveAnalysisFromBlackTurnBlackMove",
  AnalysisWhiteMove = "analysisWhiteMove",
  AnalysisBlackMove = "analysisBlackMove",
  BoardEdit = "boardEdit",
  Checkmate = "checkmate"
}

enum ResultState {
  Ongoing = "ongoing",
  Drawn = "drawn",
  WhiteWon = "whiteWon",
  BlackWon = "blackWon",
  Abandoned = "abandoned"
}

enum ResultReason {
  RuleResolved = "ruleResolved",
  Timeout = "timeout",
  Resignation = "resignation",
  DrawAgreement = "drawAgreement",
  Abandoned = "abandoned"
}

enum PlayerType {
  Local = "local",
  Engine = "engine"
}

enum PlayerActivityState {
  Active = "active",
  NonActive = "nonActive"
}

enum DrawOfferDirection {
  Incoming = "incoming",
  Outgoing = "outgoing"
}

interface IDrawOfferState {
  offeringColour: PlayerColour
  respondingColour: PlayerColour
  direction: DrawOfferDirection
}

interface IPlayerRuntime {
  activityState: PlayerActivityState
}

interface IPlayer {
  colour: PlayerColour
  type: PlayerType
  displayName: string
  $?: IPlayerRuntime
}

interface IEnginePlayer extends IPlayer {
  type: PlayerType.Engine
  assignedEngine: IAssignedEngine
}

interface ICapturedPieceGroup {
  pieceKind: PieceKind
  count: number
}

interface IGameMetadata {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

interface ILiveAnalysisOptions {
  showLiveAnalysisMoves: boolean
}

interface IGameRuntime {}

interface IGame {
  schemaVersion: number
  metadata: IGameMetadata
  gameState: GameState
  resultState: ResultState
  resultReason: ResultReason | null
  drawOfferState: IDrawOfferState | null
  whitePlayer: IPlayer | null
  blackPlayer: IPlayer | null
  boardRoot: IBoardPosition
  moveTree: IMoveTree
  livePath: MovePath | null
  highlightPath: MovePath
  timeControl: ITimeControl
  clockSnapshot: IClockSnapshot
  liveAnalysisOptions: ILiveAnalysisOptions
  analysis: IGameAnalysis
  $?: IGameRuntime
}

interface ICreateGameRequest {
  name: string
  whitePlayerType: PlayerType | null
  blackPlayerType: PlayerType | null
  whiteEngineId: string | null
  blackEngineId: string | null
  analysisEngineIds: string[]
  showLiveAnalysisMoves: boolean
  timeControl: ITimeControl
  boardRoot?: IBoardPosition
}

interface IStartGameFromSetupRequest {
  name?: string
  whitePlayerType: PlayerType
  blackPlayerType: PlayerType
  whiteEngineId: string | null
  blackEngineId: string | null
  analysisEngineIds: string[]
  showLiveAnalysisMoves: boolean
  timeControl: ITimeControl
}
```

## Rules
- `GameState` is the single authoritative playable-state enum. It replaces separate workspace, interaction, clock, and turn-waiting axes.
- `GameState.LiveWhiteTurn` and `GameState.LiveBlackTurn` are the only normal live-play states.
- `GameState.PausedWhiteTurn` and `GameState.PausedBlackTurn` are timed live states paused by user or app flow.
- `GameState.LiveAnalysisFrom*` means the game still has a committed live turn anchor, but the visible board is exploring analysis moves instead of progressing the live node.
- `GameState.AnalysisWhiteMove` and `GameState.AnalysisBlackMove` are non-live analysis states used for free analysis/setup and for post-result analysis after non-checkmate terminal results.
- `GameState.BoardEdit` is a free-edit state only and is never combined with live play.
- `GameState.Checkmate` is the only board state that blocks further moves by state alone.
- `resultState` records the outcome only, while `resultReason` records why the game reached that outcome.
- Draw, resignation, timeout, and abandonment do not create an extra generic terminal state. They end live play and leave the game in one of the analysis states.
- Player seats persist copied in-game engine payloads rather than profile IDs, so open or restored games keep their original launch configuration until the user explicitly reassigns them.
- `IPlayer.type = engine` is the discriminator for treating the player as `IEnginePlayer`.
- `IEnginePlayer.assignedEngine` is the copied in-game engine payload for that seat.
- `IPlayer.$.activityState` is intentionally minimal. `active` means the seat can still participate normally, while `nonActive` covers unavailable engines, disconnected non-local players, or any other seat that has left normal participation.
- `$` is the runtime-only namespace. Anything under `$` is rebuilt in memory and is never persisted in the canonical saved-game payload.
- Turn ownership, move waiting, and move permissions are derived from `gameState`, not stored on `IPlayer`.
- Engine runtime details such as `processHandle`, availability, and last error live on `IEnginePlayer.assignedEngine.$`, not on `IPlayer.$`.
- `ICapturedPieceGroup` is a derived read model for player-strip captured-material display and is not persisted on `IGame`.
- The baseline persisted saved-game artefact reuses `IGame` directly; there is no separate persisted `IGameDocument` shape.
- `schemaVersion` is part of `IGame` so the same shape can satisfy both runtime coordination and persisted saved-game migration requirements.
- `livePath` and `highlightPath` are persisted selectors for exact restore. They identify nodes by child-index traversal from `moveTree.root` and are resolved into runtime references during hydration.
- `highlightPath` tracks the line currently highlighted in history and analysis. In normal live play it matches `livePath`, while in analysis or history navigation it may differ.
- `drawOfferState` is cleared when the draw is accepted, declined, or withdrawn, when another terminal result supersedes it, or when the game leaves live play for free analysis/setup.
- `liveAnalysisOptions.showLiveAnalysisMoves` is persisted as part of the game, defaults to `false` for new live games and setup-to-live transitions, and is not part of global settings or remembered UI layout state.
- `analysis.snapshots` is persisted and restored as part of the game, and its current row order is the source of truth for mapping remembered engine-group fold state by index.
- `IGame` is the game-facing object used by mutation flows. IDs remain on `metadata.id` for routing, persistence, and lookup.
