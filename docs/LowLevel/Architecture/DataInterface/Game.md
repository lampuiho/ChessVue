# Game Workspace Types

## Purpose
Define the canonical workspace model used by `GamesStore`, related services, and persisted saved-game payloads.

## Types
- `type WorkspaceKind = "liveGame" | "freeAnalysisSetup"`
- `type InteractionContext = "currentPosition" | "historyReview" | "inGameAnalysis" | "boardEdit"`
- `type ClockStateKind = "none" | "running" | "paused" | "expired"`
- `type ResultState = "ongoing" | "drawn" | "whiteWon" | "blackWon" | "abandoned"`
- `type ResultReason = "ruleResolved" | "timeout" | "resignation" | "drawAgreement" | "abandoned" | null`
- `type PlayerType = "local" | "engine"`

## Interfaces
- `interface IDrawOfferState`
- `interface IPlayerSlot`
- `interface ICapturedPieceGroup`
- `interface IGameMetadata`
- `interface ILiveAnalysisOptions`
- `interface IGameWorkspace`
- `interface ICreateGameRequest`
- `interface IStartGameFromSetupRequest`
- `interface IReassignPlayerRequest`

## Data Structures
```ts
interface IDrawOfferState {
  offeringColour: PlayerColour
  respondingColour: PlayerColour
  direction: "incoming" | "outgoing"
}

interface IPlayerSlot {
  colour: PlayerColour
  type: PlayerType
  displayName: string
  assignedEngine: IAssignedEngine | null
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

interface IGameWorkspace {
  schemaVersion: number
  metadata: IGameMetadata
  workspaceKind: WorkspaceKind
  interactionContext: InteractionContext
  clockState: ClockStateKind
  resultState: ResultState
  resultReason: ResultReason
  drawOfferState: IDrawOfferState | null
  whitePlayer: IPlayerSlot | null
  blackPlayer: IPlayerSlot | null
  boardRoot: IBoardPosition
  moveTree: IMoveTree
  liveNodeId: string | null
  visibleNodeId: string
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

interface IReassignPlayerRequest {
  playerType: PlayerType | null
  engineId: string | null
}
```

## Rules
- `freeAnalysisSetup` is created when either side is assigned no player.
- `visibleNodeId` may differ from `liveNodeId` during history review or analysis.
- `boardEdit` is valid only inside `freeAnalysisSetup`.
- `resultState` records the outcome only, while `resultReason` records why the game reached that outcome.
- `drawOfferState` records one unresolved draw offer for the current live workspace and is persisted with the workspace so non-local pending-offer UI can be restored accurately for both incoming and outgoing offers.
- Player seats and analysis assignment persist captured assigned-engine snapshots rather than profile IDs, so open or restored games keep their original launch configuration until the user explicitly reassigns them.
- `ICapturedPieceGroup` is a derived read model for player-strip captured-material display and is not persisted on `IGameWorkspace`.
- The baseline persisted saved-game artefact reuses `IGameWorkspace` directly; there is no separate persisted `IGameDocument` shape.
- `schemaVersion` is part of `IGameWorkspace` so the same shape can satisfy both runtime coordination and persisted saved-game migration requirements.
- `drawOfferState` is cleared when the draw is accepted, declined, or withdrawn, when another terminal result supersedes it, or when the workspace leaves live-game progression for setup.
- `liveAnalysisOptions.showLiveAnalysisMoves` is persisted as part of the game workspace, defaults to `false` for new live games and setup-to-live transitions, and is not part of global settings or remembered UI layout state.
- `liveAnalysisOptions.showLiveAnalysisMoves` gates rendered engine move targets for every `liveGame` interaction context. When enabled, `currentPosition` may commit a normal live move from the analysis panel, `historyReview` reuses the ordinary history-move policy, and `inGameAnalysis` may inspect continuations as analysis moves.
- `analysisAssignment.assignedEngines` preserves the rendered analysis-panel row order for the active game and is the source of truth for mapping remembered engine-group fold state by index.
- `IReassignPlayerRequest` is seat-selection data only. Fresh live-game settings for restarting from setup belong to `IStartGameFromSetupRequest`.
