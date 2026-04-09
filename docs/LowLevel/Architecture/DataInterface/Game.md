# Game Workspace Types

## Purpose
Define the canonical workspace model used by `GamesStore`, related services, and persisted saved-game payloads.

## Types
- `enum WorkspaceKind`
- `enum InteractionContext`
- `enum ClockStateKind`
- `enum ResultState`
- `enum ResultReason`
- `enum PlayerType`
- `enum DrawOfferDirection`

## Interfaces
- `interface IDrawOfferState`
- `enum PlayerActivityState`
- `interface IPlayer`
- `interface IGameTurnState`
- `interface ICapturedPieceGroup`
- `interface IGameMetadata`
- `interface ILiveAnalysisOptions`
- `interface IGame`
- `interface ICreateGameRequest`
- `interface IStartGameFromSetupRequest`

## Data Structures
```ts
enum WorkspaceKind {
  LiveGame = "liveGame",
  FreeAnalysisSetup = "freeAnalysisSetup"
}

enum InteractionContext {
  CurrentPosition = "currentPosition",
  HistoryReview = "historyReview",
  InGameAnalysis = "inGameAnalysis",
  BoardEdit = "boardEdit"
}

enum ClockStateKind {
  None = "none",
  Running = "running",
  Paused = "paused",
  Expired = "expired"
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

interface IPlayer {
  colour: PlayerColour
  type: PlayerType
  displayName: string
  activityState: PlayerActivityState
  assignedEngine: IAssignedEngine | null
}

interface IGameTurnState {
  activeColour: PlayerColour | null
  isAwaitingMove: boolean
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

interface IGame {
  schemaVersion: number
  metadata: IGameMetadata
  workspaceKind: WorkspaceKind
  interactionContext: InteractionContext
  clockState: ClockStateKind
  resultState: ResultState
  resultReason: ResultReason | null
  drawOfferState: IDrawOfferState | null
  whitePlayer: IPlayer | null
  blackPlayer: IPlayer | null
  turnState: IGameTurnState
  boardRoot: IBoardPosition
  moveTree: IMoveTree
  livePath: MovePath | null
  visiblePath: MovePath
  timeControl: ITimeControl
  clockSnapshot: IClockSnapshot
  liveAnalysisOptions: ILiveAnalysisOptions
  analysisAssignment: IAnalysisAssignment
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
- `WorkspaceKind.FreeAnalysisSetup` is created when either side is assigned no player.
- `visiblePath` may differ from `livePath` during history review or analysis.
- `InteractionContext.BoardEdit` is valid only inside `WorkspaceKind.FreeAnalysisSetup`.
- `resultState` records the outcome only, while `resultReason` records why the game reached that outcome.
- `drawOfferState` records one unresolved draw offer for the current live workspace and is persisted with the workspace so non-local pending-offer UI can be restored accurately for both incoming and outgoing offers.
- Player seats and analysis assignment persist captured assigned-engine snapshots rather than profile IDs, so open or restored games keep their original launch configuration until the user explicitly reassigns them.
- `IPlayer.activityState` is intentionally minimal. `active` means the seat can still participate normally, while `nonActive` covers unavailable engines, disconnected non-local players, or any other seat that has left normal participation.
- Turn ownership and move-waiting state belong to `IGame.turnState`, not to `IPlayer`.
- `ICapturedPieceGroup` is a derived read model for player-strip captured-material display and is not persisted on `IGame`.
- The baseline persisted saved-game artefact reuses `IGame` directly; there is no separate persisted `IGameDocument` shape.
- `schemaVersion` is part of `IGame` so the same shape can satisfy both runtime coordination and persisted saved-game migration requirements.
- `livePath` and `visiblePath` are minimal persisted selectors for exact restore. They identify nodes by child-index traversal from `moveTree.root` and are resolved into runtime references during hydration.
- `drawOfferState` is cleared when the draw is accepted, declined, or withdrawn, when another terminal result supersedes it, or when the workspace leaves live-game progression for setup.
- `liveAnalysisOptions.showLiveAnalysisMoves` is persisted as part of the game workspace, defaults to `false` for new live games and setup-to-live transitions, and is not part of global settings or remembered UI layout state.
- `liveAnalysisOptions.showLiveAnalysisMoves` gates rendered engine move targets for every `WorkspaceKind.LiveGame` interaction context. When enabled, `InteractionContext.CurrentPosition` may commit a normal live move from the analysis panel, `InteractionContext.HistoryReview` reuses the ordinary history-move policy, and `InteractionContext.InGameAnalysis` may inspect continuations as analysis moves.
- `analysisAssignment.assignedEngines` preserves the rendered analysis-panel row order for the active game and is the source of truth for mapping remembered engine-group fold state by index.
- `IGame` is the game-facing object used by mutation flows. IDs remain on `metadata.id` for routing, persistence, and lookup.
