# Session State Types

## Purpose
Define the persisted game-session and UI-layout payloads used to restore the app workspace across launches.

## Interfaces
- `type SettingsCategory`
- `interface IGameSessionSnapshot`
- `interface IUiLayoutState`

## Data Structures
```ts
type SettingsCategory = "session" | "gameplay" | "appearance" | "engines"

interface IUiLayoutState {
  schemaVersion: number
  showHistoryPanel: boolean
  showAnalysisPanel: boolean
  historyCollapsed: boolean
  analysisCollapsed: boolean
  analysisEngineExpandedByIndex: boolean[]
}

interface IGameSessionSnapshot {
  schemaVersion: number
  openGameIds: string[]
  activeGameId: string | null
  activeRoute:
    | "/home"
    | `/game/${string}`
    | "/saved-games/load"
    | `/saved-games/load/${string}`
    | `/saved-games/save/${string}`
    | `/settings/${SettingsCategory}`
}
```

## Rules
- `IGameSessionSnapshot` stores reopenable shell state only.
- `IUiLayoutState` stores remembered non-modal UI state only.
- `IUiLayoutState` is one global layout snapshot for the app shell.
- `IUiLayoutState` persists visibility plus fold state for all committed foldable sections, including shared history-panel and analysis-panel collapse state and analysis-engine groups by rendered row index for the active game.
- `analysisEngineExpandedByIndex[index] = true` means the analysis-engine row at that rendered index for the active game is expanded, `false` means collapsed, and a missing entry defaults to expanded.
- The rendered row order is derived from `IGameWorkspace.analysisAssignment.assignedEngines` for the active game and is recalculated whenever the active game changes.
- `IGameSessionSnapshot.activeGameId` identifies the selected open game tab only; it is not part of layout persistence.
- `IGameSessionSnapshot.activeRoute` stores canonical routed settings categories and the committed saved-games routes rather than redirect-only aliases such as `/settings`.
- `session.restorePreviousSession` controls whether `IGameSessionSnapshot` is used during startup restore, but it does not block loading `IUiLayoutState`.
- Recent-game history is derived on demand for `HomeView`, not stored in either of these payloads.
- Conscious user preferences live in `ISettingsSnapshot`, not in either of these payloads.
- Modal visibility is transient and is not persisted here.
- Invalid or corrupt session-state payloads are discarded without affecting valid settings, valid recent-game queries, or valid saved-game payloads.
