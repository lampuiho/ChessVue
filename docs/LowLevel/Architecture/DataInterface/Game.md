# Game Workspace Types

## Purpose
Define the canonical workspace model used by `GamesStore`, related services, and persisted saved-game payloads.

## Types
- `type WorkspaceKind = "liveGame" | "freeAnalysisSetup"`
- `type InteractionContext = "currentPosition" | "historyReview" | "inGameAnalysis" | "boardEdit"`
- `type ClockStateKind = "none" | "running" | "paused" | "expired"`
- `type ResultState = "ongoing" | "drawn" | "whiteWon" | "blackWon" | "abandoned"`
- `type ResultReason = "ruleResolved" | "timeout" | "resignation" | "drawAgreement" | "abandoned" | null`
- `type PlayerType = "human" | "engine"`

## Interfaces
- `interface IPlayerSlot`
- `interface ICapturedPieceGroup`
- `interface IGameMetadata`
- `interface IGameWorkspace`
- `interface ICreateGameRequest`
- `interface IStartGameFromSetupRequest`

## Data Structures
```ts
interface IPlayerSlot {
  colour: PlayerColour
  type: PlayerType
  displayName: string
  engineId: string | null
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

interface IGameWorkspace {
  schemaVersion: number
  metadata: IGameMetadata
  workspaceKind: WorkspaceKind
  interactionContext: InteractionContext
  clockState: ClockStateKind
  resultState: ResultState
  resultReason: ResultReason
  whitePlayer: IPlayerSlot | null
  blackPlayer: IPlayerSlot | null
  boardRoot: IBoardPosition
  moveTree: IMoveTree
  liveNodeId: string | null
  visibleNodeId: string
  timeControl: ITimeControl
  clockSnapshot: IClockSnapshot
  analysisAssignment: IAnalysisAssignment
}

interface ICreateGameRequest {
  name: string
  whitePlayerType: PlayerType | null
  blackPlayerType: PlayerType | null
  whiteEngineId: string | null
  blackEngineId: string | null
  analysisEngineIds: string[]
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
  timeControl: ITimeControl
}
```

## Rules
- `freeAnalysisSetup` is created only when neither side is assigned a player.
- `visibleNodeId` may differ from `liveNodeId` during history review or analysis.
- `boardEdit` is valid only inside `freeAnalysisSetup`.
- `resultState` records the outcome only, while `resultReason` records why the game reached that outcome.
- `ICapturedPieceGroup` is a derived read model for player-strip captured-material display and is not persisted on `IGameWorkspace`.
- The baseline persisted saved-game artefact reuses `IGameWorkspace` directly; there is no separate persisted `IGameDocument` shape.
- `schemaVersion` is part of `IGameWorkspace` so the same shape can satisfy both runtime coordination and persisted saved-game migration requirements.
