# Game Document Types

## Purpose
Define the canonical persisted game payload used for autosave and manual import/export.

## Interfaces
- `interface IGamePanelLayoutState`
- `interface IGameScreenSnapshot`
- `interface IGameDocument`

## Data Structures
```ts
interface IGamePanelLayoutState {
  showHistoryPanel: boolean
  showAnalysisPanel: boolean
  showGameControlPanel: boolean
}

interface IGameScreenSnapshot {
  visibleNodeId: string
  visiblePositionFen: string
  panelLayout: IGamePanelLayoutState
  visibleAnalysis: IVisibleAnalysisSnapshot | null
}

interface IGameDocument {
  schemaVersion: number
  metadata: IGameMetadata
  workspaceKind: WorkspaceKind
  interactionContext: InteractionContext
  resultState: ResultState
  whitePlayer: IPlayerSlot | null
  blackPlayer: IPlayerSlot | null
  boardRoot: IBoardPosition
  moveTree: IMoveTree
  liveNodeId: string | null
  visibleNodeId: string
  timeControl: ITimeControl
  clockState: ClockStateKind
  clockSnapshot: IClockSnapshot
  analysisAssignment: IAnalysisAssignment
  savedScreen: IGameScreenSnapshot | null
}
```

## Rules
- This is the canonical payload for both autosave storage and manual file export.
- Restore shows `savedScreen` first, then resumes live analysis when available.
- Optional sections may be reset to safe defaults if partially corrupt while the core game payload remains valid.
